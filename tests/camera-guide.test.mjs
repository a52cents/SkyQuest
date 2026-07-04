import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyHorizontalCalibration,
  getAltitudeArrow,
  getCameraErrorMessage,
  getDirectionArrow,
  getGuidanceReliability,
  readCameraZoomRange,
} from "../components/camera/camera-utils.ts";

const cameraGuideSource = readFileSync(
  new URL("../components/camera/CameraGuide.tsx", import.meta.url),
  "utf8",
);
const calibrationPanelSource = readFileSync(
  new URL("../components/camera/CameraCalibrationPanel.tsx", import.meta.url),
  "utf8",
);
const cameraControlsSource = readFileSync(
  new URL("../components/camera/CameraControls.tsx", import.meta.url),
  "utf8",
);

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

test("manual horizontal calibration stays bounded and crosses north safely", () => {
  assert.equal(applyHorizontalCalibration(350, 20), 10);
  assert.equal(applyHorizontalCalibration(10, 100), 55);
  assert.equal(applyHorizontalCalibration(10, -100), 325);
  assert.equal(applyHorizontalCalibration(null, 20), null);
});

test("guidance reliability clearly separates sensors from text fallback", () => {
  assert.equal(getGuidanceReliability("active", "high", 120), "reliable");
  assert.equal(getGuidanceReliability("active", "medium", 120), "approximate");
  assert.equal(getGuidanceReliability("active", "low", null), "text_recommended");
  assert.equal(getGuidanceReliability("denied", "high", 120), "text_recommended");
});

test("camera guidance exposes a temporary manual recalibration flow", () => {
  assert.match(cameraGuideSource, /applyHorizontalCalibration/);
  assert.match(cameraGuideSource, /setHorizontalCalibration\(0\)/);
  assert.match(cameraControlsSource, /Recalibrer/);
  assert.match(cameraControlsSource, /Guidage fiable/);
  assert.match(cameraControlsSource, /Guidage approximatif/);
  assert.match(cameraControlsSource, /Guidage texte conseillé/);
  assert.match(calibrationPanelSource, /type="range"/);
  assert.match(calibrationPanelSource, /Cette correction reste sur cet écran/);
});
