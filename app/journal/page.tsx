"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { JournalList } from "@/components/JournalList";
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
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pb-8 pt-6 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8ea0ff]">Journal local</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-white">Observations</h1>
        </div>
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          Accueil
        </Link>
      </header>

      <section className="mt-8 flex-1">
        {observations.length > 0 ? (
          <JournalList observations={observations} onClear={handleClear} />
        ) : (
          <EmptyState
            title="Journal vide"
            message="Marque une quête comme vue ou pas trouvée pour garder une trace locale."
          />
        )}
      </section>
    </main>
  );
}
