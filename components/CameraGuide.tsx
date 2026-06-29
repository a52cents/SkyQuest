"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import {
  ALIGNMENT_TOLERANCE_DEGREES,
  angleDifference,
  azimuthToCardinal,
  getCameraPointing,
  getAltitudeHint,
  getDirectionHint,
} from "@/lib/orientation";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
import { recalculateQuestPosition } from "@/lib/quest-generator";
import { getLastLocation } from "@/lib/storage";
import type { SkyQuest } from "@/lib/types";

type CameraGuideProps = {
  quest: SkyQuest;
  onSeen: () => void;
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

function getDirectionArrow(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (Math.abs(delta) <= ALIGNMENT_TOLERANCE_DEGREES) {
    return "◎";
  }

  return delta > 0 ? "→" : "←";
}

function getAltitudeArrow(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (Math.abs(delta) <= ALIGNMENT_TOLERANCE_DEGREES) {
    return "◎";
  }

  return delta > 0 ? "↑" : "↓";
}

export function CameraGuide({ quest, onSeen, onMissed }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
  const [showHud, setShowHud] = useState(true);

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
      setCameraError("La caméra n'est pas disponible dans ce navigateur. Essaie Safari à jour ou un déploiement HTTPS.");
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
      const fallbackMessage = getCameraErrorMessage(error);
      setCameraStatus("error");
      setCameraError(fallbackMessage);
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
      // This is optical/sensor zoom exposed by the camera track, not CSS scaling.
      await track.applyConstraints({
        advanced: [{ zoom: nextZoom } as CameraZoomConstraintSet],
      });
      const settings = track.getSettings() as CameraZoomSettings;
      setCurrentZoom(settings.zoom ?? nextZoom);
      setZoomError(null);
    } catch {
      setZoomError("Zoom indisponible sur cette caméra.");
    }
  }

  function getCameraErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        return "Caméra refusée. Vérifie Réglages > Safari > Caméra, puis relance le guidage.";
      }

      if (error.name === "NotFoundError") {
        return "Aucune caméra disponible. Utilise le guidage texte ci-dessous.";
      }

      if (error.name === "NotReadableError") {
        return "La caméra est déjà utilisée par une autre app ou indisponible momentanément.";
      }
    }

    return "Caméra indisponible. Tu peux quand même suivre la direction indiquée.";
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
          setOrientationError("Orientation refusée. Vérifie Réglages > Safari > Mouvement et orientation.");
          return;
        }
      }

      window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
      window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      setOrientationStatus("active");
    } catch {
      setOrientationStatus("denied");
      setOrientationError("Orientation refusée ou indisponible. Utilise la direction texte comme repère.");
    }
  }

  const directionHint = liveQuest.azimuth !== null && currentAzimuth !== null
    ? getDirectionHint(currentAzimuth, liveQuest.azimuth)
    : null;
  const altitudeHint = liveQuest.altitude !== null && currentAltitude !== null
    ? getAltitudeHint(currentAltitude, liveQuest.altitude)
    : null;
  const close = directionHint === "Bonne direction" && altitudeHint === "Hauteur proche";
  const mainHint = close ? "Tu es proche, regarde bien le ciel" : directionHint ?? "Active l'orientation ou suis la direction texte";
  const directionDelta = liveQuest.azimuth !== null && currentAzimuth !== null
    ? angleDifference(currentAzimuth, liveQuest.azimuth)
    : null;
  const altitudeDelta = liveQuest.altitude !== null && currentAltitude !== null
    ? liveQuest.altitude - currentAltitude
    : null;
  const directionArrow = getDirectionArrow(directionDelta);
  const altitudeArrow = getAltitudeArrow(altitudeDelta);
  const directionArrowLabel = directionDelta !== null ? `${directionArrow} ${Math.abs(Math.round(directionDelta))}°` : "—";
  const altitudeArrowLabel = altitudeDelta !== null ? `${altitudeArrow} ${Math.abs(Math.round(altitudeDelta))}°` : "—";
  const currentPhoneDirection = currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu";
  const directionAligned = directionDelta !== null && Math.abs(directionDelta) <= ALIGNMENT_TOLERANCE_DEGREES;
  const altitudeAligned = altitudeDelta !== null && Math.abs(altitudeDelta) <= ALIGNMENT_TOLERANCE_DEGREES;
  const directionTone = directionAligned
    ? "border-success/35 bg-success/16 text-success"
    : "border-accent-cyan/20 bg-accent-cyan/12 text-white";
  const altitudeTone = altitudeAligned
    ? "border-success/35 bg-success/16 text-success"
    : "border-brand-border bg-white/[0.07] text-white";
  const hasPrecisePoint = liveQuest.azimuth !== null && liveQuest.altitude !== null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_28%,transparent),color-mix(in_srgb,var(--background)_72%,transparent))]" aria-hidden="true" />

      {cameraStatus !== "active" ? (
        <div className="absolute inset-0 bg-background" aria-hidden="true" />
      ) : null}

      {!showHud ? (
        <AppButton
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setShowHud(true)}
          className="absolute right-4 top-4 z-20 min-h-0 bg-background/72 py-2 backdrop-blur-xl"
        >
          Afficher
        </AppButton>
      ) : null}

      <section className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-5 pb-6 pt-5">
        {showHud ? (
          <AppCard as="section" className="rounded-[20px] p-3 sm:rounded-[24px] sm:p-4" padding="sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan sm:block">Guidage 2D</p>
                <h1 className="truncate text-base font-extrabold tracking-[-0.03em] sm:mt-1 sm:text-2xl">{liveQuest.title}</h1>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                  <div className="rounded-[14px] border border-brand-border bg-white/[0.07] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent-cyan">Cible</p>
                    <p className="mt-0.5 text-sm font-black text-white">
                      {liveQuest.cardinalDirection ?? "Zone libre"} {liveQuest.azimuth !== null ? `${Math.round(liveQuest.azimuth)}°` : ""}
                    </p>
                  </div>
                  <div className={`rounded-[14px] border px-3 py-2 ${directionTone}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent-cyan">Direction tél.</p>
                    <p className="mt-0.5 text-sm font-black">
                      {currentAzimuth !== null ? `${currentPhoneDirection} ${Math.round(currentAzimuth)}°` : "Inconnu"}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-brand-border bg-white/[0.07] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent-cyan">Hauteur cible</p>
                    <p className="mt-0.5 text-sm font-black text-white">{liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre"}</p>
                  </div>
                  <div className={`rounded-[14px] border px-3 py-2 ${altitudeTone}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent-cyan">Hauteur tél.</p>
                    <p className="mt-0.5 text-sm font-black">{currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
                  <span className={`rounded-full px-3 py-1 text-sm font-black ${directionAligned ? "bg-success/18 text-success" : "bg-white/[0.08] text-white"}`}>{directionArrowLabel}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-black ${altitudeAligned ? "bg-success/18 text-success" : "bg-accent-cyan/12 text-accent-cyan"}`}>{altitudeArrowLabel}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-accent-cyan sm:hidden">Le but : rapprocher les deux valeurs de la cible.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AppButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setShowHud(false)}
                  className="min-h-0 px-3 py-2 text-xs sm:px-4 sm:text-sm"
                >
                  Masquer
                </AppButton>
                <Link href="/" className={getAppButtonClassName({ variant: "ghost", size: "sm", className: "min-h-0 px-3 py-2 text-xs sm:px-4 sm:text-sm" })}>
                  Quitter
                </Link>
              </div>
            </div>
            <p className="mt-3 hidden text-sm leading-6 text-muted sm:block">
              Orientation approximative : regarde vers {liveQuest.cardinalDirection ?? "le ciel"}
              {liveQuest.altitude !== null ? `, environ ${Math.round(liveQuest.altitude)}° au-dessus de l'horizon.` : "."}
            </p>
          </AppCard>
        ) : <div />}

        {showHud && hasPrecisePoint ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <div className={`absolute -top-20 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_color-mix(in_srgb,var(--accent-cyan)_24%,transparent)] backdrop-blur-xl ${altitudeAligned ? "border-success/40 bg-success/18 text-success" : "border-brand-border bg-background/55 text-accent-cyan"}`}>
              {altitudeArrow}
            </div>
            <div className={`absolute -left-24 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_color-mix(in_srgb,var(--accent)_22%,transparent)] backdrop-blur-xl ${directionAligned ? "border-success/40 bg-success/18 text-success" : "border-brand-border bg-background/55 text-white"}`}>
              {directionArrow === "←" ? "←" : ""}
            </div>
            <div className={`absolute -right-24 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_color-mix(in_srgb,var(--accent)_22%,transparent)] backdrop-blur-xl ${directionAligned ? "border-success/40 bg-success/18 text-success" : "border-brand-border bg-background/55 text-white"}`}>
              {directionArrow === "→" ? "→" : ""}
            </div>
            <div className={`h-28 w-28 rounded-full border shadow-[0_0_60px_color-mix(in_srgb,var(--accent-cyan)_22%,transparent)] ${directionAligned && altitudeAligned ? "border-success/70 bg-success/12" : "border-accent-cyan/55 bg-accent-cyan/10"}`} />
            <div className={`absolute h-2 w-2 rounded-full ${directionAligned && altitudeAligned ? "bg-success" : "bg-accent-cyan"}`} />
          </div>
        ) : null}

        {showHud ? (
        <AppCard className="rounded-[24px] p-3 sm:rounded-[28px] sm:p-5" padding="sm">
          {cameraError ? <p className="mb-4 rounded-[18px] border border-warning/25 bg-warning/10 p-3 text-sm text-warning">{cameraError}</p> : null}
          {zoomError ? <p className="mb-4 rounded-[18px] border border-warning/25 bg-warning/10 p-3 text-sm text-warning">{zoomError}</p> : null}

          {cameraStatus !== "active" ? (
            <AppButton
              onClick={startCamera}
              disabled={cameraStatus === "starting"}
              fullWidth
              className="mb-4"
            >
              {cameraStatus === "starting" ? "Ouverture caméra..." : "Démarrer la caméra"}
            </AppButton>
          ) : null}
          {cameraStatus === "active" && zoomRange ? (
            <AppButton variant="ghost" size="sm" onClick={toggleCameraZoom} fullWidth className="mb-4">
              Zoom réel {formatZoom(currentZoom ?? zoomRange.min)}x
            </AppButton>
          ) : null}

          <div className="hidden gap-3 sm:grid sm:grid-cols-2">
            <div className="rounded-[20px] border border-brand-border bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">Direction cible</p>
              <p className="mt-1 text-2xl font-black">{liveQuest.cardinalDirection ?? "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {liveQuest.azimuth !== null ? `${Math.round(liveQuest.azimuth)}°` : "Zone dégagée"}
              </p>
            </div>
            <div className="rounded-[20px] border border-brand-border bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">Altitude cible</p>
              <p className="mt-1 text-2xl font-black">{liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-muted">0° = horizon, 90° = zénith</p>
            </div>
          </div>

          <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-3">
            <div className={`rounded-[18px] border p-3 ${directionTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">Téléphone</p>
              <p className="mt-1 text-lg font-black">
                {currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-accent-cyan">
                {currentAzimuth !== null ? `${Math.round(currentAzimuth)}°` : "Boussole inactive"}
              </p>
            </div>
            <div className={`rounded-[18px] border p-3 ${directionTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">Écart horizontal</p>
              <p className="mt-1 text-3xl font-black">{directionArrowLabel}</p>
              <p className="mt-1 text-sm font-semibold text-muted">Vise jusqu&apos;à 0°</p>
            </div>
            <div className={`rounded-[18px] border p-3 ${altitudeTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">Caméra</p>
              <p className="mt-1 text-lg font-black">
                {currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {altitudeArrowLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 hidden rounded-[22px] bg-accent/16 p-4 sm:block">
            <p className="text-2xl font-black tracking-[-0.03em]">{mainHint}</p>
            <p className="mt-2 text-base font-semibold text-muted">{altitudeHint ?? "La boussole mobile peut être imprécise."}</p>
          </div>

          <AppButton variant="secondary" onClick={requestOrientation} fullWidth className="mt-4">
            {orientationStatus === "active" ? "Orientation active" : "Activer l'orientation"}
          </AppButton>
          <p className="mt-2 text-xs font-semibold leading-5 text-faint">
            La direction utilise la vraie boussole du navigateur quand elle est disponible. Sinon, suis la direction texte.
          </p>

          {orientationStatus === "denied" || orientationStatus === "unsupported" ? (
            <p className="mt-3 text-sm leading-6 text-warning">
              {orientationError ?? "La boussole n'est pas disponible."} Regarde vers {liveQuest.cardinalDirection ?? "la zone la plus dégagée"}
              {liveQuest.altitude !== null ? `, environ ${Math.round(liveQuest.altitude)}° au-dessus de l'horizon.` : "."}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <AppButton variant="success" size="sm" onClick={onSeen}>
              Je l&apos;ai vu
            </AppButton>
            <AppButton variant="ghost" size="sm" onClick={onMissed}>
              Pas trouvé
            </AppButton>
          </div>
        </AppCard>
        ) : <div />}
      </section>
    </main>
  );
}
