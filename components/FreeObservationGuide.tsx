"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";
import {
  formatFreeObservationTime,
  FREE_OBSERVATION_DURATION_SECONDS,
  getFreeObservationRemainingSeconds,
} from "@/lib/free-observation";
import { haptic } from "@/lib/haptics";

type FreeObservationPhase = "preparation" | "observing" | "complete";

type FreeObservationGuideProps = {
  onSeen: () => void;
  onMissed: () => void;
};

const PREPARATION_TIPS = [
  "Choisis la zone la plus dégagée.",
  "Laisse tes yeux s’habituer à l’obscurité.",
  "Balaye lentement le ciel.",
] as const;

const OBSERVATION_TIPS = [
  "Respire et laisse tes yeux s’habituer.",
  "Balaye doucement le ciel, sans te presser.",
  "Remarque les différences de lumière et de couleur.",
] as const;

export function FreeObservationGuide({ onSeen, onMissed }: FreeObservationGuideProps) {
  const [phase, setPhase] = useState<FreeObservationPhase>("preparation");
  const [remainingSeconds, setRemainingSeconds] = useState(FREE_OBSERVATION_DURATION_SECONDS);
  const endsAtMsRef = useRef<number | null>(null);
  const didCompleteRef = useRef(false);

  useEffect(() => {
    if (phase !== "observing" || endsAtMsRef.current === null) return;

    const updateTimer = () => {
      const endsAtMs = endsAtMsRef.current;
      if (endsAtMs === null) return;

      const nextRemainingSeconds = getFreeObservationRemainingSeconds(endsAtMs, Date.now());
      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0 && !didCompleteRef.current) {
        didCompleteRef.current = true;
        setPhase("complete");
        haptic("success");
      }
    };

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(intervalId);
  }, [phase]);

  function startObservation() {
    didCompleteRef.current = false;
    setRemainingSeconds(FREE_OBSERVATION_DURATION_SECONDS);
    endsAtMsRef.current = Date.now() + FREE_OBSERVATION_DURATION_SECONDS * 1_000;
    setPhase("observing");
  }

  function finishEarly() {
    didCompleteRef.current = true;
    endsAtMsRef.current = null;
    setPhase("complete");
  }

  if (phase === "preparation") {
    return (
      <PageShell
        eyebrow="Observation libre"
        title="Observe le ciel pendant 2 minutes"
        className="max-w-2xl"
        contentClassName="flex flex-col justify-center gap-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <AppCard className="border-accent/20 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--accent)_15%,transparent),transparent_42%)]">
          <p className="text-base leading-7 text-text">
            Aucun objet à trouver. Prends simplement un moment pour regarder ce qui attire ton œil.
          </p>
          <ul className="mt-5 grid gap-3" aria-label="Conseils avant de commencer">
            {PREPARATION_TIPS.map((tip, index) => (
              <li key={tip} className="flex items-start gap-3 text-sm leading-6 text-muted">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] text-xs font-bold text-accent-cyan"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </AppCard>
        <div className="mt-2 grid gap-2">
          <AppButton size="lg" fullWidth onClick={startObservation}>
            Commencer les 2 minutes
          </AppButton>
          <Link href="/" className={getAppButtonClassName({ variant: "ghost", fullWidth: true })}>
            Retour à l’accueil
          </Link>
        </div>
      </PageShell>
    );
  }

  if (phase === "observing") {
    const elapsedSeconds = FREE_OBSERVATION_DURATION_SECONDS - remainingSeconds;
    const tipIndex = Math.min(
      OBSERVATION_TIPS.length - 1,
      Math.floor(elapsedSeconds / (FREE_OBSERVATION_DURATION_SECONDS / OBSERVATION_TIPS.length)),
    );
    const progressPercent = Math.min(
      100,
      (elapsedSeconds / FREE_OBSERVATION_DURATION_SECONDS) * 100,
    );

    return (
      <PageShell
        eyebrow="Observation en cours"
        title="Lève les yeux"
        className="max-w-2xl"
        contentClassName="flex flex-col justify-center gap-5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <AppCard padding="lg" className="text-center">
          <p className="text-sm text-muted">Temps restant</p>
          <p
            className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-6xl font-normal tabular-nums tracking-[-0.05em] text-white sm:text-7xl"
            role="timer"
            aria-live="off"
            aria-label={`${remainingSeconds} secondes restantes`}
          >
            {formatFreeObservationTime(remainingSeconds)}
          </p>
          <div
            className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.07]"
            role="progressbar"
            aria-label="Progression de l’observation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="sr-only">Observation en cours pendant deux minutes.</p>
        </AppCard>

        <AppCard variant="subtle" padding="sm" className="min-h-24 text-center">
          <p className="premium-kicker">Petit repère</p>
          <p className="mt-2 text-sm leading-6 text-text">{OBSERVATION_TIPS[tipIndex]}</p>
        </AppCard>

        <div className="grid gap-2">
          <AppButton variant="secondary" fullWidth onClick={finishEarly}>
            Terminer plus tôt
          </AppButton>
          <Link href="/" className={getAppButtonClassName({ variant: "ghost", fullWidth: true })}>
            Quitter sans enregistrer
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Moment terminé"
      title="Qu’as-tu remarqué ?"
      className="max-w-2xl"
      contentClassName="flex flex-col justify-center gap-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <AppCard className="text-center" aria-live="polite">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.1] text-2xl text-accent-cyan"
          aria-hidden="true"
        >
          ✦
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Il n’y avait rien à réussir. Note simplement ton impression du moment.
        </p>
      </AppCard>
      <div className="grid gap-3">
        <AppButton size="lg" fullWidth onClick={onSeen}>
          J’ai remarqué quelque chose
        </AppButton>
        <AppButton variant="secondary" size="lg" fullWidth onClick={onMissed}>
          Rien de particulier
        </AppButton>
      </div>
      <Link href="/" className={getAppButtonClassName({ variant: "ghost", fullWidth: true })}>
        Quitter sans enregistrer
      </Link>
    </PageShell>
  );
}
