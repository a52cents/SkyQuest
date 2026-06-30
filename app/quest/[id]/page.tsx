"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { CameraGuide } from "@/components/CameraGuide";
import { ErrorState } from "@/components/ErrorState";
import { PageShell } from "@/components/PageShell";
import { addObservation, getActiveQuest, getLastLocation } from "@/lib/storage";
import type { Observation, SkyQuest } from "@/lib/types";

export default function QuestGuidePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [quest, setQuest] = useState<SkyQuest | null>(null);

  useEffect(() => {
    const stored = getActiveQuest();
    if (stored && stored.id === params.id) {
      setQuest(stored);
    }
  }, [params.id]);

  function logAndReturn(status: "seen" | "missed", photo?: Pick<Observation, "photoDataUrl" | "photoThumbnailDataUrl">) {
    if (quest) {
      addObservation(quest, status, getLastLocation() ?? undefined, photo);
    }
    router.push("/journal");
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
