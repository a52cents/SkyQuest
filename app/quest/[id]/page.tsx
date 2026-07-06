"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { CameraGuide } from "@/components/CameraGuide";
import { ErrorState } from "@/components/ErrorState";
import { FreeObservationGuide } from "@/components/FreeObservationGuide";
import { PageShell } from "@/components/PageShell";
import { ObservationMemoryCard } from "@/components/ObservationMemoryCard";
import { ProgressFeedback } from "@/components/ProgressFeedback";
import { MissedObservationFeedback } from "@/components/MissedObservationFeedback";
import { addObservation, getActiveQuest, getLastLocation, getProgressProfile } from "@/lib/storage";
import { getRankProgress } from "@/lib/progression";
import { haptic } from "@/lib/haptics";
import { isIssQuestGuidable } from "@/lib/iss";
import { isQuestFresh } from "@/lib/quest-freshness";
import type { Observation, ObservationPhotoDraft, ProgressReward, SkyQuest } from "@/lib/types";

export default function QuestGuidePage() {
  const params = useParams<{ id: string }>();
  const [quest, setQuest] = useState<SkyQuest | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<"expired" | "satellite_window" | null>(
    null,
  );
  const [reward, setReward] = useState<{
    reward: ProgressReward;
    previousRankName: string | null;
    observation: Observation;
    completedQuest: SkyQuest;
    showNotificationInvite: boolean;
  } | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const isLoggingRef = useRef(false);

  useEffect(() => {
    const stored = getActiveQuest();
    if (!stored || stored.id !== params.id) return;

    const refreshAvailability = () => {
      const reason = !isQuestFresh(stored)
        ? "expired"
        : stored.targetType === "satellite" && !isIssQuestGuidable(stored.startsAt, stored.endsAt)
          ? "satellite_window"
          : null;
      setUnavailableReason(reason);
      setQuest(reason ? null : stored);
    };

    refreshAvailability();
    const intervalId = window.setInterval(refreshAvailability, 15_000);
    return () => window.clearInterval(intervalId);
  }, [params.id]);

  function reportPersistenceFailure(): false {
    isLoggingRef.current = false;
    setPersistenceError(
      "Impossible d’enregistrer cette observation sur l’appareil. Rien n’a été ajouté à ton journal ni à ta progression. Réessaie.",
    );
    return false;
  }

  async function logAndReturn(status: "seen" | "missed", photo?: ObservationPhotoDraft) {
    if (!quest || isLoggingRef.current) {
      return false;
    }
    isLoggingRef.current = true;
    setPersistenceError(null);
    const previousProfile = getProgressProfile();
    const previousRankName = getRankProgress(previousProfile.totalXp).current.name;
    const result = await addObservation(quest, status, getLastLocation() ?? undefined, photo).catch(
      () => null,
    );
    if (!result) return reportPersistenceFailure();
    if (!result.persisted) {
      return reportPersistenceFailure();
    }
    haptic(status === "seen" ? "success" : "missed");
    setReward({
      reward: result.reward,
      previousRankName,
      observation: result.observation,
      completedQuest: quest,
      showNotificationInvite:
        status === "seen" &&
        quest.targetType !== "free_observation" &&
        previousProfile.discoveredTargets.length === 0,
    });
    return true;
  }

  if (reward) {
    const updateRewardObservation = (observation: Observation) =>
      setReward((current) => (current ? { ...current, observation } : current));
    return (
      <PageShell
        eyebrow="Observation notée"
        title="Une trace dans ton ciel"
        className="max-w-2xl justify-center"
        contentClassName="flex flex-col justify-center gap-3"
      >
        {reward.observation.status === "seen" &&
        reward.observation.targetType !== "free_observation" ? (
          <ObservationMemoryCard observation={reward.observation} />
        ) : null}
        {reward.observation.status === "missed" ? (
          <MissedObservationFeedback
            observation={reward.observation}
            quest={reward.completedQuest}
            onObservationUpdated={updateRewardObservation}
            onRetry={() => {
              if (!isQuestFresh(reward.completedQuest)) return;
              isLoggingRef.current = false;
              setReward(null);
            }}
          />
        ) : null}
        <ProgressFeedback
          reward={reward.reward}
          previousRankName={reward.previousRankName}
          observation={reward.observation}
          showObservationReport={reward.observation.status === "seen"}
          onObservationUpdated={updateRewardObservation}
          showJournalLink
        />
        {reward.showNotificationInvite ? (
          <AppCard variant="subtle" padding="sm" className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/[0.10] text-accent-cyan"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-none stroke-current"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold text-text">Reviens au bon moment</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Tu peux activer des alertes ciel depuis ton profil.
              </p>
            </div>
            <Link
              href="/profile#notifications"
              className={getAppButtonClassName({ variant: "secondary", size: "sm" })}
            >
              Voir
            </Link>
          </AppCard>
        ) : null}
        <Link href="/" className={getAppButtonClassName({ variant: "ghost", className: "w-full" })}>
          Retour à l’accueil
        </Link>
      </PageShell>
    );
  }

  if (!quest) {
    return (
      <PageShell
        className="max-w-2xl justify-center"
        contentClassName="flex flex-col justify-center"
      >
        <ErrorState
          tone="warning"
          message={
            unavailableReason === "expired"
              ? "Cette quête a expiré car le ciel et la météo ont pu changer. Relancer Maintenant."
              : unavailableReason === "satellite_window"
                ? "Le guidage satellite est disponible 5 minutes avant le passage et jusqu'à sa fin. Relance « Maintenant » près de l'heure prévue."
                : "Quête introuvable. Relancer Maintenant pour générer une nouvelle observation."
          }
        />
        <Link href="/" className={getAppButtonClassName({ className: "mt-4" })}>
          Retour à {"l'accueil"}
        </Link>
      </PageShell>
    );
  }

  if (quest.targetType === "free_observation") {
    return (
      <FreeObservationGuide
        persistenceError={persistenceError}
        onSeen={() => void logAndReturn("seen")}
        onMissed={() => void logAndReturn("missed")}
      />
    );
  }

  return (
    <CameraGuide
      quest={quest}
      persistenceError={persistenceError}
      onSeen={(photo) => logAndReturn("seen", photo)}
      onMissed={() => logAndReturn("missed")}
    />
  );
}
