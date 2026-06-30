"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import {
  ALIGNMENT_TOLERANCE_DEGREES,
  angleDifference,
  azimuthToCardinal,
  getAltitudeHint,
  getCameraPointing,
  getDirectionHint,
} from "@/lib/orientation";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
import { recalculateQuestPosition } from "@/lib/quest-generator";
import { getLastLocation } from "@/lib/storage";
import type { Observation, SkyQuest } from "@/lib/types";

const SHOW_CAMERA_DEBUG = false;
const PHOTO_MAX_WIDTH = 1280;
const THUMBNAIL_MAX_WIDTH = 360;
const PHOTO_QUALITY = 0.75;

type CameraGuideProps = {
  quest: SkyQuest;
  onSeen: (photo?: Pick<Observation, "photoDataUrl" | "photoThumbnailDataUrl">) => void;
  onMissed: () => void;
};

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type OrientationPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<PermissionState>;
};

type CameraZoomRange = {
  min: number;
  max: number;
  step: number;
};

type CameraNumericRange = {
  min?: number;
  max?: number;
  step?: number;
};

type CameraCapabilities = MediaTrackCapabilities & {
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
  torch?: boolean;
  exposureCompensation?: CameraNumericRange;
  exposureTime?: CameraNumericRange;
  focusDistance?: CameraNumericRange;
  exposureMode?: string[];
  focusMode?: string[];
};

type CameraSettings = MediaTrackSettings & {
  zoom?: number;
  torch?: boolean;
  exposureCompensation?: number;
  exposureTime?: number;
  focusDistance?: number;
  exposureMode?: string;
  focusMode?: string;
};

type CameraConstraintSet = MediaTrackConstraintSet & {
  zoom?: number;
  torch?: boolean;
  exposureCompensation?: number;
  exposureTime?: number;
  focusDistance?: number;
  exposureMode?: string;
  focusMode?: string;
};

type PhotoDraft = {
  photoDataUrl: string;
  photoThumbnailDataUrl: string;
};

function getDirectionArrow(delta: number | null): string {
  if (delta === null) {
    return "";
  }

  if (Math.abs(delta) <= ALIGNMENT_TOLERANCE_DEGREES) {
    return "•";
  }

  return delta > 0 ? "→" : "←";
}

function getAltitudeArrow(delta: number | null): string {
  if (delta === null) {
    return "";
  }

  if (Math.abs(delta) <= ALIGNMENT_TOLERANCE_DEGREES) {
    return "•";
  }

  return delta > 0 ? "↑" : "↓";
}

function getGearLabel(quest: SkyQuest): string {
  return quest.requiredGear === "binoculars_recommended" ? "Jumelles" : "Oeil nu";
}

async function createResizedDataUrl(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxWidth: number): Promise<string> {
  const scale = Math.min(1, maxWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas indisponible.");
  }

  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

async function createPhotoDraftFromImage(source: CanvasImageSource, width: number, height: number): Promise<PhotoDraft> {
  const photoDataUrl = await createResizedDataUrl(source, width, height, PHOTO_MAX_WIDTH);
  const photoThumbnailDataUrl = await createResizedDataUrl(source, width, height, THUMBNAIL_MAX_WIDTH);

  return { photoDataUrl, photoThumbnailDataUrl };
}

async function createPhotoDraftFromFile(file: File): Promise<PhotoDraft> {
  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image illisible."));
      image.src = url;
    });

    return await createPhotoDraftFromImage(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand border border-brand-border bg-white/[0.05] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}

export function CameraGuide({ quest, onSeen, onMissed }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [orientationStatus, setOrientationStatus] = useState<"idle" | "active" | "denied" | "unsupported">("idle");
  const [orientationError, setOrientationError] = useState<string | null>(null);
  const [currentAzimuth, setCurrentAzimuth] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [liveQuest, setLiveQuest] = useState<SkyQuest>(quest);
  const [zoomRange, setZoomRange] = useState<CameraZoomRange | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [zoomError, setZoomError] = useState<string | null>(null);
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilities | null>(null);
  const [currentExposureCompensation, setCurrentExposureCompensation] = useState<number | null>(null);
  const [currentExposureTime, setCurrentExposureTime] = useState<number | null>(null);
  const [currentFocusDistance, setCurrentFocusDistance] = useState<number | null>(null);
  const [currentExposureMode, setCurrentExposureMode] = useState<string | null>(null);
  const [currentFocusMode, setCurrentFocusMode] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
  const [cameraSettingsError, setCameraSettingsError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation as EventListener);
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener);
    };
  }, []);

  useEffect(() => {
    setLiveQuest(quest);
  }, [quest]);

  useEffect(() => {
    const location = getLastLocation();
    if (!location) {
      return;
    }
    const lastLocation = location;

    function refreshPosition() {
      setLiveQuest((currentQuest) => recalculateQuestPosition({
        quest: currentQuest,
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        now: new Date(),
      }));
    }

    refreshPosition();
    const intervalId = window.setInterval(refreshPosition, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function startCamera() {
    setCameraError(null);
    setZoomError(null);
    setZoomRange(null);
    setCurrentZoom(null);
    setCameraCapabilities(null);
    setCameraSettingsError(null);
    setCurrentExposureCompensation(null);
    setCurrentExposureTime(null);
    setCurrentFocusDistance(null);
    setCurrentExposureMode(null);
    setCurrentFocusMode(null);
    setTorchEnabled(false);

    if (!isSecureBrowserContext()) {
      setCameraStatus("error");
      setCameraError(getInsecureContextMessage("camera"));
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraError("La camera n'est pas disponible dans ce navigateur.");
      return;
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
    } catch (error) {
      setCameraStatus("error");
      setCameraError(getCameraErrorMessage(error));
    }
  }

  function readCameraZoomRange(capabilities: CameraCapabilities): CameraZoomRange | null {
    const zoom = capabilities.zoom;
    if (!zoom || typeof zoom.min !== "number" || typeof zoom.max !== "number" || zoom.max <= zoom.min) {
      return null;
    }

    return {
      min: zoom.min,
      max: zoom.max,
      step: typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0.5,
    };
  }

  function readCameraCapabilities(track: MediaStreamTrack): CameraCapabilities | null {
    if (typeof track.getCapabilities !== "function") {
      return null;
    }

    return track.getCapabilities() as CameraCapabilities;
  }

  function getSettings(track: MediaStreamTrack): CameraSettings {
    return track.getSettings() as CameraSettings;
  }

  function configureCameraControls(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    const capabilities = track ? readCameraCapabilities(track) : null;
    const range = capabilities ? readCameraZoomRange(capabilities) : null;
    const settings = track ? getSettings(track) : null;

    setCameraCapabilities(capabilities);
    setZoomRange(range);
    setCurrentZoom(range ? settings?.zoom ?? range.min : null);
    setTorchEnabled(settings?.torch === true);
    setCurrentExposureCompensation(settings?.exposureCompensation ?? null);
    setCurrentExposureTime(settings?.exposureTime ?? null);
    setCurrentFocusDistance(settings?.focusDistance ?? null);
    setCurrentExposureMode(settings?.exposureMode ?? null);
    setCurrentFocusMode(settings?.focusMode ?? null);
    setZoomError(null);
    setCameraSettingsError(null);
  }

  function formatZoom(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }

  function getNextZoom(range: CameraZoomRange, current: number | null): number {
    const stops = [range.min, Math.min(2, range.max), Math.min(4, range.max), range.max]
      .filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) < 0.05) === index)
      .sort((a, b) => a - b);
    const activeZoom = current ?? range.min;
    const nextStop = stops.find((stop) => stop > activeZoom + range.step / 2);

    return nextStop ?? range.min;
  }

  async function toggleCameraZoom() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) {
      return;
    }

    const nextZoom = getNextZoom(zoomRange, currentZoom);

    try {
      await track.applyConstraints({
        advanced: [{ zoom: nextZoom } as CameraConstraintSet],
      });
      const settings = getSettings(track);
      setCurrentZoom(settings.zoom ?? nextZoom);
      setZoomError(null);
    } catch {
      setZoomError("Zoom indisponible sur cette camera.");
    }
  }

  async function applyCameraSetting(constraints: CameraConstraintSet) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({ advanced: [constraints] });
      const settings = getSettings(track);
      setCurrentZoom(settings.zoom ?? currentZoom);
      setTorchEnabled(settings.torch ?? torchEnabled);
      setCurrentExposureCompensation(settings.exposureCompensation ?? currentExposureCompensation);
      setCurrentExposureTime(settings.exposureTime ?? currentExposureTime);
      setCurrentFocusDistance(settings.focusDistance ?? currentFocusDistance);
      setCurrentExposureMode(settings.exposureMode ?? currentExposureMode);
      setCurrentFocusMode(settings.focusMode ?? currentFocusMode);
      setCameraSettingsError(null);
    } catch {
      setCameraSettingsError("Ce reglage n'est pas accepte par cette camera.");
    }
  }

  function getRangeValue(range: CameraNumericRange | undefined, fallbackStep: number): CameraZoomRange | null {
    if (!range || typeof range.min !== "number" || typeof range.max !== "number" || range.max <= range.min) {
      return null;
    }

    return {
      min: range.min,
      max: range.max,
      step: typeof range.step === "number" && range.step > 0 ? range.step : fallbackStep,
    };
  }

  function getCameraErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        return "Camera refusee. Verifie les permissions, puis relance le guidage.";
      }

      if (error.name === "NotFoundError") {
        return "Aucune camera disponible. Utilise le guidage texte.";
      }

      if (error.name === "NotReadableError") {
        return "La camera est deja utilisee ou indisponible momentanement.";
      }
    }

    return "Camera indisponible. Tu peux quand meme suivre la direction indiquee.";
  }

  function handleOrientation(event: CompassEvent) {
    const pointing = getCameraPointing({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      absolute: event.absolute === true,
      webkitCompassHeading: event.webkitCompassHeading,
    });
    if (pointing.azimuth !== null) {
      setCurrentAzimuth(pointing.azimuth);
    }
    if (pointing.altitude !== null) {
      setCurrentAltitude(pointing.altitude);
    }
  }

  async function requestOrientation() {
    setOrientationError(null);

    if (!isSecureBrowserContext()) {
      setOrientationStatus("denied");
      setOrientationError(getInsecureContextMessage("orientation"));
      return;
    }

    if (!("DeviceOrientationEvent" in window)) {
      setOrientationStatus("unsupported");
      setOrientationError("L'orientation n'est pas disponible sur ce navigateur.");
      return;
    }

    const orientationEvent = DeviceOrientationEvent as OrientationPermissionEvent;

    try {
      if (typeof orientationEvent.requestPermission === "function") {
        const permission = await orientationEvent.requestPermission(true);
        if (permission !== "granted") {
          setOrientationStatus("denied");
          setOrientationError("Orientation refusee. Verifie les permissions mouvement et orientation.");
          return;
        }
      }

      window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
      window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      setOrientationStatus("active");
    } catch {
      setOrientationStatus("denied");
      setOrientationError("Orientation refusee ou indisponible. Utilise la direction texte comme repere.");
    }
  }

  async function capturePhotoFromVideo() {
    setPhotoError(null);
    const video = videoRef.current;

    if (!video || cameraStatus !== "active" || video.videoWidth <= 0 || video.videoHeight <= 0) {
      fileInputRef.current?.click();
      return;
    }

    try {
      setPhotoDraft(await createPhotoDraftFromImage(video, video.videoWidth, video.videoHeight));
    } catch {
      setPhotoError("Photo impossible depuis la camera. Tu peux choisir une image.");
      fileInputRef.current?.click();
    }
  }

  async function handleFilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      setPhotoError(null);
      setPhotoDraft(await createPhotoDraftFromFile(file));
    } catch {
      setPhotoError("Image impossible a lire.");
    }
  }

  function openPhotoSheet() {
    setPhotoDraft(null);
    setPhotoError(null);
    setPhotoSheetOpen(true);
  }

  function saveSeenWithPhoto() {
    if (photoDraft) {
      onSeen(photoDraft);
      return;
    }

    onSeen();
  }

  const directionHint = liveQuest.azimuth !== null && currentAzimuth !== null
    ? getDirectionHint(currentAzimuth, liveQuest.azimuth)
    : null;
  const altitudeHint = liveQuest.altitude !== null && currentAltitude !== null
    ? getAltitudeHint(currentAltitude, liveQuest.altitude)
    : null;
  const close = directionHint === "Bonne direction" && altitudeHint === "Hauteur proche";
  const directionDelta = liveQuest.azimuth !== null && currentAzimuth !== null
    ? angleDifference(currentAzimuth, liveQuest.azimuth)
    : null;
  const altitudeDelta = liveQuest.altitude !== null && currentAltitude !== null
    ? liveQuest.altitude - currentAltitude
    : null;
  const directionArrow = getDirectionArrow(directionDelta);
  const altitudeArrow = getAltitudeArrow(altitudeDelta);
  const directionArrowLabel = directionDelta !== null ? `${directionArrow} ${Math.abs(Math.round(directionDelta))}°` : "-";
  const altitudeArrowLabel = altitudeDelta !== null ? `${altitudeArrow} ${Math.abs(Math.round(altitudeDelta))}°` : "-";
  const currentPhoneDirection = currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu";
  const directionAligned = directionDelta !== null && Math.abs(directionDelta) <= ALIGNMENT_TOLERANCE_DEGREES;
  const altitudeAligned = altitudeDelta !== null && Math.abs(altitudeDelta) <= ALIGNMENT_TOLERANCE_DEGREES;
  const hasPrecisePoint = liveQuest.azimuth !== null && liveQuest.altitude !== null;
  const mainHint = close
    ? "Tu es proche"
    : directionHint && directionHint !== "Bonne direction"
      ? directionHint
      : altitudeHint && altitudeHint !== "Hauteur proche"
        ? altitudeHint
        : "Suis la direction";
  const targetAltitudeLabel = liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre";
  const zoomLabel = zoomRange && currentZoom !== null ? `${formatZoom(currentZoom)}x` : "Auto";
  const exposureCompensationRange = getRangeValue(cameraCapabilities?.exposureCompensation, 0.1);
  const exposureTimeRange = getRangeValue(cameraCapabilities?.exposureTime, 0.01);
  const focusDistanceRange = getRangeValue(cameraCapabilities?.focusDistance, 0.1);
  const exposureModes = cameraCapabilities?.exposureMode ?? [];
  const focusModes = cameraCapabilities?.focusMode ?? [];
  const hasCameraSettings = Boolean(
    zoomRange ||
      cameraCapabilities?.torch ||
      exposureCompensationRange ||
      exposureTimeRange ||
      focusDistanceRange ||
      exposureModes.length > 0 ||
      focusModes.length > 0,
  );

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.30),rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.62))]" aria-hidden="true" />

      {cameraStatus !== "active" ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_srgb,var(--accent-cyan)_16%,transparent),transparent_20rem),var(--background)]" aria-hidden="true" />
      ) : null}

      <section className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <header className="flex min-h-14 items-center gap-2 rounded-brand-lg border border-white/10 bg-background/45 px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <Link href="/" aria-label="Quitter" className={getAppButtonClassName({ variant: "ghost", size: "sm", className: "min-h-0 h-10 w-10 px-0 text-lg" })}>
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-black tracking-[-0.02em] text-white">{liveQuest.title}</h1>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="h-10 rounded-full border border-white/10 bg-white/[0.08] px-3 text-sm font-black text-white"
          >
            Details
          </button>
        </header>

        <div className="pointer-events-none flex flex-1 flex-col items-center justify-center gap-5 py-8">
          {hasPrecisePoint ? (
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className={`absolute h-28 w-28 rounded-full border ${directionAligned && altitudeAligned ? "border-success/80 bg-success/10" : "border-accent-cyan/70 bg-accent-cyan/10"} shadow-[0_0_55px_color-mix(in_srgb,var(--accent-cyan)_22%,transparent)]`} />
              <div className="absolute h-px w-24 bg-white/28" />
              <div className="absolute h-24 w-px bg-white/28" />
              <div className={`h-3 w-3 rounded-full ${directionAligned && altitudeAligned ? "bg-success" : "bg-accent-cyan"}`} />
              <div className="absolute -right-9 text-5xl font-black text-white drop-shadow-xl">{directionArrow === "→" ? "→" : ""}</div>
              <div className="absolute -left-9 text-5xl font-black text-white drop-shadow-xl">{directionArrow === "←" ? "←" : ""}</div>
              <div className="absolute -top-11 text-4xl font-black text-accent-cyan drop-shadow-xl">{altitudeArrow === "↑" ? "↑" : ""}</div>
              <div className="absolute -bottom-11 text-4xl font-black text-accent-cyan drop-shadow-xl">{altitudeArrow === "↓" ? "↓" : ""}</div>
            </div>
          ) : (
            <div className="h-28 w-28 rounded-full border border-accent-cyan/60 bg-accent-cyan/10" />
          )}

          <p className="rounded-full border border-white/10 bg-background/50 px-5 py-3 text-center text-lg font-black shadow-[0_12px_42px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            {mainHint}
          </p>

          <div className="flex max-w-full flex-wrap justify-center gap-2">
            <span className="rounded-full border border-white/10 bg-background/45 px-3 py-2 text-sm font-bold text-white backdrop-blur-xl">
              {liveQuest.cardinalDirection ?? "Zone libre"}
            </span>
            <span className="rounded-full border border-white/10 bg-background/45 px-3 py-2 text-sm font-bold text-white backdrop-blur-xl">
              {targetAltitudeLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-background/45 px-3 py-2 text-sm font-bold text-white backdrop-blur-xl">
              {getGearLabel(liveQuest)}
            </span>
          </div>
        </div>

        <div className="rounded-brand-lg border border-white/10 bg-background/48 p-3 shadow-[0_-12px_44px_rgba(0,0,0,0.30)] backdrop-blur-xl">
          {cameraError ? <p className="mb-3 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">{cameraError}</p> : null}
          {zoomError ? <p className="mb-3 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">{zoomError}</p> : null}

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <AppButton variant="success" size="sm" onClick={openPhotoSheet} className="min-h-12">
              Je l&apos;ai vu
            </AppButton>
            <AppButton variant="ghost" size="sm" onClick={onMissed} className="min-h-12">
              Pas trouve
            </AppButton>
            <button
              type="button"
              onClick={openPhotoSheet}
              aria-label="Photo"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xl font-black text-white"
            >
              ◉
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {cameraStatus !== "active" ? (
              <AppButton variant="secondary" size="sm" onClick={startCamera} disabled={cameraStatus === "starting"} className="min-h-11">
                {cameraStatus === "starting" ? "Camera..." : "Camera"}
              </AppButton>
            ) : zoomRange ? (
              <AppButton variant="secondary" size="sm" onClick={toggleCameraZoom} className="min-h-11">
                Zoom {zoomLabel}
              </AppButton>
            ) : (
              <AppButton variant="secondary" size="sm" onClick={startCamera} className="min-h-11">
                Camera active
              </AppButton>
            )}
            <AppButton variant="secondary" size="sm" onClick={requestOrientation} className="min-h-11">
              {orientationStatus === "active" ? "Orientation active" : "Orientation"}
            </AppButton>
            <AppButton variant="ghost" size="sm" onClick={() => setCameraSettingsOpen(true)} disabled={!hasCameraSettings} className="min-h-11">
              Reglages
            </AppButton>
          </div>
        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePhoto} />

      {detailsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="details-title">
          <AppCard className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[28px] rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)]" padding="lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-cyan">Details</p>
                <h2 id="details-title" className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">{liveQuest.title}</h2>
              </div>
              <AppButton variant="ghost" size="sm" onClick={() => setDetailsOpen(false)}>Fermer</AppButton>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <DetailsRow label="Direction cible" value={`${liveQuest.cardinalDirection ?? "Libre"}${liveQuest.azimuth !== null ? ` ${Math.round(liveQuest.azimuth)}°` : ""}`} />
              <DetailsRow label="Direction tel." value={currentAzimuth !== null ? `${currentPhoneDirection} ${Math.round(currentAzimuth)}°` : "Inconnu"} />
              <DetailsRow label="Hauteur cible" value={targetAltitudeLabel} />
              <DetailsRow label="Hauteur tel." value={currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"} />
              <DetailsRow label="Delta direction" value={directionArrowLabel} />
              <DetailsRow label="Delta hauteur" value={altitudeArrowLabel} />
              <DetailsRow label="Zoom reel" value={zoomLabel} />
              <DetailsRow label="Orientation" value={orientationStatus === "active" ? "Active" : "Inactive"} />
              <DetailsRow label="Torche" value={cameraCapabilities?.torch ? (torchEnabled ? "Allumee" : "Eteinte") : "Indispo"} />
              <DetailsRow label="Expo." value={currentExposureCompensation !== null ? currentExposureCompensation.toFixed(1) : "Auto"} />
              <DetailsRow label="Focus" value={currentFocusDistance !== null ? currentFocusDistance.toFixed(1) : currentFocusMode ?? "Auto"} />
              <DetailsRow label="Expo mode" value={currentExposureMode ?? "Auto"} />
            </div>

            <div className="mt-4 rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
              <p className="text-sm font-bold text-white">Conseil</p>
              <p className="mt-2 text-sm leading-6 text-muted">{liveQuest.tip}</p>
            </div>
            <div className="mt-3 rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
              <p className="text-sm font-bold text-white">Boussole</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                La direction utilise la boussole du navigateur quand elle est disponible. Elle peut etre approximative dehors : suis aussi la direction texte et ton regard.
              </p>
              {orientationError ? <p className="mt-2 text-sm text-warning">{orientationError}</p> : null}
            </div>
            {SHOW_CAMERA_DEBUG ? (
              <div className="mt-3 rounded-brand-lg border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
                Debug active : tolerance {ALIGNMENT_TOLERANCE_DEGREES} deg.
              </div>
            ) : null}
          </AppCard>
        </div>
      ) : null}

      {cameraSettingsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <AppCard className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[28px] rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)]" padding="lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-cyan">Camera</p>
                <h2 id="settings-title" className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Reglages disponibles</h2>
              </div>
              <AppButton variant="ghost" size="sm" onClick={() => setCameraSettingsOpen(false)}>Fermer</AppButton>
            </div>

            {cameraSettingsError ? (
              <p className="mt-4 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">{cameraSettingsError}</p>
            ) : null}
            {!hasCameraSettings ? (
              <p className="mt-4 rounded-brand-lg border border-brand-border bg-white/[0.05] p-4 text-sm leading-6 text-muted">
                Cette camera ne publie pas de reglages avances au navigateur. SkyQuest garde les automatismes.
              </p>
            ) : null}

            <div className="mt-5 grid gap-4">
              {zoomRange && currentZoom !== null ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                    Zoom <span className="text-accent-cyan">{zoomLabel}</span>
                  </span>
                  <input
                    type="range"
                    min={zoomRange.min}
                    max={zoomRange.max}
                    step={zoomRange.step}
                    value={currentZoom}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setCurrentZoom(value);
                      void applyCameraSetting({ zoom: value });
                    }}
                    className="mt-4 w-full accent-[var(--accent-cyan)]"
                  />
                </label>
              ) : null}

              {cameraCapabilities?.torch ? (
                <div className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Torche</p>
                      <p className="mt-1 text-xs leading-5 text-muted">Pour le ciel, evite de ruiner ta vision nocturne.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextTorch = !torchEnabled;
                        setTorchEnabled(nextTorch);
                        void applyCameraSetting({ torch: nextTorch });
                      }}
                      className={`h-10 rounded-full px-4 text-sm font-black ${torchEnabled ? "bg-success/18 text-success" : "bg-white/[0.08] text-white"}`}
                    >
                      {torchEnabled ? "On" : "Off"}
                    </button>
                  </div>
                </div>
              ) : null}

              {exposureModes.length > 0 ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="text-sm font-bold text-white">Mode exposition</span>
                  <select
                    value={currentExposureMode ?? exposureModes[0]}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCurrentExposureMode(value);
                      void applyCameraSetting({ exposureMode: value });
                    }}
                    className="mt-3 h-11 w-full rounded-brand border border-brand-border bg-background px-3 text-sm font-bold text-white"
                  >
                    {exposureModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {exposureCompensationRange && currentExposureCompensation !== null ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                    Compensation exposition <span className="text-accent-cyan">{currentExposureCompensation.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min={exposureCompensationRange.min}
                    max={exposureCompensationRange.max}
                    step={exposureCompensationRange.step}
                    value={currentExposureCompensation}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setCurrentExposureCompensation(value);
                      void applyCameraSetting({ exposureCompensation: value });
                    }}
                    className="mt-4 w-full accent-[var(--accent-cyan)]"
                  />
                </label>
              ) : null}

              {exposureTimeRange && currentExposureTime !== null ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                    Temps exposition <span className="text-accent-cyan">{currentExposureTime.toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    min={exposureTimeRange.min}
                    max={exposureTimeRange.max}
                    step={exposureTimeRange.step}
                    value={currentExposureTime}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setCurrentExposureTime(value);
                      void applyCameraSetting({ exposureTime: value });
                    }}
                    className="mt-4 w-full accent-[var(--accent-cyan)]"
                  />
                </label>
              ) : null}

              {focusModes.length > 0 ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="text-sm font-bold text-white">Mode focus</span>
                  <select
                    value={currentFocusMode ?? focusModes[0]}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCurrentFocusMode(value);
                      void applyCameraSetting({ focusMode: value });
                    }}
                    className="mt-3 h-11 w-full rounded-brand border border-brand-border bg-background px-3 text-sm font-bold text-white"
                  >
                    {focusModes.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {focusDistanceRange && currentFocusDistance !== null ? (
                <label className="rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                    Distance focus <span className="text-accent-cyan">{currentFocusDistance.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min={focusDistanceRange.min}
                    max={focusDistanceRange.max}
                    step={focusDistanceRange.step}
                    value={currentFocusDistance}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setCurrentFocusDistance(value);
                      void applyCameraSetting({ focusDistance: value });
                    }}
                    className="mt-4 w-full accent-[var(--accent-cyan)]"
                  />
                </label>
              ) : null}
            </div>

            <p className="mt-5 text-xs leading-5 text-faint">
              Ces controles dependent du navigateur et du capteur. Si rien ne s affiche, l appareil garde ses automatismes.
            </p>
          </AppCard>
        </div>
      ) : null}

      {photoSheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="photo-title">
          <AppCard className="w-full rounded-t-[28px] rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)]" padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-cyan">Journal</p>
                <h2 id="photo-title" className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Ajouter une photo souvenir ?</h2>
              </div>
              <AppButton variant="ghost" size="sm" onClick={() => setPhotoSheetOpen(false)}>Fermer</AppButton>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Tu peux garder une trace de cette observation dans ton journal.
            </p>

            {photoDraft ? (
              <div
                aria-label="Apercu de la photo"
                className="mt-4 h-44 w-full rounded-brand-lg bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${photoDraft.photoThumbnailDataUrl})` }}
              />
            ) : null}
            {photoError ? <p className="mt-3 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">{photoError}</p> : null}

            <div className="mt-5 grid gap-3">
              <AppButton onClick={capturePhotoFromVideo} fullWidth>
                {photoDraft ? "Reprendre une photo" : "Prendre une photo"}
              </AppButton>
              {photoDraft ? (
                <AppButton variant="success" onClick={saveSeenWithPhoto} fullWidth>
                  Sauvegarder dans le journal
                </AppButton>
              ) : null}
              <AppButton variant="ghost" onClick={() => onSeen()} fullWidth>
                Continuer sans photo
              </AppButton>
            </div>
            <p className="mt-3 text-xs leading-5 text-faint">
              Photo compressee localement. TODO: migrer les images vers IndexedDB si le journal grossit.
            </p>
          </AppCard>
        </div>
      ) : null}
    </main>
  );
}
