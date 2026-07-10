import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyHorizontalCalibration,
  getAltitudeArrow,
  getCameraErrorMessage,
  getDirectionArrow,
  getGuidanceReliability,
  getOrientationConfidence,
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
const cameraPhotoPanelSource = readFileSync(
  new URL("../components/camera/CameraPhotoPanel.tsx", import.meta.url),
  "utf8",
);
const questPageSource = readFileSync(
  new URL("../app/quest/[id]/page.tsx", import.meta.url),
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

test("north reference controls orientation confidence", () => {
  assert.equal(
    getOrientationConfidence({
      azimuth: 120,
      source: "absolute-sensor",
      northReference: "magnetic",
      magneticDeclination: 2.1,
    }),
    "high",
  );
  assert.equal(
    getOrientationConfidence({
      azimuth: null,
      source: "absolute-sensor",
      northReference: "magnetic",
      magneticDeclination: null,
    }),
    "low",
  );
  assert.equal(
    getOrientationConfidence({
      azimuth: null,
      source: "tilt-only",
      northReference: "relative",
      magneticDeclination: null,
    }),
    "low",
  );
});

test("manual calibration remains a separate single target offset", () => {
  const trueSensorAzimuth = 5; // 350° magnetic + 15° WMM declination.
  const calibratedTarget = applyHorizontalCalibration(20, 10);
  assert.equal(calibratedTarget, 30);
  assert.equal(((calibratedTarget - trueSensorAzimuth + 540) % 360) - 180, 25);
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

test("found target submits immediately without a photo or opening the photo panel", () => {
  assert.match(
    cameraGuideSource,
    /function handleSeenWithoutPhoto\(\) \{[\s\S]*?submitObservation\(\(\) => onSeen\(\)\);[\s\S]*?\}/,
  );
  assert.match(cameraGuideSource, /onFound=\{handleSeenWithoutPhoto\}/);
  assert.doesNotMatch(cameraGuideSource, /handleTargetFound|capturePhotoFromVideo/);
  assert.doesNotMatch(cameraGuideSource, /videoWidth|videoHeight|createPhotoDraftFromImage/);
});

test("optional photo flow can save a chosen image or continue without one", () => {
  assert.match(cameraControlsSource, /Ajouter une photo souvenir/);
  assert.match(cameraControlsSource, /Optionnel/);
  assert.match(cameraGuideSource, /onPhoto=\{openOptionalPhotoPanel\}/);
  assert.match(cameraGuideSource, /setPhotoDraft\(await createPhotoDraftFromFile\(file\)\)/);
  assert.match(cameraGuideSource, /onSeen\(photoDraft\)/);
  assert.match(cameraPhotoPanelSource, /Enregistrer avec cette photo/);
  assert.match(cameraPhotoPanelSource, /Continuer sans photo/);
  assert.match(cameraPhotoPanelSource, /Retour au guidage/);
  assert.match(cameraPhotoPanelSource, /Une étoile ou une planète peut ne pas apparaître/);
  assert.doesNotMatch(cameraPhotoPanelSource, /Vérification|est-elle au centre|Pas centrée/);
});

test("camera result submission stays single and preserves missed and stream cleanup", () => {
  assert.match(cameraGuideSource, /isSubmittingRef\.current/);
  assert.match(questPageSource, /isLoggingRef\.current/);
  assert.match(cameraGuideSource, /function handleMissed\(\)[\s\S]*?submitObservation\(onMissed\)/);
  assert.match(cameraGuideSource, /if \(!succeeded\)[\s\S]*?setIsSubmitting\(false\)/);
  assert.match(questPageSource, /if \(!result\.persisted\)/);
  assert.match(questPageSource, /Rien n’a été ajouté à ton journal ni à ta progression/);
  assert.match(cameraControlsSource, /role="alert"/);
  assert.match(cameraGuideSource, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.doesNotMatch(cameraGuideSource, /haptic\("success"\)|haptic\("missed"\)/);
  assert.match(questPageSource, /haptic\(status === "seen" \? "success" : "missed"\)/);
  assert.match(cameraControlsSource, /hapticFeedback=\{false\}/);
  assert.match(cameraPhotoPanelSource, /hapticFeedback=\{false\}/);
});
