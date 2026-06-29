"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  angleDifference,
  azimuthToCardinal,
  betaToCameraAltitude,
  getAltitudeHint,
  getDirectionHint,
  normalizeAngle,
} from "@/lib/orientation";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
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

export function CameraGuide({ quest, onSeen, onMissed }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [orientationStatus, setOrientationStatus] = useState<"idle" | "active" | "denied" | "unsupported">("idle");
  const [orientationError, setOrientationError] = useState<string | null>(null);
  const [currentAzimuth, setCurrentAzimuth] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);

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
    const heading = typeof event.webkitCompassHeading === "number"
      ? event.webkitCompassHeading
      : typeof event.alpha === "number"
        ? normalizeAngle(360 - event.alpha)
        : null;

    if (heading !== null) {
      setCurrentAzimuth(heading);
    }

    if (typeof event.beta === "number") {
      setCurrentAltitude(betaToCameraAltitude(event.beta));
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

  const directionHint = quest.azimuth !== null && currentAzimuth !== null
    ? getDirectionHint(currentAzimuth, quest.azimuth)
    : null;
  const altitudeHint = quest.altitude !== null && currentAltitude !== null
    ? getAltitudeHint(currentAltitude, quest.altitude)
    : null;
  const close = directionHint === "Bonne direction" && altitudeHint === "Hauteur proche";
  const mainHint = close ? "Tu es proche, regarde bien le ciel" : directionHint ?? "Active l'orientation ou suis la direction texte";
  const directionDelta = quest.azimuth !== null && currentAzimuth !== null
    ? angleDifference(currentAzimuth, quest.azimuth)
    : null;
  const directionDeltaLabel = directionDelta !== null
    ? `${Math.abs(Math.round(directionDelta))}° ${directionDelta > 0 ? "à droite" : directionDelta < 0 ? "à gauche" : "pile en face"}`
    : "Active l'orientation";
  const altitudeDelta = quest.altitude !== null && currentAltitude !== null
    ? quest.altitude - currentAltitude
    : null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#050610] text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,16,0.28),rgba(5,6,16,0.72))]" aria-hidden="true" />

      {cameraStatus !== "active" ? (
        <div className="absolute inset-0 bg-[#070816]" aria-hidden="true" />
      ) : null}

      <section className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-5 pb-6 pt-5">
        <header className="glass-card rounded-[24px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea0ff]">Guidage 2D</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">{quest.title}</h1>
            </div>
            <Link href="/" className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-bold">
              Quitter
            </Link>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#d8dcff]">
            Orientation approximative : regarde vers {quest.cardinalDirection ?? "le ciel"}
            {quest.altitude !== null ? `, environ ${Math.round(quest.altitude)}° au-dessus de l'horizon.` : "."}
          </p>
        </header>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <div className="h-28 w-28 rounded-full border border-[#38d5ff]/55 bg-[#38d5ff]/10 shadow-[0_0_60px_rgba(56,213,255,0.22)]" />
          <div className="absolute h-2 w-2 rounded-full bg-[#38d5ff]" />
        </div>

        <div className="glass-card rounded-[28px] p-5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Direction cible</p>
              <p className="mt-1 text-2xl font-black">{quest.cardinalDirection ?? "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">
                {quest.azimuth !== null ? `${Math.round(quest.azimuth)}°` : "Zone dégagée"}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Altitude cible</p>
              <p className="mt-1 text-2xl font-black">{quest.altitude !== null ? `${Math.round(quest.altitude)}°` : "Libre"}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">0° = horizon, 90° = zénith</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[#38d5ff]/15 bg-[#38d5ff]/10 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9aeaff]">Téléphone</p>
              <p className="mt-1 text-lg font-black">
                {currentAzimuth !== null ? azimuthToCardinal(currentAzimuth) : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#d7f8ff]">
                {currentAzimuth !== null ? `${Math.round(currentAzimuth)}°` : "Boussole inactive"}
              </p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Écart horizontal</p>
              <p className="mt-1 text-lg font-black">{directionDeltaLabel}</p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">Vise jusqu&apos;à 0°</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8ea0ff]">Caméra</p>
              <p className="mt-1 text-lg font-black">
                {currentAltitude !== null ? `${Math.round(currentAltitude)}°` : "Inconnu"}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#cbd0ff]">
                {altitudeDelta !== null ? `${Math.abs(Math.round(altitudeDelta))}° ${altitudeDelta > 0 ? "plus haut" : altitudeDelta < 0 ? "plus bas" : "pile"}` : "Inclinaison inactive"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] bg-[#7c5cff]/16 p-4">
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

          {orientationStatus === "denied" || orientationStatus === "unsupported" ? (
            <p className="mt-3 text-sm leading-6 text-[#ffdca0]">
              {orientationError ?? "La boussole n'est pas disponible."} Regarde vers {quest.cardinalDirection ?? "la zone la plus dégagée"}
              {quest.altitude !== null ? `, environ ${Math.round(quest.altitude)}° au-dessus de l'horizon.` : "."}
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
      </section>
    </main>
  );
}
