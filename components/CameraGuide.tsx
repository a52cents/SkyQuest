"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
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

function getDirectionArrow(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (Math.abs(delta) <= 15) {
    return "◎";
  }

  return delta > 0 ? "→" : "←";
}

function getAltitudeArrow(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (Math.abs(delta) <= 10) {
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
  const directionAligned = directionDelta !== null && Math.abs(directionDelta) <= 15;
  const altitudeAligned = altitudeDelta !== null && Math.abs(altitudeDelta) <= 10;
  const directionTone = directionAligned
    ? "border-[#63e6a4]/35 bg-[#63e6a4]/16 text-[#b8ffd7]"
    : "border-[#38d5ff]/20 bg-[#38d5ff]/12 text-white";
  const altitudeTone = altitudeAligned
    ? "border-[#63e6a4]/35 bg-[#63e6a4]/16 text-[#b8ffd7]"
    : "border-white/10 bg-white/[0.07] text-white";
  const isSunTest = liveQuest.target === "SunTest";
  const hasPrecisePoint = liveQuest.azimuth !== null && liveQuest.altitude !== null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#050610] text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,16,0.28),rgba(5,6,16,0.72))]" aria-hidden="true" />

      {cameraStatus !== "active" ? (
        <div className="absolute inset-0 bg-[#070816]" aria-hidden="true" />
      ) : null}

      {!showHud ? (
        <button
          type="button"
          onClick={() => setShowHud(true)}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-[#050610]/72 px-4 py-2 text-sm font-extrabold text-white backdrop-blur-xl transition active:scale-[0.98]"
        >
          Afficher
        </button>
      ) : null}

      <section className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-5 pb-6 pt-5">
        {showHud ? (
          <header className="glass-card rounded-[20px] p-3 sm:rounded-[24px] sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea0ff] sm:block">Guidage 2D</p>
                <h1 className="truncate text-base font-extrabold tracking-[-0.03em] sm:mt-1 sm:text-2xl">{liveQuest.title}</h1>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                  <div className="rounded-[14px] border border-white/10 bg-white/[0.07] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8ea0ff]">Cible</p>
                    <p className="mt-0.5 text-sm font-black text-white">
                      {liveQuest.cardinalDirection ?? "Zone libre"} {liveQuest.azimuth !== null ? `${Math.round(liveQuest.azimuth)}°` : ""}
                    </p>
                  </div>
                  <div className={`rounded-[14px] border px-3 py-2 ${directionTone}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9aeaff]">Direction tél.</p>
                    <p className="mt-0.5 text-sm font-black">
                      {currentAzimuth !== null ? `${currentPhoneDirection} ${Math.round(currentAzimuth)}°` : "Inconnu"}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-white/10 bg-white/[0.07] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8ea0ff]">Hauteur cible</p>
                    <p className="mt-0.5 text-sm font-black text-white">{liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre"}</p>
                  </div>
                  <div className={`rounded-[14px] border px-3 py-2 ${altitudeTone}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9aeaff]">Hauteur tél.</p>
                    <p className="mt-0.5 text-sm font-black">{currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
                  <span className={`rounded-full px-3 py-1 text-sm font-black ${directionAligned ? "bg-[#63e6a4]/18 text-[#b8ffd7]" : "bg-white/[0.08] text-white"}`}>{directionArrowLabel}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-black ${altitudeAligned ? "bg-[#63e6a4]/18 text-[#b8ffd7]" : "bg-[#38d5ff]/12 text-[#d7f8ff]"}`}>{altitudeArrowLabel}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#9aeaff] sm:hidden">Le but : rapprocher les deux valeurs de la cible.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHud(false)}
                  className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
                >
                  Masquer
                </button>
                <Link href="/" className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm">
                  Quitter
                </Link>
              </div>
            </div>
            <p className="mt-3 hidden text-sm leading-6 text-[#d8dcff] sm:block">
              Orientation approximative : regarde vers {liveQuest.cardinalDirection ?? "le ciel"}
              {liveQuest.altitude !== null ? `, environ ${Math.round(liveQuest.altitude)}° au-dessus de l'horizon.` : "."}
            </p>
            {isSunTest ? (
              <p className="mt-3 rounded-[14px] border border-[#ffd166]/25 bg-[#ffd166]/10 px-3 py-2 text-xs font-bold leading-5 text-[#ffe3a3] sm:text-sm">
                Test uniquement : ne regarde jamais directement le Soleil. Utilise l&apos;écran comme repère.
              </p>
            ) : null}
          </header>
        ) : <div />}

        {showHud && hasPrecisePoint ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <div className={`absolute -top-20 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_rgba(56,213,255,0.24)] backdrop-blur-xl ${altitudeAligned ? "border-[#63e6a4]/40 bg-[#63e6a4]/18 text-[#b8ffd7]" : "border-white/10 bg-[#050610]/55 text-[#d7f8ff]"}`}>
              {altitudeArrow}
            </div>
            <div className={`absolute -left-24 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_rgba(124,92,255,0.22)] backdrop-blur-xl ${directionAligned ? "border-[#63e6a4]/40 bg-[#63e6a4]/18 text-[#b8ffd7]" : "border-white/10 bg-[#050610]/55 text-white"}`}>
              {directionArrow === "←" ? "←" : ""}
            </div>
            <div className={`absolute -right-24 rounded-full border px-5 py-2 text-5xl font-black shadow-[0_0_40px_rgba(124,92,255,0.22)] backdrop-blur-xl ${directionAligned ? "border-[#63e6a4]/40 bg-[#63e6a4]/18 text-[#b8ffd7]" : "border-white/10 bg-[#050610]/55 text-white"}`}>
              {directionArrow === "→" ? "→" : ""}
            </div>
            <div className={`h-28 w-28 rounded-full border shadow-[0_0_60px_rgba(56,213,255,0.22)] ${directionAligned && altitudeAligned ? "border-[#63e6a4]/70 bg-[#63e6a4]/12" : "border-[#38d5ff]/55 bg-[#38d5ff]/10"}`} />
            <div className={`absolute h-2 w-2 rounded-full ${directionAligned && altitudeAligned ? "bg-[#63e6a4]" : "bg-[#38d5ff]"}`} />
          </div>
        ) : null}

        {showHud ? (
        <div className="glass-card rounded-[24px] p-3 sm:rounded-[28px] sm:p-5">
          {cameraError ? <p className="mb-4 rounded-[18px] border border-[#ffd166]/25 bg-[#ffd166]/10 p-3 text-sm text-[#ffe3a3]">{cameraError}</p> : null}

          {cameraStatus !== "active" ? (
            <button
              type="button"
              onClick={startCamera}
              disabled={cameraStatus === "starting"}
              className="mb-4 min-h-14 w-full rounded-full bg-[#7c5cff] px-5 text-base font-extrabold text-white shadow-[0_16px_40px_rgba(124,92,255,0.35)] transition active:scale-[0.98] disabled:opacity-70"
            >
              {cameraStatus === "starting" ? "Ouverture caméra..." : "Démarrer la caméra"}
            </button>
          ) : null}

          <div className="hidden gap-3 sm:grid sm:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Direction cible</p>
              <p className="mt-1 text-2xl font-black">{liveQuest.cardinalDirection ?? "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">
                {liveQuest.azimuth !== null ? `${Math.round(liveQuest.azimuth)}°` : "Zone dégagée"}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Altitude cible</p>
              <p className="mt-1 text-2xl font-black">{liveQuest.altitude !== null ? `${Math.round(liveQuest.altitude)}°` : "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">0° = horizon, 90° = zénith</p>
            </div>
          </div>

          <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-3">
            <div className={`rounded-[18px] border p-3 ${directionTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9aeaff]">Téléphone</p>
              <p className="mt-1 text-lg font-black">
                {currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#d7f8ff]">
                {currentAzimuth !== null ? `${Math.round(currentAzimuth)}°` : "Boussole inactive"}
              </p>
            </div>
            <div className={`rounded-[18px] border p-3 ${directionTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Écart horizontal</p>
              <p className="mt-1 text-3xl font-black">{directionArrowLabel}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">Vise jusqu&apos;à 0°</p>
            </div>
            <div className={`rounded-[18px] border p-3 ${altitudeTone}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Caméra</p>
              <p className="mt-1 text-lg font-black">
                {currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">
                {altitudeArrowLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 hidden rounded-[22px] bg-[#7c5cff]/16 p-4 sm:block">
            <p className="text-2xl font-black tracking-[-0.03em]">{mainHint}</p>
            <p className="mt-2 text-base font-semibold text-[#d8dcff]">{altitudeHint ?? "La boussole mobile peut être imprécise."}</p>
          </div>

          <button
            type="button"
            onClick={requestOrientation}
            className="mt-4 min-h-14 w-full rounded-full border border-[#38d5ff]/25 bg-[#38d5ff]/12 px-5 text-base font-extrabold text-[#d7f8ff] transition active:scale-[0.98]"
          >
            {orientationStatus === "active" ? "Orientation active" : "Activer l'orientation"}
          </button>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#9fa6d9]">
            Le pointage est recalculé en direct, mais la boussole du téléphone peut rester décalée de quelques degrés.
          </p>

          {orientationStatus === "denied" || orientationStatus === "unsupported" ? (
            <p className="mt-3 text-sm leading-6 text-[#ffdca0]">
              {orientationError ?? "La boussole n'est pas disponible."} Regarde vers {liveQuest.cardinalDirection ?? "la zone la plus dégagée"}
              {liveQuest.altitude !== null ? `, environ ${Math.round(liveQuest.altitude)}° au-dessus de l'horizon.` : "."}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onSeen}
              className="min-h-13 rounded-full bg-[#63e6a4] px-4 text-sm font-extrabold text-[#04140c] transition active:scale-[0.98]"
            >
              Je l&apos;ai vu
            </button>
            <button
              type="button"
              onClick={onMissed}
              className="min-h-13 rounded-full border border-white/10 bg-white/[0.08] px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
            >
              Pas trouvé
            </button>
          </div>
        </div>
        ) : <div />}
      </section>
    </main>
  );
}
