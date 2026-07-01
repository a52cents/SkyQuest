"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { CameraGuide } from "@/components/CameraGuide";
import { ErrorState } from "@/components/ErrorState";
import { PageShell } from "@/components/PageShell";
import { ProgressFeedback } from "@/components/ProgressFeedback";
import { addObservation, getActiveQuest, getLastLocation } from "@/lib/storage";
import type { Observation, ProgressReward, SkyQuest } from "@/lib/types";

export default function QuestGuidePage() {
  const params = useParams<{ id: string }>();
  const [quest, setQuest] = useState<SkyQuest | null>(null);
  const [reward, setReward] = useState<ProgressReward | null>(null);
  const isLoggingRef = useRef(false);

  useEffect(() => {
    const stored = getActiveQuest();
    if (stored && stored.id === params.id) {
      setQuest(stored);
    }
  }, [params.id]);

  function logAndReturn(status: "seen" | "missed", photo?: Pick<Observation, "photoDataUrl" | "photoThumbnailDataUrl">) {
    if (!quest || isLoggingRef.current) {
      return;
    }
    isLoggingRef.current = true;
    const result = addObservation(quest, status, getLastLocation() ?? undefined, photo);
    setReward(result.reward);
  }

  if (reward) {
    return (
      <PageShell eyebrow="Observation notée" title="Une trace dans ton ciel" className="max-w-2xl justify-center" contentClassName="flex flex-col justify-center gap-3">
        <ProgressFeedback reward={reward} showJournalLink />
        <Link href="/" className={getAppButtonClassName({ variant: "ghost", className: "w-full" })}>Retour à l’accueil</Link>
      </PageShell>
    );
  }

  if (!quest) {
    return (
      <PageShell className="max-w-2xl justify-center" contentClassName="flex flex-col justify-center">
        <ErrorState
          tone="warning"
          message="Quête introuvable. Relance Maintenant pour générer une nouvelle observation."
        />
        <Link
          href="/"
          className={getAppButtonClassName({ className: "mt-4" })}
        >
          Retour à l&apos;accueil
        </Link>
      </PageShell>
    );
  }

  return <CameraGuide quest={quest} onSeen={(photo) => logAndReturn("seen", photo)} onMissed={() => logAndReturn("missed")} />;
}
