import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCameraBasisOffsets,
  calculateCameraRoll,
  calculateVideoCover,
  horizontalCoordinatesToVector,
  projectHorizontalTarget,
  rotateBasisForScreenOrientation,
  rotateVectorAroundAxis,
  resolveCameraBasis,
  smoothCameraBasis,
  vectorToHorizontalCoordinates,
} from "../lib/sky-projection.ts";

const basis = {
  forward: { x: 0, y: 1, z: 0 },
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 1 },
  confidence: "high",
};

const viewport = { viewportWidth: 400, viewportHeight: 800, videoWidth: 1080, videoHeight: 1920 };

test("a target on the optical axis projects to screen center", () => {
  const point = projectHorizontalTarget({ target: basis.forward, basis, ...viewport });
  assert.ok(point);
  assert.ok(Math.abs(point.x - 200) < 1e-8);
  assert.ok(Math.abs(point.y - 400) < 1e-8);
});

test("right and higher targets move right and up", () => {
  const right = projectHorizontalTarget({
    target: horizontalCoordinatesToVector(10, 0),
    basis,
    ...viewport,
  });
  const higher = projectHorizontalTarget({
    target: horizontalCoordinatesToVector(0, 10),
    basis,
    ...viewport,
  });
  assert.ok(right && right.x > 200);
  assert.ok(higher && higher.y < 400);
});

test("a target behind the camera is not projected", () => {
  assert.equal(
    projectHorizontalTarget({ target: horizontalCoordinatesToVector(180, 0), basis, ...viewport }),
    null,
  );
});

test("missing camera dimensions degrade safely instead of throwing", () => {
  const result = projectHorizontalTarget({
    target: basis.forward,
    basis,
    viewportWidth: 0,
    viewportHeight: 0,
    videoWidth: 0,
    videoHeight: 0,
  });
  assert.equal(result, null);
});

test("vector smoothing crosses north without a 359/0 jump", () => {
  const previous = { ...basis, forward: horizontalCoordinatesToVector(359, 10) };
  const next = { ...basis, forward: horizontalCoordinatesToVector(1, 10) };
  const result = smoothCameraBasis(previous, next);
  const horizontal = vectorToHorizontalCoordinates(result.forward);
  assert.ok(horizontal);
  assert.ok(horizontal.azimuth < 2 || horizontal.azimuth > 358);
});

test("camera roll and portrait/landscape rotation preserve an orthogonal basis", () => {
  const rolled = {
    ...basis,
    right: rotateVectorAroundAxis(basis.right, basis.forward, 30),
    up: rotateVectorAroundAxis(basis.up, basis.forward, 30),
  };
  assert.ok(Math.abs(Math.abs(calculateCameraRoll(rolled)) - 30) < 1e-8);
  const landscape = rotateBasisForScreenOrientation(basis, 90);
  assert.ok(Math.abs(landscape.right.z - 1) < 1e-8);
  assert.ok(Math.abs(landscape.up.x + 1) < 1e-8);
});

test("overlay basis resolution preserves supplied roll instead of rebuilding level axes", () => {
  const rolled = {
    ...basis,
    right: rotateVectorAroundAxis(basis.right, basis.forward, 30),
    up: rotateVectorAroundAxis(basis.up, basis.forward, 30),
  };
  const resolved = resolveCameraBasis({
    basis: rolled,
    azimuth: 0,
    altitude: 0,
    confidence: "high",
  });
  assert.equal(resolved, rolled);
  assert.ok(Math.abs(calculateCameraRoll(resolved) - 30) < 1e-8);
});

test("rolled camera rotates the visual right/up projection while retaining handedness", () => {
  const target = horizontalCoordinatesToVector(10, 10);
  const level = projectHorizontalTarget({ target, basis, ...viewport });
  const rolledBasis = {
    ...basis,
    right: rotateVectorAroundAxis(basis.right, basis.forward, 30),
    up: rotateVectorAroundAxis(basis.up, basis.forward, 30),
  };
  const rolled = projectHorizontalTarget({ target, basis: rolledBasis, ...viewport });
  assert.ok(level && rolled);
  assert.ok(level.x > 200 && level.y < 400);
  assert.ok(rolled.x > 200);
  assert.ok(Math.abs(rolled.x - level.x) > 1 && Math.abs(rolled.y - level.y) > 1);
});

test("object-fit cover keeps source center at viewport center", () => {
  const cover = calculateVideoCover(1920, 1080, 390, 844);
  assert.ok(Math.abs(960 * cover.scale - cover.offsetX - 195) < 1e-8);
  assert.ok(Math.abs(540 * cover.scale - cover.offsetY - 422) < 1e-8);
});

test("zoom increases projected displacement", () => {
  const target = horizontalCoordinatesToVector(8, 0);
  const normal = projectHorizontalTarget({ target, basis, ...viewport, zoom: 1 });
  const zoomed = projectHorizontalTarget({ target, basis, ...viewport, zoom: 2 });
  assert.ok(normal && zoomed);
  assert.ok(Math.abs((zoomed.x - 200) / (normal.x - 200) - 2) < 1e-8);
});

test("calibration offsets rotate the camera basis toward the reference", () => {
  const calibrated = applyCameraBasisOffsets(basis, 12, 8);
  const horizontal = vectorToHorizontalCoordinates(calibrated.forward);
  assert.ok(horizontal);
  assert.ok(Math.abs(horizontal.azimuth - 12) < 1e-8);
  assert.ok(Math.abs(horizontal.altitude - 8) < 1e-8);
});

test("front-facing constellation endpoints can be partially outside the viewport", () => {
  const inside = projectHorizontalTarget({
    target: horizontalCoordinatesToVector(2, 0),
    basis,
    ...viewport,
  });
  const outside = projectHorizontalTarget({
    target: horizontalCoordinatesToVector(60, 0),
    basis,
    ...viewport,
  });
  assert.ok(inside?.onScreen);
  assert.ok(outside && !outside.onScreen);
});
