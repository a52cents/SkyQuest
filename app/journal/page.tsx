"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAppButtonClassName } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { JournalList } from "@/components/JournalList";
import { PageShell } from "@/components/PageShell";
import { clearObservations, getObservations } from "@/lib/storage";
import type { Observation } from "@/lib/types";

export default function JournalPage() {
  const [observations, setObservations] = useState<Observation[]>([]);

  useEffect(() => {
    setObservations(getObservations());
  }, []);

  function handleClear() {
    clearObservations();
    setObservations([]);
  }

  return (
    <PageShell
      eyebrow="Journal local"
      title="Observations"
      action={(
        <Link href="/" className={getAppButtonClassName({ variant: "ghost", size: "sm" })}>
          Accueil
        </Link>
      )}
      contentClassName="mt-8"
    >
        {observations.length > 0 ? (
          <JournalList observations={observations} onClear={handleClear} />
        ) : (
          <EmptyState
            title="Journal vide"
            message="Marque une quête comme vue ou pas trouvée pour garder une trace locale."
          />
        )}
    </PageShell>
  );
}
