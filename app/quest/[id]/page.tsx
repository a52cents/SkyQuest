"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { CameraGuide } from "@/components/CameraGuide";
import { ErrorState } from "@/components/ErrorState";
import { PageShell } from "@/components/PageShell";
import { ProgressFeedback } from "@/components/ProgressFeedback";
import { addObservation, getActiveQuest, getLastLocation, getProgressProfile } from "@/lib/storage";
import { getRankProgress } from "@/lib/progression";
import { haptic } from "@/lib/haptics";
import type { ObservationPhotoDraft, ProgressReward, SkyQuest } from "@/lib/types";

export default function QuestGuidePage() {
  const params = useParams<{ id: string }>();
  const [quest, setQuest] = useState<SkyQuest | null>(null);
  const [reward, setReward] = useState<{
    reward: ProgressReward;
    previousRankName: string | null;
  } | null>(null);
  const isLoggingRef = useRef(false);

  useEffect(() => {
    const stored = getActiveQuest();
    if (stored && stored.id === params.id) {
      setQuest(stored);
    }
  }, [params.id]);

  async function logAndReturn(status: "seen" | "missed", photo?: ObservationPhotoDraft) {
    if (!quest || isLoggingRef.current) {
      return;
    }
    isLoggingRef.current = true;
    const previousRankName = getRankProgress(getProgressProfile().totalXp).current.name;
    const result = await addObservation(quest, status, getLastLocation() ?? undefined, photo);
    haptic(status === "seen" ? "success" : "missed");
    setReward({ reward: result.reward, previousRankName });
  }

  if (reward) {
    return (
      <PageShell
        eyebrow="Observation notée"
        title="Une trace dans ton ciel"
        className="max-w-2xl justify-center"
        contentClassName="flex flex-col justify-center gap-3"
      >
        <ProgressFeedback
          reward={reward.reward}
          previousRankName={reward.previousRankName}
          showJournalLink
        />
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
          message="Quête introuvable. Relance Maintenant pour générer une nouvelle observation."
        />
        <Link href="/" className={getAppButtonClassName({ className: "mt-4" })}>
          Retour à {"l'accueil"}
        </Link>
      </PageShell>
    );
  }

  return (
    <CameraGuide
      quest={quest}
      onSeen={(photo) => logAndReturn("seen", photo)}
      onMissed={() => logAndReturn("missed")}
    />
  );
}
