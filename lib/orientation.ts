import {
  calculateCameraRoll,
  applyCameraBasisOffsets,
  crossProduct,
  horizontalCoordinatesToVector,
  normalizeVector,
  rotateBasisForScreenOrientation,
  rotateVectorAroundAxis,
  vectorToHorizontalCoordinates,
  type CameraBasis,
  type CameraConfidence,
  type Vector3 as ProjectionVector3,
} from "@/lib/sky-projection";

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

export type PointingCalibration = {
  azimuthOffset: number;
  altitudeOffset: number;
};

export type PointingSample = {
  azimuth: number;
  altitude: number;
};

export type CameraOrientation3D = CameraBasis & {
  roll: number;
  screenAngle: number;
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

function tupleToVector(vector: Vector3): ProjectionVector3 {
  return { x: vector[0], y: vector[1], z: vector[2] };
}

function getBackCameraBasis(reading: FullOrientationReading, confidence: CameraConfidence): CameraBasis | null {
  const rotation = getOrientationRotation(reading.alpha, reading.beta, reading.gamma);
  const forward = normalizeVector(tupleToVector(deviceToEarthVector(rotation, [0, 0, -1])));
  const right = normalizeVector(tupleToVector(deviceToEarthVector(rotation, [1, 0, 0])));
  const up = normalizeVector(tupleToVector(deviceToEarthVector(rotation, [0, 1, 0])));
  return forward && right && up ? { forward, right, up, confidence } : null;
}

function getWebkitCameraHeading(compassHeading: number, beta: number | null): number {
  // When the phone is tilted far past vertical, Safari reports the opposite
  // end of the device as its heading. Keep the compass tied to the back camera.
  return beta !== null && beta >= 135
    ? normalizeAngle(compassHeading + 180)
    : compassHeading;
}

function rotateBasisAroundEarthUp(basis: CameraBasis, degrees: number): CameraBasis {
  const earthUp = { x: 0, y: 0, z: 1 };
  return {
    ...basis,
    forward: rotateVectorAroundAxis(basis.forward, earthUp, -degrees),
    right: rotateVectorAroundAxis(basis.right, earthUp, -degrees),
    up: rotateVectorAroundAxis(basis.up, earthUp, -degrees),
  };
}

/**
 * Returns the complete back-camera basis in the local east/north/up frame.
 * iOS alpha is used only to recover tilt/roll: webkitCompassHeading supplies north.
 */
export function getCameraOrientation3D(
  reading: DeviceOrientationReading,
  screenAngle = 0,
): CameraOrientation3D | null {
  if (typeof reading.beta !== "number" || typeof reading.gamma !== "number") {
    return null;
  }

  const hasAlpha = typeof reading.alpha === "number";
  const compassHeading = typeof reading.webkitCompassHeading === "number"
    ? getWebkitCameraHeading(normalizeAngle(reading.webkitCompassHeading), reading.beta)
    : null;
  let basis: CameraBasis | null = null;

  if (compassHeading !== null) {
    basis = getBackCameraBasis({ alpha: hasAlpha ? reading.alpha as number : 0, beta: reading.beta, gamma: reading.gamma }, "medium");
    if (basis) {
      const rawHorizontal = vectorToHorizontalCoordinates(basis.forward);
      if (rawHorizontal && Math.abs(rawHorizontal.altitude) < 87) {
        basis = rotateBasisAroundEarthUp(basis, angleDifference(rawHorizontal.azimuth, compassHeading));
      } else {
        const altitude = rawHorizontal?.altitude ?? betaToCameraAltitude(reading.beta);
        const forward = horizontalCoordinatesToVector(compassHeading, altitude);
        const roll = calculateCameraRoll(basis);
        const levelRight = normalizeVector(crossProduct(forward, { x: 0, y: 0, z: 1 }));
        const levelUp = levelRight ? normalizeVector(crossProduct(levelRight, forward)) : null;
        if (levelRight && levelUp) {
          basis = {
            ...basis,
            forward,
            right: rotateVectorAroundAxis(levelRight, forward, roll),
            up: rotateVectorAroundAxis(levelUp, forward, roll),
          };
        }
      }
    }
  } else if (reading.absolute && hasAlpha) {
    basis = getBackCameraBasis({ alpha: reading.alpha as number, beta: reading.beta, gamma: reading.gamma }, "high");
  }

  if (!basis) {
    return null;
  }

  const screenBasis = rotateBasisForScreenOrientation(basis, screenAngle);
  return {
    ...screenBasis,
    roll: calculateCameraRoll(screenBasis),
    screenAngle: normalizeAngle(screenAngle),
  };
}

export function applyCameraOrientationCalibration(
  orientation: CameraOrientation3D,
  calibration: PointingCalibration | null,
): CameraOrientation3D {
  if (!calibration) {
    return orientation;
  }

  const calibrated = applyCameraBasisOffsets(
    orientation,
    calibration.azimuthOffset,
    calibration.altitudeOffset,
  );

  return {
    ...calibrated,
    roll: calculateCameraRoll(calibrated),
    screenAngle: orientation.screenAngle,
  };
}

export function getCameraPointing(reading: DeviceOrientationReading): CameraPointing {
  const compassHeading =
    typeof reading.webkitCompassHeading === "number"
      ? normalizeAngle(reading.webkitCompassHeading)
      : null;

  // 1) iOS : webkitCompassHeading est la boussole native.
  if (compassHeading !== null) {
    const azimuth = getWebkitCameraHeading(compassHeading, reading.beta);
    
    const altitude = typeof reading.beta === "number" ? betaToCameraAltitude(reading.beta) : null;
    return {
      azimuth,
      altitude,
      source: "webkit-compass",
    };
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

export function averagePointingSamples(samples: PointingSample[]): PointingSample | null {
  if (samples.length === 0) {
    return null;
  }

  const azimuthVectors = samples.reduce(
    (total, sample) => {
      const radians = degreesToRadians(sample.azimuth);
      return {
        x: total.x + Math.sin(radians),
        y: total.y + Math.cos(radians),
      };
    },
    { x: 0, y: 0 },
  );
  const altitude = samples.reduce((total, sample) => total + sample.altitude, 0) / samples.length;

  return {
    azimuth: normalizeAngle(radiansToDegrees(Math.atan2(azimuthVectors.x, azimuthVectors.y))),
    altitude: Math.max(-90, Math.min(90, altitude)),
  };
}

export function createPointingCalibration(
  measured: PointingSample,
  reference: PointingSample,
): PointingCalibration {
  return {
    azimuthOffset: angleDifference(measured.azimuth, reference.azimuth),
    altitudeOffset: reference.altitude - measured.altitude,
  };
}

export function applyPointingCalibration(
  pointing: CameraPointing,
  calibration: PointingCalibration | null,
): CameraPointing {
  if (!calibration) {
    return pointing;
  }

  return {
    ...pointing,
    azimuth: pointing.azimuth === null
      ? null
      : normalizeAngle(pointing.azimuth + calibration.azimuthOffset),
    altitude: pointing.altitude === null
      ? null
      : Math.max(-90, Math.min(90, pointing.altitude + calibration.altitudeOffset)),
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
