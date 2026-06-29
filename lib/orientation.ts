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
  webkitCompassHeading?: number;
};

export type CameraPointing = {
  azimuth: number | null;
  altitude: number | null;
  source: "webkit-compass" | "tilt-only" | "unavailable";
};

type Vector3 = [number, number, number];
type FullOrientationReading = {
  alpha: number;
  beta: number;
  gamma: number;
};

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
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
  const compassHeading = typeof reading.webkitCompassHeading === "number"
    ? normalizeAngle(reading.webkitCompassHeading)
    : null;

  if (typeof reading.alpha === "number" && typeof reading.beta === "number" && typeof reading.gamma === "number") {
    const horizontal = getBackCameraHorizontal({
      alpha: reading.alpha,
      beta: reading.beta,
      gamma: reading.gamma,
    });

    if (horizontal.camera) {
      if (compassHeading !== null && horizontal.top) {
        const compassOffset = angleDifference(horizontal.top.azimuth, compassHeading);

        return {
          azimuth: normalizeAngle(horizontal.camera.azimuth + compassOffset),
          altitude: horizontal.camera.altitude,
          source: "webkit-compass",
        };
      }

      return {
        azimuth: null,
        altitude: horizontal.camera.altitude,
        source: "tilt-only",
      };
    }
  }

  if (typeof reading.beta === "number") {
    return {
      azimuth: compassHeading,
      altitude: betaToCameraAltitude(reading.beta),
      source: compassHeading === null ? "tilt-only" : "webkit-compass",
    };
  }

  return {
    azimuth: compassHeading,
    altitude: null,
    source: compassHeading === null ? "unavailable" : "webkit-compass",
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
