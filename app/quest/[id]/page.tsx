"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CameraGuide } from "@/components/CameraGuide";
import { ErrorState } from "@/components/ErrorState";
import { addObservation, getActiveQuest, getLastLocation } from "@/lib/storage";
import type { SkyQuest } from "@/lib/types";

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

  function logAndReturn(status: "seen" | "missed") {
    if (quest) {
      addObservation(quest, status, getLastLocation() ?? undefined);
    }
    router.push("/journal");
  }

  if (!quest) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-5">
        <ErrorState
          tone="warning"
          message="Quête introuvable. Relance Maintenant pour générer une nouvelle observation."
        />
        <Link
          href="/"
          className="mt-4 flex min-h-14 items-center justify-center rounded-full bg-[#7c5cff] px-6 text-base font-bold text-white"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  return <CameraGuide quest={quest} onSeen={() => logAndReturn("seen")} onMissed={() => logAndReturn("missed")} />;
}
