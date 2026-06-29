export const ALIGNMENT_TOLERANCE_DEGREES = 4;

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function angleDifference(current: number, target: number): number {
  return ((normalizeAngle(target) - normalizeAngle(current) + 540) % 360) - 180;
}

export function azimuthToCardinal(azimuth: number): string {
  const directions = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"];
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
  absolute: boolean;
  webkitCompassHeading?: number;
};

export type CameraPointing = {
  azimuth: number | null;
  altitude: number | null;
  source: "absolute" | "webkit-compass" | "tilt-only" | "unavailable";
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

// MODIFICATION: Ajout de la propriété 'length' pour évaluer la stabilité horizontale du vecteur
function vectorToHorizontal(vector: Vector3): { azimuth: number; altitude: number; length: number } | null {
  const [east, north, up] = vector;
  const length = Math.hypot(east, north, up);
  if (length === 0) {
    return null;
  }
  const horizontalLength = Math.hypot(east, north);
  return {
    azimuth: normalizeAngle(radiansToDegrees(Math.atan2(east, north))),
    altitude: Math.max(-90, Math.min(90, radiansToDegrees(Math.asin(up / length)))),
    length: horizontalLength,
  };
}

function deviceToEarthVector(rotation: number[], vector: Vector3): Vector3 {
  return [
    rotation[0] * vector[0] + rotation[3] * vector[1] + rotation[6] * vector[2],
    rotation[1] * vector[0] + rotation[4] * vector[1] + rotation[7] * vector[2],
    rotation[2] * vector[0] + rotation[5] * vector[1] + rotation[8] * vector[2],
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
  
  // DeviceOrientation defines intrinsic Z-X'-Y'' rotations. This matrix follows
  // the W3C algorithm, then we transpose it to map device axes into earth axes.
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

// MODIFICATION: Ajout du vecteur 'right' pour servir de fallback stable lors du gimbal lock
function getBackCameraHorizontal(reading: FullOrientationReading): {
  camera: { azimuth: number; altitude: number; length: number } | null;
  top: { azimuth: number; altitude: number; length: number } | null;
  right: { azimuth: number; altitude: number; length: number } | null;
} {
  const rotation = getOrientationRotation(reading.alpha, reading.beta, reading.gamma);
  return {
    camera: vectorToHorizontal(deviceToEarthVector(rotation, [0, 0, -1])),
    top: vectorToHorizontal(deviceToEarthVector(rotation, [0, 1, 0])),
    right: vectorToHorizontal(deviceToEarthVector(rotation, [1, 0, 0])),
  };
}

export function getCameraPointing(reading: DeviceOrientationReading): CameraPointing {
  const compassHeading =
    typeof reading.webkitCompassHeading === "number"
      ? normalizeAngle(reading.webkitCompassHeading)
      : null;

  // Si on a les 3 axes, on utilise la matrice 3D pour calculer l'orientation précise
  if (typeof reading.alpha === "number" && typeof reading.beta === "number" && typeof reading.gamma === "number") {
    const horizontal = getBackCameraHorizontal({
      alpha: reading.alpha,
      beta: reading.beta,
      gamma: reading.gamma,
    });

    if (horizontal.camera) {
      // 1) iOS : webkitCompassHeading est disponible, on l'utilise pour calibrer l'azimut
      if (compassHeading !== null) {
        let compassOffset = 0;
        const topLen = horizontal.top?.length || 0;
        const rightLen = horizontal.right?.length || 0;

        // CORRECTION DU GIMBAL LOCK :
        // Si on lève le téléphone (visée > 45°), le vecteur "haut" devient instable.
        // On utilise alors le vecteur "droite" qui reste bien horizontal.
        if (rightLen > topLen && horizontal.right) {
          // Le vrai azimut du vecteur "droite" est la boussole + 90° (vers l'Est)
          const trueRightAzimuth = normalizeAngle(compassHeading + 90);
          compassOffset = angleDifference(horizontal.right.azimuth, trueRightAzimuth);
        } else if (horizontal.top) {
          // Téléphone à plat ou en paysage : le vecteur "haut" est stable
          compassOffset = angleDifference(horizontal.top.azimuth, compassHeading);
        }

        return {
          azimuth: normalizeAngle(horizontal.camera.azimuth + compassOffset),
          altitude: horizontal.camera.altitude,
          source: "webkit-compass",
        };
      }

      // 2) Android / Chrome : deviceorientationabsolute fournit un alpha vrai par rapport au Nord.
      if (reading.absolute) {
        return {
          azimuth: horizontal.camera.azimuth,
          altitude: horizontal.camera.altitude,
          source: "absolute",
        };
      }
    }
  }

  // 3) Fallback iOS : si alpha/beta/gamma manquent (rare), on utilise la boussole brute
  if (compassHeading !== null) {
    const altitude = typeof reading.beta === "number" ? betaToCameraAltitude(reading.beta) : null;
    return {
      azimuth: compassHeading,
      altitude,
      source: "webkit-compass",
    };
  }

  // 4) Fallback : on n'a pas de boussole fiable, juste l'inclinaison (beta)
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
  if (diff > ALIGNMENT_TOLERANCE_DEGREES) {
    return "Tourne à droite";
  }
  if (diff < -ALIGNMENT_TOLERANCE_DEGREES) {
    return "Tourne à gauche";
  }
  return "Bonne direction";
}

export function getAltitudeHint(currentPitch: number, targetAltitude: number): string {
  const diff = targetAltitude - currentPitch;
  if (diff > ALIGNMENT_TOLERANCE_DEGREES) {
    return "Lève un peu le téléphone";
  }
  if (diff < -ALIGNMENT_TOLERANCE_DEGREES) {
    return "Baisse un peu le téléphone";
  }
  return "Hauteur proche";
}