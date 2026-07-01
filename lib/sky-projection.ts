export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type CameraConfidence = "high" | "medium" | "low";

export type CameraBasis = {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
  confidence: CameraConfidence;
};

export type ScreenProjection = {
  x: number;
  y: number;
  depth: number;
  onScreen: boolean;
};

export type VideoCover = {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
};

export const DEFAULT_LONG_AXIS_FOV_DEGREES = 65;
const EPSILON = 1e-8;

export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVector(vector: Vector3, scale: number): Vector3 {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

export function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function normalizeVector(vector: Vector3): Vector3 | null {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return length > EPSILON ? scaleVector(vector, 1 / length) : null;
}

export function horizontalCoordinatesToVector(azimuth: number, altitude: number): Vector3 {
  const azimuthRadians = (azimuth * Math.PI) / 180;
  const altitudeRadians = (altitude * Math.PI) / 180;
  const horizontal = Math.cos(altitudeRadians);

  // Local tangent frame: +x east, +y north, +z zenith.
  return {
    x: horizontal * Math.sin(azimuthRadians),
    y: horizontal * Math.cos(azimuthRadians),
    z: Math.sin(altitudeRadians),
  };
}

export function vectorToHorizontalCoordinates(vector: Vector3): { azimuth: number; altitude: number } | null {
  const normalized = normalizeVector(vector);
  if (!normalized) {
    return null;
  }

  return {
    azimuth: ((Math.atan2(normalized.x, normalized.y) * 180) / Math.PI + 360) % 360,
    altitude: (Math.asin(Math.max(-1, Math.min(1, normalized.z))) * 180) / Math.PI,
  };
}

export function rotateVectorAroundAxis(vector: Vector3, axis: Vector3, angleDegrees: number): Vector3 {
  const unitAxis = normalizeVector(axis);
  if (!unitAxis) {
    return vector;
  }

  const radians = (angleDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return addVectors(
    addVectors(scaleVector(vector, cosine), scaleVector(crossProduct(unitAxis, vector), sine)),
    scaleVector(unitAxis, dotProduct(unitAxis, vector) * (1 - cosine)),
  );
}

export function rotateBasisForScreenOrientation(basis: CameraBasis, screenAngle: number): CameraBasis {
  const radians = ((((screenAngle % 360) + 360) % 360) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    ...basis,
    right: normalizeVector(addVectors(scaleVector(basis.right, cosine), scaleVector(basis.up, sine))) ?? basis.right,
    up: normalizeVector(addVectors(scaleVector(basis.up, cosine), scaleVector(basis.right, -sine))) ?? basis.up,
  };
}

export function applyCameraBasisOffsets(
  basis: CameraBasis,
  azimuthOffset: number,
  altitudeOffset: number,
): CameraBasis {
  const current = vectorToHorizontalCoordinates(basis.forward);
  if (!current) {
    return basis;
  }
  const targetForward = horizontalCoordinatesToVector(
    current.azimuth + azimuthOffset,
    Math.max(-90, Math.min(90, current.altitude + altitudeOffset)),
  );
  const axis = normalizeVector(crossProduct(basis.forward, targetForward));
  if (!axis) {
    return { ...basis, forward: targetForward };
  }
  const angle = (Math.acos(Math.max(-1, Math.min(1, dotProduct(basis.forward, targetForward)))) * 180) / Math.PI;
  return {
    ...basis,
    forward: targetForward,
    right: rotateVectorAroundAxis(basis.right, axis, angle),
    up: rotateVectorAroundAxis(basis.up, axis, angle),
  };
}

export function calculateCameraRoll(basis: CameraBasis): number {
  const levelRight = normalizeVector(crossProduct(basis.forward, { x: 0, y: 0, z: 1 }));
  if (!levelRight) {
    return 0;
  }
  const levelUp = normalizeVector(crossProduct(levelRight, basis.forward));
  if (!levelUp) {
    return 0;
  }

  return (Math.atan2(dotProduct(basis.up, levelRight), dotProduct(basis.up, levelUp)) * 180) / Math.PI;
}

export function calculateVideoCover(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): VideoCover {
  if (sourceWidth <= 0 || sourceHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0, renderedWidth: viewportWidth, renderedHeight: viewportHeight };
  }

  const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  return {
    scale,
    renderedWidth,
    renderedHeight,
    offsetX: (renderedWidth - viewportWidth) / 2,
    offsetY: (renderedHeight - viewportHeight) / 2,
  };
}

export function isTargetInFront(target: Vector3, basis: CameraBasis): boolean {
  return dotProduct(target, basis.forward) > EPSILON;
}

export function projectHorizontalTarget({
  target,
  basis,
  viewportWidth,
  viewportHeight,
  videoWidth = viewportWidth,
  videoHeight = viewportHeight,
  zoom = 1,
  longAxisFieldOfViewDegrees = DEFAULT_LONG_AXIS_FOV_DEGREES,
}: {
  target: Vector3;
  basis: CameraBasis;
  viewportWidth: number;
  viewportHeight: number;
  videoWidth?: number;
  videoHeight?: number;
  zoom?: number;
  longAxisFieldOfViewDegrees?: number;
}): ScreenProjection | null {
  const depth = dotProduct(target, basis.forward);
  if (depth <= EPSILON || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const safeVideoWidth = videoWidth > 0 ? videoWidth : viewportWidth;
  const safeVideoHeight = videoHeight > 0 ? videoHeight : viewportHeight;
  const safeFov = Math.max(20, Math.min(120, longAxisFieldOfViewDegrees));
  const safeZoom = Math.max(0.25, zoom);
  const focalLength = (Math.max(safeVideoWidth, safeVideoHeight) / (2 * Math.tan((safeFov * Math.PI) / 360))) * safeZoom;
  const sourceX = safeVideoWidth / 2 + (dotProduct(target, basis.right) / depth) * focalLength;
  const sourceY = safeVideoHeight / 2 - (dotProduct(target, basis.up) / depth) * focalLength;
  const cover = calculateVideoCover(safeVideoWidth, safeVideoHeight, viewportWidth, viewportHeight);
  const x = sourceX * cover.scale - cover.offsetX;
  const y = sourceY * cover.scale - cover.offsetY;

  return {
    x,
    y,
    depth,
    onScreen: x >= 0 && x <= viewportWidth && y >= 0 && y <= viewportHeight,
  };
}

function blendUnitVectors(previous: Vector3, next: Vector3, factor: number): Vector3 {
  return normalizeVector(addVectors(scaleVector(previous, 1 - factor), scaleVector(next, factor))) ?? next;
}

export function smoothCameraBasis(previous: CameraBasis | null, next: CameraBasis): CameraBasis {
  if (!previous || previous.confidence !== next.confidence) {
    return next;
  }

  const forwardDot = Math.max(-1, Math.min(1, dotProduct(previous.forward, next.forward)));
  const jumpDegrees = (Math.acos(forwardDot) * 180) / Math.PI;
  if (jumpDegrees > 55) {
    return next;
  }

  // Small tremors get more damping; deliberate movement catches up quickly.
  const factor = jumpDegrees > 12 ? 0.58 : 0.2;
  const forward = blendUnitVectors(previous.forward, next.forward, factor);
  const tentativeRight = blendUnitVectors(previous.right, next.right, factor);
  const up = normalizeVector(crossProduct(tentativeRight, forward)) ?? next.up;
  const right = normalizeVector(crossProduct(forward, up)) ?? next.right;

  return { forward, right, up, confidence: next.confidence };
}
