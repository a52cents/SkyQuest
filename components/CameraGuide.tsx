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

type CameraZoomCapabilities = MediaTrackCapabilities & {
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
};

type CameraZoomSettings = MediaTrackSettings & {
  zoom?: number;
};

type CameraZoomConstraintSet = MediaTrackConstraintSet & {
  zoom?: number;
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
      configureCameraZoom(stream);
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

  function readCameraZoomRange(track: MediaStreamTrack): CameraZoomRange | null {
    if (typeof track.getCapabilities !== "function") {
      return null;
    }

    const zoom = (track.getCapabilities() as CameraZoomCapabilities).zoom;
    if (!zoom || typeof zoom.min !== "number" || typeof zoom.max !== "number" || zoom.max <= zoom.min) {
      return null;
    }

    return {
      min: zoom.min,
      max: zoom.max,
      step: typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0.5,
    };
  }

  function configureCameraZoom(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    const range = track ? readCameraZoomRange(track) : null;
    const settings = track ? (track.getSettings() as CameraZoomSettings) : null;

    setZoomRange(range);
    setCurrentZoom(range ? settings?.zoom ?? range.min : null);
    setZoomError(null);
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
        advanced: [{ zoom: nextZoom } as CameraZoomConstraintSet],
      });
      const settings = track.getSettings() as CameraZoomSettings;
      setCurrentZoom(settings.zoom ?? nextZoom);
      setZoomError(null);
    } catch {
      setZoomError("Zoom indisponible sur cette camera.");
    }
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

          <div className="mt-2 grid grid-cols-2 gap-2">
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
