"use client";

import { type ChangeEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
import { haptic } from "@/lib/haptics";
import {
  angleDifference,
  azimuthToCardinal,
  getAltitudeHint,
  getDirectionHint,
} from "@/lib/orientation";
import { recalculateQuestPosition } from "@/lib/quest-generator";
import { getLastLocation } from "@/lib/storage";
import { CameraControls } from "./CameraControls";
import { CameraCalibrationPanel } from "./CameraCalibrationPanel";
import { CameraDetailsPanel, type CameraDetailsState } from "./CameraDetailsPanel";
import { CameraHud } from "./CameraHud";
import { CameraPhotoPanel } from "./CameraPhotoPanel";
import { CameraSetupPanel } from "./CameraSetupPanel";
import { CameraVideoScene } from "./CameraVideoScene";
import {
  ALTITUDE_ALIGNMENT_THRESHOLD_DEGREES,
  DIRECTION_ALIGNMENT_THRESHOLD_DEGREES,
  applyHorizontalCalibration,
  formatZoom,
  getAltitudeArrow,
  getCameraErrorMessage,
  getCameraSettings,
  getDirectionArrow,
  getGuidanceReliability,
  readCameraCapabilities,
  readCameraZoomRange,
} from "./camera-utils";
import { createPhotoDraftFromFile } from "./photo-utils";
import type {
  CameraConstraintSet,
  CameraGuideProps,
  CameraStatus,
  CameraZoomRange,
  OrientationConfidence,
  OrientationStatus,
  PhotoCaptureStatus,
  PhotoDraft,
} from "./types";

type OrientationPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<PermissionState>;
};

export function CameraGuide({
  quest,
  persistenceError = null,
  onSeen,
  onMissed,
}: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasAlignedRef = useRef(false);
  const scenePointerRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    startedAt: number;
  } | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus>("idle");
  const [orientationError, setOrientationError] = useState<string | null>(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);
  const [orientationConfidence, setOrientationConfidence] = useState<OrientationConfidence>("low");
  const [currentAzimuth, setCurrentAzimuth] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [liveQuest, setLiveQuest] = useState(() =>
    quest.targetType === "satellite" ? { ...quest, azimuth: null, altitude: null } : quest,
  );
  const [zoomRange, setZoomRange] = useState<CameraZoomRange | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [zoomError, setZoomError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [horizontalCalibration, setHorizontalCalibration] = useState(0);
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [setupModalOpen, setSetupModalOpen] = useState(true);
  const [setupStarting, setSetupStarting] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoCaptureStatus, setPhotoCaptureStatus] = useState<PhotoCaptureStatus>("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const sensorPointing = useDeviceOrientation(orientationEnabled);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const previousTop = body.style.top;
    body.style.top = `-${scrollY}px`;
    body.classList.add("camera-guide-lock");

    return () => {
      body.classList.remove("camera-guide-lock");
      body.style.top = previousTop;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (sensorPointing.source === "unavailable") return;
    setOrientationConfidence(
      sensorPointing.source === "absolute-sensor"
        ? "high"
        : sensorPointing.source === "webkit-compass"
          ? "medium"
          : "low",
    );
    if (sensorPointing.azimuth !== null) setCurrentAzimuth(sensorPointing.azimuth);
    if (sensorPointing.altitude !== null) setCurrentAltitude(sensorPointing.altitude);
  }, [sensorPointing]);

  useEffect(() => {
    setLiveQuest(
      quest.targetType === "satellite" ? { ...quest, azimuth: null, altitude: null } : quest,
    );
    setHorizontalCalibration(0);
  }, [quest]);

  useEffect(() => {
    const location = getLastLocation();
    if (!location) return;
    const refreshPosition = () =>
      setLiveQuest((currentQuest) =>
        recalculateQuestPosition({
          quest: currentQuest,
          latitude: location.latitude,
          longitude: location.longitude,
          now: new Date(),
        }),
      );
    refreshPosition();
    const intervalId = window.setInterval(
      refreshPosition,
      quest.targetType === "satellite" ? 1_000 : 30_000,
    );
    return () => window.clearInterval(intervalId);
  }, [quest.targetType]);

  function configureCameraControls(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    const capabilities = track ? readCameraCapabilities(track) : null;
    const range = capabilities ? readCameraZoomRange(capabilities) : null;
    const settings = track ? getCameraSettings(track) : null;
    setZoomRange(range);
    setCurrentZoom(range ? (settings?.zoom ?? range.min) : null);
    setZoomError(null);
  }

  async function startCamera(): Promise<boolean> {
    setCameraError(null);
    setZoomError(null);
    setZoomRange(null);
    setCurrentZoom(null);
    if (!isSecureBrowserContext()) {
      setCameraStatus("error");
      setCameraError(getInsecureContextMessage("camera"));
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraError("La camera n'est pas disponible dans ce navigateur.");
      return false;
    }
    setCameraStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      configureCameraControls(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus("active");
      return true;
    } catch (error) {
      haptic("error");
      setCameraStatus("error");
      setCameraError(getCameraErrorMessage(error));
      return false;
    }
  }

  async function applyCameraSetting(constraints: CameraConstraintSet) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [constraints] });
      setCurrentZoom(getCameraSettings(track).zoom ?? currentZoom);
      setZoomError(null);
    } catch {
      setZoomError("Zoom indisponible sur cette camera.");
    }
  }

  async function requestOrientation(): Promise<boolean> {
    setOrientationError(null);
    if (!isSecureBrowserContext()) {
      setOrientationStatus("denied");
      setOrientationError(getInsecureContextMessage("orientation"));
      return false;
    }
    const hasAbsoluteSensor = "AbsoluteOrientationSensor" in window;
    const hasDeviceOrientation = "DeviceOrientationEvent" in window;
    if (!hasAbsoluteSensor && !hasDeviceOrientation) {
      setOrientationStatus("unsupported");
      setOrientationError("L'orientation n'est pas disponible sur ce navigateur.");
      return false;
    }
    try {
      const eventType = hasDeviceOrientation
        ? (DeviceOrientationEvent as OrientationPermissionEvent)
        : null;
      if (typeof eventType?.requestPermission === "function") {
        const permission = await eventType.requestPermission(true);
        if (permission !== "granted") {
          haptic("error");
          setOrientationStatus("denied");
          setOrientationError(
            "Orientation refusee. Verifie les permissions mouvement et orientation.",
          );
          return false;
        }
      }
      setOrientationEnabled(true);
      setOrientationStatus("active");
      return true;
    } catch {
      haptic("error");
      setOrientationStatus("denied");
      setOrientationError(
        "Orientation refusee ou indisponible. Utilise la direction texte comme repere.",
      );
      return false;
    }
  }

  async function activateGuidance() {
    if (setupStarting) return;
    setSetupStarting(true);
    const orientationReady = orientationStatus === "active" || (await requestOrientation());
    const cameraReady = cameraStatus === "active" || (await startCamera());
    setSetupStarting(false);
    if (orientationReady || cameraReady) setSetupModalOpen(false);
  }

  async function handleFilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoSheetOpen(true);
    setPhotoDraft(null);
    setPhotoCaptureStatus("capturing");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Le fichier choisi n'est pas une image.");
      setPhotoCaptureStatus("error");
      return;
    }
    try {
      setPhotoError(null);
      setPhotoDraft(await createPhotoDraftFromFile(file));
      setPhotoCaptureStatus("ready");
    } catch {
      setPhotoError("Image impossible a lire.");
      setPhotoCaptureStatus("error");
    }
  }

  function openNativePhotoCapture() {
    const input = fileInputRef.current;
    if (!input) {
      setPhotoError("La capture photo native n'est pas disponible sur cet appareil.");
      return;
    }
    try {
      setPhotoError(null);
      input.click();
    } catch {
      setPhotoError("La capture photo native n'est pas disponible sur cet appareil.");
    }
  }

  function openOptionalPhotoPanel() {
    setPhotoDraft(null);
    setPhotoError(null);
    setPhotoCaptureStatus("idle");
    setPhotoSheetOpen(true);
  }

  function handleScenePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-camera-control]")) {
      scenePointerRef.current = null;
      return;
    }
    scenePointerRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startedAt: performance.now(),
    };
  }

  function handleSceneTap(event: PointerEvent<HTMLElement>) {
    const pointerStart = scenePointerRef.current;
    scenePointerRef.current = null;
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-camera-control]")) {
      return;
    }
    if (
      !pointerStart ||
      pointerStart.pointerId !== event.pointerId ||
      Math.hypot(event.clientX - pointerStart.clientX, event.clientY - pointerStart.clientY) > 10 ||
      performance.now() - pointerStart.startedAt > 500
    ) {
      return;
    }
    setIsHudVisible((visible) => !visible);
  }

  function beginSubmission(): boolean {
    if (isSubmittingRef.current) return false;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    return true;
  }

  async function submitObservation(action: () => Promise<boolean>) {
    if (!beginSubmission()) return;
    let succeeded = false;
    try {
      succeeded = await action();
    } finally {
      if (!succeeded) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  }

  function handleSeenWithoutPhoto() {
    void submitObservation(() => onSeen());
  }

  function handleSeenWithPhoto() {
    if (!photoDraft) return;
    void submitObservation(() => onSeen(photoDraft));
  }

  function handleMissed() {
    void submitObservation(onMissed);
  }

  function closePhotoPanel() {
    setPhotoSheetOpen(false);
    setPhotoDraft(null);
    setPhotoError(null);
    setPhotoCaptureStatus("idle");
  }

  const calibratedTargetAzimuth = applyHorizontalCalibration(
    liveQuest.azimuth,
    horizontalCalibration,
  );
  const sensorReliability = getGuidanceReliability(
    orientationStatus,
    orientationConfidence,
    currentAzimuth,
  );
  const guidanceReliability =
    calibratedTargetAzimuth === null ? "text_recommended" : sensorReliability;
  const directionHint =
    calibratedTargetAzimuth !== null && currentAzimuth !== null
      ? getDirectionHint(currentAzimuth, calibratedTargetAzimuth)
      : null;
  const altitudeHint =
    liveQuest.altitude !== null && currentAltitude !== null
      ? getAltitudeHint(currentAltitude, liveQuest.altitude)
      : null;
  const directionDelta =
    calibratedTargetAzimuth !== null && currentAzimuth !== null
      ? angleDifference(currentAzimuth, calibratedTargetAzimuth)
      : null;
  const altitudeDelta =
    liveQuest.altitude !== null && currentAltitude !== null
      ? liveQuest.altitude - currentAltitude
      : null;
  const directionArrow = getDirectionArrow(directionDelta);
  const altitudeArrow = getAltitudeArrow(altitudeDelta);
  const isAligned =
    directionDelta !== null &&
    altitudeDelta !== null &&
    Math.abs(directionDelta) <= DIRECTION_ALIGNMENT_THRESHOLD_DEGREES &&
    Math.abs(altitudeDelta) <= ALTITUDE_ALIGNMENT_THRESHOLD_DEGREES;
  const targetAltitudeLabel =
    liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre";
  const guidance = {
    isAligned,
    hasPrecisePoint: liveQuest.azimuth !== null && liveQuest.altitude !== null,
    directionArrow,
    altitudeArrow,
    mainHint: isAligned
      ? `${liveQuest.target} est près du centre`
      : liveQuest.targetType === "satellite" && calibratedTargetAzimuth === null
        ? `Le satellite se déplace vite — suis surtout la direction ${liveQuest.cardinalDirection ?? "indiquée"}`
        : directionHint && directionHint !== "Bonne direction"
          ? directionHint
          : altitudeHint && altitudeHint !== "Hauteur proche"
            ? altitudeHint
            : `Cherche ${liveQuest.target} dans le ciel`,
    targetAltitudeLabel,
  };

  useEffect(() => {
    if (isAligned && !wasAlignedRef.current) haptic("align");
    wasAlignedRef.current = isAligned;
  }, [isAligned]);

  const detailsState: CameraDetailsState = {
    currentAzimuth,
    currentAltitude,
    currentPhoneDirection: currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu",
    targetAltitudeLabel,
    directionArrowLabel:
      directionDelta !== null ? `${directionArrow} ${Math.abs(Math.round(directionDelta))}°` : "-",
    altitudeArrowLabel:
      altitudeDelta !== null ? `${altitudeArrow} ${Math.abs(Math.round(altitudeDelta))}°` : "-",
    zoomLabel: zoomRange && currentZoom !== null ? `${formatZoom(currentZoom)}x` : "Auto",
    orientationStatus,
    orientationConfidence,
    orientationError,
    guidanceReliability,
    horizontalCalibration,
  };

  return (
    <CameraVideoScene
      videoRef={videoRef}
      isCameraReady={cameraStatus === "active"}
      onScenePointerDown={handleScenePointerDown}
      onScenePointerUp={handleSceneTap}
    >
      {isHudVisible ? (
        <CameraHud
          quest={liveQuest}
          guidance={guidance}
          reliability={guidanceReliability}
          isCalibrated={horizontalCalibration !== 0}
          onOpenDetails={() => setDetailsOpen(true)}
        >
          <CameraControls
            camera={{ status: cameraStatus, error: cameraError }}
            zoom={{ range: zoomRange, value: currentZoom, error: zoomError }}
            submitting={isSubmitting}
            persistenceError={persistenceError}
            nativePhotoError={!photoSheetOpen ? photoError : null}
            guidanceReliability={guidanceReliability}
            isCalibrated={horizontalCalibration !== 0}
            onZoomChange={(value) => {
              setCurrentZoom(value);
              void applyCameraSetting({ zoom: value });
            }}
            onFound={handleSeenWithoutPhoto}
            onMissed={handleMissed}
            onPhoto={openOptionalPhotoPanel}
            onStartCamera={() => void startCamera()}
            onRecalibrate={() => setCalibrationOpen(true)}
          />
        </CameraHud>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-camera-control
        onChange={handleFilePhoto}
      />
      <CameraSetupPanel
        open={setupModalOpen}
        starting={setupStarting}
        cameraError={cameraError}
        orientationError={orientationError}
        onActivate={() => void activateGuidance()}
        onContinueWithoutSensors={() => setSetupModalOpen(false)}
      />
      <CameraDetailsPanel
        open={detailsOpen}
        quest={liveQuest}
        state={detailsState}
        onClose={() => setDetailsOpen(false)}
      />
      <CameraCalibrationPanel
        open={calibrationOpen}
        horizontalOffset={horizontalCalibration}
        reliability={guidanceReliability}
        onOffsetChange={setHorizontalCalibration}
        onReset={() => setHorizontalCalibration(0)}
        onClose={() => setCalibrationOpen(false)}
      />
      <CameraPhotoPanel
        open={photoSheetOpen}
        draft={photoDraft}
        status={photoCaptureStatus}
        error={photoError ?? persistenceError}
        submitting={isSubmitting}
        onSaveWithPhoto={handleSeenWithPhoto}
        onContinueWithoutPhoto={handleSeenWithoutPhoto}
        onClose={closePhotoPanel}
        onChoosePhoto={openNativePhotoCapture}
      />
    </CameraVideoScene>
  );
}
