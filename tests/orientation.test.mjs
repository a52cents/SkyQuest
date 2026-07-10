import assert from "node:assert/strict";
import test from "node:test";
import {
  azimuthToCardinal,
  convertAzimuthToTrueNorth,
  getCameraPointing,
  normalizeQuaternion,
  smoothCameraPointing,
} from "../lib/orientation.ts";
import { startOrientationTracking } from "../lib/orientation-tracker.ts";
import {
  dotProduct,
  horizontalCoordinatesToVector,
  rotateBasisForScreenOrientation,
  rotateVectorAroundAxis,
} from "../lib/sky-projection.ts";

const EPSILON = 1e-8;
const ZERO_DECLINATION = {
  available: true,
  declinationDegrees: 0,
  model: "WMM2025",
  epoch: 2025,
  validUntil: "2030-01-01",
  usedAltitudeFallback: true,
};

function assertClose(actual, expected, epsilon = EPSILON) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function assertVectorClose(actual, expected) {
  assertClose(actual.x, expected.x);
  assertClose(actual.y, expected.y);
  assertClose(actual.z, expected.z);
}

function assertOrthonormal(basis) {
  assertClose(Math.hypot(basis.forward.x, basis.forward.y, basis.forward.z), 1);
  assertClose(Math.hypot(basis.right.x, basis.right.y, basis.right.z), 1);
  assertClose(Math.hypot(basis.up.x, basis.up.y, basis.up.z), 1);
  assertClose(dotProduct(basis.forward, basis.right), 0);
  assertClose(dotProduct(basis.forward, basis.up), 0);
  assertClose(dotProduct(basis.right, basis.up), 0);
}

function basisToQuaternion(basis) {
  // Rotation columns are device +X/right, +Y/up and +Z/opposite camera forward.
  const m00 = basis.right.x;
  const m01 = basis.up.x;
  const m02 = -basis.forward.x;
  const m10 = basis.right.y;
  const m11 = basis.up.y;
  const m12 = -basis.forward.y;
  const m20 = basis.right.z;
  const m21 = basis.up.z;
  const m22 = -basis.forward.z;
  const trace = m00 + m11 + m22;
  let x;
  let y;
  let z;
  let w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return normalizeQuaternion([x, y, z, w]);
}

function levelBasis(azimuth, altitude = 0) {
  const forward = horizontalCoordinatesToVector(azimuth, altitude);
  const right = horizontalCoordinatesToVector(azimuth + 90, 0);
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  return { forward, right, up, confidence: "high" };
}

function poseForBasis(basis, screenAngle = 0) {
  return getCameraPointing(
    {
      alpha: null,
      beta: null,
      gamma: null,
      absoluteQuaternion: basisToQuaternion(basis),
      northReference: "true",
    },
    screenAngle,
  );
}

test("magnetic azimuth converts to true north across zero", () => {
  assert.equal(
    convertAzimuthToTrueNorth({
      azimuth: 350,
      northReference: "magnetic",
      magneticDeclinationDegrees: 15,
    }),
    5,
  );
  assert.equal(
    convertAzimuthToTrueNorth({
      azimuth: 5,
      northReference: "magnetic",
      magneticDeclinationDegrees: -15,
    }),
    350,
  );
  assert.equal(
    convertAzimuthToTrueNorth({
      azimuth: 42,
      northReference: "true",
      magneticDeclinationDegrees: 12,
    }),
    42,
  );
  for (const northReference of ["relative", "unknown", "unavailable"]) {
    assert.equal(
      convertAzimuthToTrueNorth({
        azimuth: 42,
        northReference,
        magneticDeclinationDegrees: 12,
      }),
      null,
    );
  }
  assert.equal(
    convertAzimuthToTrueNorth({
      azimuth: null,
      northReference: "magnetic",
      magneticDeclinationDegrees: 12,
    }),
    null,
  );
});

test("magnetic pose applies declination once and retains its raw azimuth", () => {
  const pose = getCameraPointing(
    {
      alpha: null,
      beta: null,
      gamma: null,
      absoluteQuaternion: basisToQuaternion(levelBasis(350)),
      northReference: "magnetic",
    },
    0,
    { ...ZERO_DECLINATION, declinationDegrees: 15 },
  );
  assertClose(pose.rawAzimuth, 350);
  assertClose(pose.azimuth, 5);
  assert.equal(pose.northReference, "magnetic");
  assert.equal(pose.magneticDeclination, 15);
});

test("uncorrected magnetic and relative poses do not invent true azimuth", () => {
  const quaternion = basisToQuaternion(levelBasis(90));
  const magnetic = getCameraPointing({
    alpha: null,
    beta: null,
    gamma: null,
    absoluteQuaternion: quaternion,
    northReference: "magnetic",
  });
  const relative = getCameraPointing({
    alpha: null,
    beta: null,
    gamma: null,
    absoluteQuaternion: quaternion,
    northReference: "relative",
  });
  assertClose(magnetic.rawAzimuth, 90);
  assert.equal(magnetic.azimuth, null);
  assert.equal(relative.azimuth, null);
  assert.ok(magnetic.basis && relative.basis);
});

test("portrait rear camera points north at the horizon", () => {
  const pose = poseForBasis(levelBasis(0));
  assertClose(pose.azimuth, 0);
  assertClose(pose.altitude, 0);
  assertClose(pose.roll, 0);
  assertOrthonormal(pose.basis);
});

test("portrait rear camera points east", () => {
  const pose = poseForBasis(levelBasis(90));
  assertClose(pose.azimuth, 90);
  assert.equal(azimuthToCardinal(pose.azimuth), "Est");
});

test("camera altitude is derived from its optical axis", () => {
  const pose = poseForBasis(levelBasis(0, 35));
  assertClose(pose.altitude, 35);
});

for (const roll of [30, -30]) {
  test(`rear camera preserves ${roll > 0 ? "+" : ""}${roll} degree roll`, () => {
    const base = levelBasis(0);
    const rolled = {
      ...base,
      right: rotateVectorAroundAxis(base.right, base.forward, roll),
      up: rotateVectorAroundAxis(base.up, base.forward, roll),
    };
    const pose = poseForBasis(rolled);
    assertClose(pose.roll, roll);
    assertVectorClose(pose.basis.right, rolled.right);
    assertOrthonormal(pose.basis);
  });
}

test("screen angles 0, 90, 180 and 270 rotate image axes exactly once", () => {
  const basePose = poseForBasis(levelBasis(0));
  for (const angle of [0, 90, 180, 270]) {
    const pose = poseForBasis(levelBasis(0), angle);
    const expected = rotateBasisForScreenOrientation(basePose.basis, angle);
    assertVectorClose(pose.basis.forward, expected.forward);
    assertVectorClose(pose.basis.right, expected.right);
    assertVectorClose(pose.basis.up, expected.up);
    assertOrthonormal(pose.basis);
  }
  const once = poseForBasis(levelBasis(0), 90).basis;
  const twice = rotateBasisForScreenOrientation(once, 90);
  assert.notDeepEqual(once.right, twice.right);
});

test("basis smoothing stays orthonormal and continuous across north", () => {
  const previous = poseForBasis(levelBasis(359, 10));
  const next = poseForBasis(levelBasis(1, 10));
  const smoothed = smoothCameraPointing(previous, next);
  assert.ok(smoothed.azimuth < 2 || smoothed.azimuth > 358);
  assertOrthonormal(smoothed.basis);
});

test("quaternions are normalized and invalid values degrade safely", () => {
  const valid = getCameraPointing({
    alpha: null,
    beta: null,
    gamma: null,
    absoluteQuaternion: basisToQuaternion(levelBasis(0)).map((value) => value * 4),
    northReference: "true",
  });
  assertClose(Math.hypot(...valid.quaternion), 1);
  const invalid = getCameraPointing({
    alpha: null,
    beta: null,
    gamma: null,
    absoluteQuaternion: [0, 0, 0, 0],
  });
  assert.equal(invalid.source, "unavailable");
  assert.equal(normalizeQuaternion([Number.NaN, 0, 0, 1]), null);
});

test("q and -q remain equivalent during smoothing", () => {
  const first = poseForBasis(levelBasis(20));
  const negated = first.quaternion.map((value) => -value);
  const second = getCameraPointing({
    alpha: null,
    beta: null,
    gamma: null,
    absoluteQuaternion: negated,
    northReference: "true",
  });
  const smoothed = smoothCameraPointing(first, second);
  assert.deepEqual(smoothed.quaternion, first.quaternion);
  assertVectorClose(smoothed.basis.forward, first.basis.forward);
});

test("beta-only fallback keeps altitude without inventing north", () => {
  const pose = getCameraPointing({ alpha: null, beta: 120, gamma: null });
  assert.equal(pose.azimuth, null);
  assert.equal(pose.altitude, 30);
  assert.equal(pose.basis, null);
  assert.equal(pose.source, "tilt-only");
});

test("Safari compass heading is not inverted by 180 degrees", () => {
  const reading = (webkitCompassHeading) =>
    getCameraPointing({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading }, 0, ZERO_DECLINATION);
  const east = reading(90);
  const southWest = reading(225);
  assertClose(east.azimuth, 90);
  assert.equal(azimuthToCardinal(east.azimuth), "Est");
  assertClose(southWest.azimuth, 225);
  assert.equal(southWest.source, "webkit-compass");
  assertOrthonormal(east.basis);
});

test("tracker recomputes on screen changes and cleans listeners and sensor", () => {
  const windowTarget = new EventTarget();
  const screenTarget = new EventTarget();
  let screenAngle = 0;
  let constructorOptions;
  class FakeSensor extends EventTarget {
    static latest;
    quaternion = basisToQuaternion(levelBasis(0));
    stopped = false;
    constructor(options) {
      super();
      constructorOptions = options;
      FakeSensor.latest = this;
    }
    start() {}
    stop() {
      this.stopped = true;
    }
  }
  const poses = [];
  const stop = startOrientationTracking(
    {
      windowTarget,
      screenOrientationTarget: screenTarget,
      hasDeviceOrientation: true,
      getScreenAngle: () => screenAngle,
      SensorConstructor: FakeSensor,
      getMagneticDeclination: () => ZERO_DECLINATION,
    },
    (pose) => poses.push(pose),
  );
  assert.deepEqual(constructorOptions, { frequency: 30, referenceFrame: "device" });
  FakeSensor.latest.dispatchEvent(new Event("reading"));
  screenAngle = 90;
  screenTarget.dispatchEvent(new Event("change"));
  assert.equal(poses.length, 2);
  assert.equal(poses[1].screenAngle, 90);
  stop();
  assert.equal(FakeSensor.latest.stopped, true);
  screenAngle = 180;
  screenTarget.dispatchEvent(new Event("change"));
  windowTarget.dispatchEvent(new Event("deviceorientation"));
  assert.equal(poses.length, 2);
});

test("tracker labels browser north references without promoting relative events", () => {
  const windowTarget = new EventTarget();
  const poses = [];
  const stop = startOrientationTracking(
    {
      windowTarget,
      screenOrientationTarget: null,
      hasDeviceOrientation: true,
      getScreenAngle: () => 0,
      getMagneticDeclination: () => ZERO_DECLINATION,
    },
    (pose) => poses.push(pose),
  );
  windowTarget.dispatchEvent(
    Object.assign(new Event("deviceorientationabsolute"), {
      alpha: 0,
      beta: 90,
      gamma: 0,
      absolute: true,
    }),
  );
  assert.equal(poses.at(-1).northReference, "magnetic");
  assert.equal(poses.at(-1).source, "device-orientation-absolute");
  assert.notEqual(poses.at(-1).azimuth, null);

  windowTarget.dispatchEvent(
    Object.assign(new Event("deviceorientation"), {
      alpha: 0,
      beta: 90,
      gamma: 0,
      absolute: false,
    }),
  );
  assert.equal(poses.at(-1).northReference, "relative");
  assert.equal(poses.at(-1).azimuth, null);

  windowTarget.dispatchEvent(
    Object.assign(new Event("deviceorientation"), {
      alpha: 0,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 90,
    }),
  );
  assert.equal(poses.at(-1).northReference, "magnetic");
  assert.equal(poses.at(-1).source, "webkit-compass");
  assertClose(poses.at(-1).azimuth, 90);
  stop();
});
