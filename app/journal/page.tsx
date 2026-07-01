"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { JournalList } from "@/components/JournalList";
import { PageShell } from "@/components/PageShell";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { createEmptyProgressProfile } from "@/lib/progression";
import { clearObservations, getObservations, getProgressProfile, resetProgressProfile } from "@/lib/storage";
import type { Observation, ProgressProfile } from "@/lib/types";

export default function JournalPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [profile, setProfile] = useState<ProgressProfile>(() => createEmptyProgressProfile());

  useEffect(() => {
    setObservations(getObservations());
    setProfile(getProgressProfile());
  }, []);

  function handleClear() {
    if (!window.confirm("Vider uniquement l’historique du journal ? Ta progression et tes Éclats seront conservés.")) {
      return;
    }
    clearObservations();
    setObservations([]);
  }

  function handleResetProgress() {
    if (!window.confirm("Réinitialiser tous les Éclats, rangs, découvertes et accomplissements ? Le journal sera conservé.")) {
      return;
    }
    setProfile(resetProgressProfile());
  }

  return (
    <PageShell
      eyebrow="Mémoire locale"
      title="Observations"
      action={(
        <Link href="/" className={getAppButtonClassName({ variant: "ghost", size: "sm" })}>
          Accueil
        </Link>
      )}
      contentClassName="mt-4 sm:mt-6"
    >
      <div className="grid gap-5">
        <ProgressDashboard profile={profile} />
        {observations.length > 0 ? (
          <JournalList observations={observations} onClear={handleClear} />
        ) : (
          <EmptyState title="Journal vide" message="Marque une quête comme vue ou pas trouvée pour garder une trace locale." />
        )}
        <div className="border-t border-white/[0.08] pt-4">
          <button type="button" onClick={handleResetProgress} className="min-h-11 text-sm font-semibold text-danger underline decoration-danger/40 underline-offset-4">
            Réinitialiser la progression
          </button>
          <p className="mt-1 text-xs text-faint">Cette action ne supprime pas les observations du journal.</p>
        </div>
      </div>
    </PageShell>
  );
}
