"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
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
import { CameraDetailsPanel, type CameraDetailsState } from "./CameraDetailsPanel";
import { CameraHud } from "./CameraHud";
import { CameraPhotoPanel } from "./CameraPhotoPanel";
import { CameraSetupPanel } from "./CameraSetupPanel";
import { CameraVideoScene } from "./CameraVideoScene";
import {
  ALTITUDE_ALIGNMENT_THRESHOLD_DEGREES,
  DIRECTION_ALIGNMENT_THRESHOLD_DEGREES,
  formatZoom,
  getAltitudeArrow,
  getCameraErrorMessage,
  getCameraSettings,
  getDirectionArrow,
  readCameraCapabilities,
  readCameraZoomRange,
} from "./camera-utils";
import { createPhotoDraftFromFile, createPhotoDraftFromImage } from "./photo-utils";
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

export function CameraGuide({ quest, onSeen, onMissed }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasAlignedRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus>("idle");
  const [orientationError, setOrientationError] = useState<string | null>(null);
  const [orientationEnabled, setOrientationEnabled] = useState(false);
  const [orientationConfidence, setOrientationConfidence] = useState<OrientationConfidence>("low");
  const [currentAzimuth, setCurrentAzimuth] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [liveQuest, setLiveQuest] = useState(quest);
  const [zoomRange, setZoomRange] = useState<CameraZoomRange | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [zoomError, setZoomError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(true);
  const [setupStarting, setSetupStarting] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoCaptureStatus, setPhotoCaptureStatus] = useState<PhotoCaptureStatus>("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const sensorPointing = useDeviceOrientation(orientationEnabled);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

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

  useEffect(() => setLiveQuest(quest), [quest]);

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
    const intervalId = window.setInterval(refreshPosition, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  async function capturePhotoFromVideo(): Promise<PhotoDraft | null> {
    setPhotoError(null);
    const video = videoRef.current;
    if (!video || cameraStatus !== "active" || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setPhotoError(
        "La caméra n'est pas prête. Tu peux choisir une photo ou continuer sans photo.",
      );
      return null;
    }
    try {
      return await createPhotoDraftFromImage(video, video.videoWidth, video.videoHeight);
    } catch {
      setPhotoError(
        "Photo impossible depuis la caméra. Tu peux choisir une image ou continuer sans photo.",
      );
      return null;
    }
  }

  async function handleFilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setPhotoError(null);
      setPhotoDraft(await createPhotoDraftFromFile(file));
      setPhotoCaptureStatus("ready");
    } catch {
      setPhotoError("Image impossible a lire.");
      setPhotoCaptureStatus("error");
    }
  }

  async function handleTargetFound() {
    setPhotoDraft(null);
    setPhotoError(null);
    setPhotoSheetOpen(true);
    setPhotoCaptureStatus("capturing");
    const draft = await capturePhotoFromVideo();
    setPhotoDraft(draft);
    setPhotoCaptureStatus(draft ? "ready" : "error");
  }

  function saveSeenWithPhoto() {
    haptic("success");
    onSeen(photoDraft ?? undefined);
  }

  function handleMissed() {
    haptic("missed");
    onMissed();
  }

  function retakeTargetPhoto() {
    setPhotoSheetOpen(false);
    setPhotoDraft(null);
    setPhotoError(null);
    setPhotoCaptureStatus("idle");
  }

  const directionHint =
    liveQuest.azimuth !== null && currentAzimuth !== null
      ? getDirectionHint(currentAzimuth, liveQuest.azimuth)
      : null;
  const altitudeHint =
    liveQuest.altitude !== null && currentAltitude !== null
      ? getAltitudeHint(currentAltitude, liveQuest.altitude)
      : null;
  const directionDelta =
    liveQuest.azimuth !== null && currentAzimuth !== null
      ? angleDifference(currentAzimuth, liveQuest.azimuth)
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
  };

  return (
    <CameraVideoScene videoRef={videoRef} isCameraReady={cameraStatus === "active"}>
      <CameraHud
        quest={liveQuest}
        guidance={guidance}
        orientation={{ status: orientationStatus, confidence: orientationConfidence }}
        onOpenDetails={() => setDetailsOpen(true)}
      >
        <CameraControls
          camera={{ status: cameraStatus, error: cameraError }}
          zoom={{ range: zoomRange, value: currentZoom, error: zoomError }}
          photoStatus={photoCaptureStatus}
          onZoomChange={(value) => {
            setCurrentZoom(value);
            void applyCameraSetting({ zoom: value });
          }}
          onFound={() => void handleTargetFound()}
          onMissed={handleMissed}
          onStartCamera={() => void startCamera()}
        />
      </CameraHud>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
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
      <CameraPhotoPanel
        open={photoSheetOpen}
        target={liveQuest.target}
        draft={photoDraft}
        status={photoCaptureStatus}
        error={photoError}
        onSave={saveSeenWithPhoto}
        onRetake={retakeTargetPhoto}
        onChoosePhoto={() => fileInputRef.current?.click()}
      />
    </CameraVideoScene>
  );
}
