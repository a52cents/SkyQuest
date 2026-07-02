import assert from "node:assert/strict";
import test from "node:test";
import {
  getAltitudeArrow,
  getCameraErrorMessage,
  getDirectionArrow,
  readCameraZoomRange,
} from "../components/camera/camera-utils.ts";

test("camera guide arrows cover aligned and non-aligned states", () => {
  assert.equal(getDirectionArrow(0), "◎");
  assert.equal(getDirectionArrow(30), "→");
  assert.equal(getDirectionArrow(-30), "←");
  assert.equal(getAltitudeArrow(0), "◎");
  assert.equal(getAltitudeArrow(20), "↑");
  assert.equal(getAltitudeArrow(-20), "↓");
});

test("camera zoom capabilities degrade safely", () => {
  assert.deepEqual(readCameraZoomRange({ zoom: { min: 1, max: 4, step: 0.5 } }), {
    min: 1,
    max: 4,
    step: 0.5,
  });
  assert.equal(readCameraZoomRange({}), null);
  assert.equal(readCameraZoomRange({ zoom: { min: 2, max: 2 } }), null);
});

test("camera permission denial keeps a useful fallback message", () => {
  const message = getCameraErrorMessage(new DOMException("denied", "NotAllowedError"));
  assert.match(message, /permissions/i);
});
