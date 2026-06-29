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

export function getCameraPointing(reading: DeviceOrientationReading): CameraPointing {
  const compassHeading =
    typeof reading.webkitCompassHeading === "number"
      ? normalizeAngle(reading.webkitCompassHeading)
      : null;

  // 1) iOS : webkitCompassHeading combiné à la matrice 3D pour la précision maximale
  if (compassHeading !== null && typeof reading.beta === "number" && typeof reading.gamma === "number") {
    let c = compassHeading;
    
    // CORRECTION DU GIMBAL LOCK iOS :
    // iOS inverse la boussole de 180° au-delà de 45° d'altitude (beta >= 135).
    if (reading.beta >= 135) {
      c = normalizeAngle(c + 180);
    }
    
    // On convertit la boussole en radians
    const sC = Math.sin(degreesToRadians(c));
    const cC = Math.cos(degreesToRadians(c));
    const sB = Math.sin(degreesToRadians(reading.beta));
    const cB = Math.cos(degreesToRadians(reading.beta));
    const sG = Math.sin(degreesToRadians(reading.gamma));
    const cG = Math.cos(degreesToRadians(reading.gamma));
    
    // Calcul du vecteur caméra arrière (-Z) dans le repère Terre (Est, Nord, Haut)
    // en injectant la boussole iOS dans la matrice W3C (alpha = -compassHeading)
    const east = -(cC * sG - cG * sC * sB);
    const north = sC * sG + cC * cG * sB;
    const up = -cB * cG;
    
    const length = Math.hypot(east, north, up);
    if (length > 0) {
      const azimuth = normalizeAngle(radiansToDegrees(Math.atan2(east, north)));
      const altitude = Math.max(-90, Math.min(90, radiansToDegrees(Math.asin(up / length))));
      return { azimuth, altitude, source: "webkit-compass" };
    }
  }

  // Fallback iOS simple si gamma manque
  if (compassHeading !== null) {
    let azimuth = compassHeading;
    if (typeof reading.beta === "number" && reading.beta >= 135) {
      azimuth = normalizeAngle(compassHeading + 180);
    }
    const altitude = typeof reading.beta === "number" ? betaToCameraAltitude(reading.beta) : null;
    return { azimuth, altitude, source: "webkit-compass" };
  }

  // 2) Android / Chrome : deviceorientationabsolute fournit un alpha vrai par rapport au Nord.
  if (reading.absolute && typeof reading.alpha === "number" && typeof reading.beta === "number" && typeof reading.gamma === "number") {
    const horizontal = getBackCameraHorizontal({
      alpha: reading.alpha,
      beta: reading.beta,
      gamma: reading.gamma,
    });
    if (horizontal.camera) {
      return {
        azimuth: horizontal.camera.azimuth,
        altitude: horizontal.camera.altitude,
        source: "absolute",
      };
    }
  }

  // 3) Fallback : on n'a pas de boussole fiable, juste l'inclinaison (beta)
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