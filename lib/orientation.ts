import {
  calculateCameraRoll,
  normalizeCameraBasis,
  rotateBasisForScreenOrientation,
  rotateVectorAroundAxis,
  smoothCameraBasis,
  vectorToHorizontalCoordinates,
  type CameraBasis,
  type CameraConfidence,
  type Vector3,
} from "./sky-projection.ts";

/** Quaternion [x, y, z, w] rotating device coordinates into the reference frame. */
export type OrientationQuaternion = [number, number, number, number];

export type DeviceOrientationReading = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitCompassHeading?: number;
  absoluteQuaternion?: OrientationQuaternion | null;
};

export type CameraPointingSource =
  "absolute-sensor" | "webkit-compass" | "tilt-only" | "unavailable";

export type CameraPointing = {
  azimuth: number | null;
  altitude: number | null;
  roll: number | null;
  quaternion: OrientationQuaternion | null;
  basis: CameraBasis | null;
  screenAngle: number;
  source: CameraPointingSource;
};

const ZENITH: Vector3 = { x: 0, y: 0, z: 1 };
const QUATERNION_EPSILON = 1e-8;

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function normalizeScreenAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return normalizeAngle(Math.round(angle / 90) * 90);
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
  return directions[Math.round(normalizeAngle(azimuth) / 45) % directions.length];
}

export function betaToCameraAltitude(beta: number): number {
  return Math.max(-90, Math.min(90, beta - 90));
}

export function normalizeQuaternion(quaternion: readonly number[]): OrientationQuaternion | null {
  if (quaternion.length < 4 || !quaternion.slice(0, 4).every(Number.isFinite)) return null;
  const length = Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  if (length <= QUATERNION_EPSILON) return null;
  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ];
}

export function alignQuaternionHemisphere(
  previous: OrientationQuaternion | null,
  next: OrientationQuaternion,
): OrientationQuaternion {
  if (!previous) return next;
  const dot = previous.reduce((sum, value, index) => sum + value * next[index], 0);
  return dot < 0 ? (next.map((value) => -value) as OrientationQuaternion) : next;
}

function rotateVectorByQuaternion(quaternion: OrientationQuaternion, vector: Vector3): Vector3 {
  const [x, y, z, w] = quaternion;
  return {
    x:
      (1 - 2 * (y * y + z * z)) * vector.x +
      2 * (x * y - w * z) * vector.y +
      2 * (x * z + w * y) * vector.z,
    y:
      2 * (x * y + w * z) * vector.x +
      (1 - 2 * (x * x + z * z)) * vector.y +
      2 * (y * z - w * x) * vector.z,
    z:
      2 * (x * z - w * y) * vector.x +
      2 * (y * z + w * x) * vector.y +
      (1 - 2 * (x * x + y * y)) * vector.z,
  };
}

function basisFromQuaternion(
  quaternion: OrientationQuaternion,
  confidence: CameraConfidence,
): CameraBasis | null {
  // W3C device axes: +X right, +Y toward the natural top, +Z out of the screen.
  // The rear camera therefore looks along -Z before the screen rotation is applied.
  return normalizeCameraBasis({
    forward: rotateVectorByQuaternion(quaternion, { x: 0, y: 0, z: -1 }),
    right: rotateVectorByQuaternion(quaternion, { x: 1, y: 0, z: 0 }),
    up: rotateVectorByQuaternion(quaternion, { x: 0, y: 1, z: 0 }),
    confidence,
  });
}

function deviceOrientationBasis(
  alpha: number,
  beta: number,
  gamma: number,
  confidence: CameraConfidence,
): CameraBasis | null {
  const a = (alpha * Math.PI) / 180;
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);

  // DeviceOrientation uses intrinsic Z-X'-Y'' rotations. Rows map device to local ENU.
  const rotation = [
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
  const transform = (vector: Vector3): Vector3 => ({
    x: rotation[0] * vector.x + rotation[1] * vector.y + rotation[2] * vector.z,
    y: rotation[3] * vector.x + rotation[4] * vector.y + rotation[5] * vector.z,
    z: rotation[6] * vector.x + rotation[7] * vector.y + rotation[8] * vector.z,
  });
  return normalizeCameraBasis({
    forward: transform({ x: 0, y: 0, z: -1 }),
    right: transform({ x: 1, y: 0, z: 0 }),
    up: transform({ x: 0, y: 1, z: 0 }),
    confidence,
  });
}

function rotateBasisAroundZenith(basis: CameraBasis, angleDegrees: number): CameraBasis {
  return {
    ...basis,
    forward: rotateVectorAroundAxis(basis.forward, ZENITH, angleDegrees),
    right: rotateVectorAroundAxis(basis.right, ZENITH, angleDegrees),
    up: rotateVectorAroundAxis(basis.up, ZENITH, angleDegrees),
  };
}

function pointingFromBasis({
  basis,
  source,
  screenAngle,
  quaternion,
  hasAbsoluteNorth,
}: {
  basis: CameraBasis;
  source: CameraPointingSource;
  screenAngle: number;
  quaternion: OrientationQuaternion | null;
  hasAbsoluteNorth: boolean;
}): CameraPointing {
  const horizontal = vectorToHorizontalCoordinates(basis.forward);
  return {
    azimuth: hasAbsoluteNorth ? (horizontal?.azimuth ?? null) : null,
    altitude: horizontal?.altitude ?? null,
    roll: calculateCameraRoll(basis),
    quaternion,
    basis,
    screenAngle,
    source,
  };
}

export function getCameraPointing(
  reading: DeviceOrientationReading,
  rawScreenAngle = 0,
): CameraPointing {
  const screenAngle = normalizeScreenAngle(rawScreenAngle);
  const quaternion = reading.absoluteQuaternion
    ? normalizeQuaternion(reading.absoluteQuaternion)
    : null;
  if (quaternion) {
    const deviceBasis = basisFromQuaternion(quaternion, "high");
    if (deviceBasis) {
      return pointingFromBasis({
        basis: rotateBasisForScreenOrientation(deviceBasis, screenAngle),
        source: "absolute-sensor",
        screenAngle,
        quaternion,
        hasAbsoluteNorth: true,
      });
    }
  }

  const hasCompleteAngles = [reading.alpha, reading.beta, reading.gamma].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const compassHeading =
    typeof reading.webkitCompassHeading === "number" &&
    Number.isFinite(reading.webkitCompassHeading)
      ? normalizeAngle(reading.webkitCompassHeading)
      : null;

  if (hasCompleteAngles) {
    const alpha = reading.alpha as number;
    const beta = reading.beta as number;
    const gamma = reading.gamma as number;
    let basis = deviceOrientationBasis(
      alpha,
      beta,
      gamma,
      compassHeading === null ? "low" : "medium",
    );
    if (basis) {
      const horizontal = vectorToHorizontalCoordinates(basis.forward);
      const isQuasiVertical = beta > 45 && beta < 135;
      const useCompass = compassHeading !== null && isQuasiVertical && horizontal !== null;
      if (useCompass && horizontal) {
        basis = rotateBasisAroundZenith(
          basis,
          -angleDifference(horizontal.azimuth, compassHeading),
        );
      }
      basis = rotateBasisForScreenOrientation(basis, screenAngle);
      return pointingFromBasis({
        basis,
        source: useCompass ? "webkit-compass" : "tilt-only",
        screenAngle,
        quaternion: null,
        hasAbsoluteNorth: useCompass,
      });
    }
  }

  if (typeof reading.beta === "number" && Number.isFinite(reading.beta)) {
    return {
      azimuth: null,
      altitude: betaToCameraAltitude(reading.beta),
      roll: null,
      quaternion: null,
      basis: null,
      screenAngle,
      source: "tilt-only",
    };
  }

  return {
    azimuth: null,
    altitude: null,
    roll: null,
    quaternion: null,
    basis: null,
    screenAngle,
    source: "unavailable",
  };
}

export function smoothCameraPointing(
  previous: CameraPointing | null,
  next: CameraPointing,
): CameraPointing {
  if (!previous || previous.source !== next.source) return next;
  const quaternion = next.quaternion
    ? alignQuaternionHemisphere(previous.quaternion, next.quaternion)
    : null;
  if (previous.basis && next.basis) {
    const basis = smoothCameraBasis(previous.basis, next.basis);
    return pointingFromBasis({
      basis,
      source: next.source,
      screenAngle: next.screenAngle,
      quaternion,
      hasAbsoluteNorth: next.azimuth !== null,
    });
  }
  if (next.altitude !== null && previous.altitude !== null) {
    return { ...next, altitude: previous.altitude + (next.altitude - previous.altitude) * 0.2 };
  }
  return { ...next, quaternion };
}

export function getDirectionHint(currentAzimuth: number, targetAzimuth: number): string {
  const diff = angleDifference(currentAzimuth, targetAzimuth);
  return diff > 15 ? "Tourne à droite" : diff < -15 ? "Tourne à gauche" : "Bonne direction";
}

export function getAltitudeHint(currentPitch: number, targetAltitude: number): string {
  const diff = targetAltitude - currentPitch;
  return diff > 10
    ? "Lève un peu le téléphone"
    : diff < -10
      ? "Baisse un peu le téléphone"
      : "Hauteur proche";
}
