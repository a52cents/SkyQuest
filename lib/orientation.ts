/**
 * Orientation du téléphone
 *
 * Normalise les conventions hétérogènes des capteurs navigateur en une direction caméra
 * exploitable par le guidage, puis produit des indications simples de rotation et d'altitude.
 *
 * Points sensibles :
 * - iOS et Android n'exposent pas toujours les mêmes axes ni le même nord de référence ;
 * - les angles doivent rester continus au passage de 359° à 0° ;
 * - une lecture absente ou peu fiable doit réduire la confiance, pas provoquer une erreur ;
 * - ce module ne demande jamais lui-même une permission navigateur.
 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function angleDifference(current: number, target: number): number {
  return ((normalizeAngle(target) - normalizeAngle(current) + 540) % 360) - 180;
}

export function azimuthToCardinal(azimuth: number): string {
  const directions = [
    "Nord",
    "Nord-Est",
    "Est",
    "Sud-Est",
    "Sud",
    "Sud-Ouest",
    "Ouest",
    "Nord-Ouest",
  ];
  const index = Math.round(normalizeAngle(azimuth) / 45) % directions.length;
  return directions[index];
}

export function betaToCameraAltitude(beta: number): number {
  return Math.max(-90, Math.min(90, beta - 90));
}

export type DeviceOrientationReading = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitCompassHeading?: number;
  absoluteQuaternion?: [number, number, number, number] | null; // [x, y, z, w]
};

export type CameraPointing = {
  azimuth: number | null;
  altitude: number | null;
  source: "absolute-sensor" | "webkit-compass" | "tilt-only" | "unavailable";
};

type Vector3 = [number, number, number];

type FullOrientationReading = {
  alpha: number;
  beta: number;
  gamma: number;
};

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function vectorToHorizontal(vector: Vector3): { azimuth: number; altitude: number } | null {
  const [east, north, up] = vector;
  const length = Math.hypot(east, north, up);
  if (length === 0) {
    return null;
  }
  return {
    azimuth: normalizeAngle(radiansToDegrees(Math.atan2(east, north))),
    altitude: Math.max(-90, Math.min(90, radiansToDegrees(Math.asin(up / length)))),
  };
}

// Bug 1 Fixed: Multiplication by rows (device-to-world) instead of columns
function deviceToEarthVector(rotation: number[], vector: Vector3): Vector3 {
  return [
    rotation[0] * vector[0] + rotation[1] * vector[1] + rotation[2] * vector[2],
    rotation[3] * vector[0] + rotation[4] * vector[1] + rotation[5] * vector[2],
    rotation[6] * vector[0] + rotation[7] * vector[1] + rotation[8] * vector[2],
  ];
}

function getOrientationRotation(alpha: number, beta: number, gamma: number): number[] {
  const a = degreesToRadians(alpha);
  const b = degreesToRadians(beta);
  const g = degreesToRadians(gamma);

  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);

  // DeviceOrientation defines intrinsic Z-X'-Y'' rotations.
  // This matrix is device-to-world according to W3C spec.
  return [
    cA * cG - sA * sB * sG,
    -cB * sA,
    cA * sG + cG * sA * sB,
    cG * sA + cA * sB * sG,
    cA * cB,
    sA * sG - cA * cG * sB,
    -cB * sG,
    sB,
    cB * cG,
  ];
}

function getBackCameraHorizontal(reading: FullOrientationReading): {
  camera: { azimuth: number; altitude: number } | null;
  top: { azimuth: number; altitude: number } | null;
} {
  const rotation = getOrientationRotation(reading.alpha, reading.beta, reading.gamma);
  return {
    camera: vectorToHorizontal(deviceToEarthVector(rotation, [0, 0, -1])),
    top: vectorToHorizontal(deviceToEarthVector(rotation, [0, 1, 0])),
  };
}

// Helper for quaternion rotation: q * v * q_conjugate
function quaternionToVector(q: [number, number, number, number], v: Vector3): Vector3 {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;

  return [
    (1 - 2 * (y * y + z * z)) * vx + 2 * (x * y - w * z) * vy + 2 * (x * z + w * y) * vz,
    2 * (x * y + w * z) * vx + (1 - 2 * (x * x + z * z)) * vy + 2 * (y * z - w * x) * vz,
    2 * (x * z - w * y) * vx + 2 * (y * z + w * x) * vy + (1 - 2 * (x * x + y * y)) * vz,
  ];
}

export function getCameraPointing(reading: DeviceOrientationReading): CameraPointing {
  // PRIORITÉ 1 — AbsoluteOrientationSensor (quaternion absolu)
  if (reading.absoluteQuaternion) {
    const q = reading.absoluteQuaternion;
    // Le vecteur "caméra arrière" dans le repère device est [0, 0, -1]
    const cameraWorldVector = quaternionToVector(q, [0, 0, -1]);
    const horizontal = vectorToHorizontal(cameraWorldVector);

    if (horizontal) {
      return {
        azimuth: horizontal.azimuth,
        altitude: horizontal.altitude,
        source: "absolute-sensor",
      };
    }
  }

  // FALLBACK — deviceorientation + webkitCompassHeading direct
  const compassHeading =
    typeof reading.webkitCompassHeading === "number"
      ? normalizeAngle(reading.webkitCompassHeading)
      : null;

  if (
    typeof reading.alpha === "number" &&
    typeof reading.beta === "number" &&
    typeof reading.gamma === "number"
  ) {
    const horizontal = getBackCameraHorizontal({
      alpha: reading.alpha,
      beta: reading.beta,
      gamma: reading.gamma,
    });

    if (horizontal.camera) {
      // On utilise la boussole directe uniquement quand le téléphone est quasi-vertical
      // (beta entre 45° et 135°) pour éviter les sauts angulaires
      const isQuasiVertical = reading.beta > 45 && reading.beta < 135;

      if (compassHeading !== null && isQuasiVertical) {
        // Safari fournit déjà le cap réel de l'appareil par rapport au nord magnétique.
        // Ajouter 180° inverserait entièrement le guidage Est/Ouest.
        return {
          azimuth: compassHeading,
          altitude: horizontal.camera.altitude,
          source: "webkit-compass",
        };
      }

      // Sinon, fallback "tilt-only" (azimuth null pour éviter les sauts)
      return {
        azimuth: null,
        altitude: horizontal.camera.altitude,
        source: "tilt-only",
      };
    }
  }

  // Fallback ultime si seulement beta est dispo
  if (typeof reading.beta === "number") {
    return {
      azimuth: null,
      altitude: betaToCameraAltitude(reading.beta),
      source: "tilt-only",
    };
  }

  return {
    azimuth: null,
    altitude: null,
    source: "unavailable",
  };
}

export function getDirectionHint(currentAzimuth: number, targetAzimuth: number): string {
  const diff = angleDifference(currentAzimuth, targetAzimuth);
  if (diff > 15) {
    return "Tourne à droite";
  }
  if (diff < -15) {
    return "Tourne à gauche";
  }
  return "Bonne direction";
}

export function getAltitudeHint(currentPitch: number, targetAltitude: number): string {
  const diff = targetAltitude - currentPitch;
  if (diff > 10) {
    return "Lève un peu le téléphone";
  }
  if (diff < -10) {
    return "Baisse un peu le téléphone";
  }
  return "Hauteur proche";
}
