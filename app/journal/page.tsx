"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { EmptyState } from "@/components/EmptyState";
import { JournalList } from "@/components/JournalList";
import { PageShell } from "@/components/PageShell";
import {
  clearObservations,
  countObservations,
  getObservationPage,
  resetProgressProfile,
} from "@/lib/storage";
import type { Observation } from "@/lib/types";

export default function JournalPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [destructiveError, setDestructiveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<"journal" | "progress" | null>(null);

  useEffect(() => {
    let isActive = true;
    void Promise.all([getObservationPage({ limit: 20 }), countObservations()]).then(
      ([storedObservations, count]) => {
        if (!isActive) return;
        setObservations(storedObservations);
        setTotalCount(count);
      },
    );
    return () => {
      isActive = false;
    };
  }, []);

  function handleClear() {
    setDestructiveError(null);
    setConfirmation("journal");
  }

  async function handleLoadMore() {
    const last = observations.at(-1);
    if (!last || isLoadingMore) return;
    setIsLoadingMore(true);
    const next = await getObservationPage({
      before: { createdAt: last.createdAt, id: last.id },
      limit: 20,
    });
    setObservations((current) => [
      ...current,
      ...next.filter((item) => !current.some((stored) => stored.id === item.id)),
    ]);
    setIsLoadingMore(false);
  }

  function handleResetProgress() {
    setDestructiveError(null);
    setConfirmation("progress");
  }

  async function confirmDestructiveAction() {
    if (isApplyingAction) return;
    setIsApplyingAction(true);
    setDestructiveError(null);
    if (confirmation === "journal") {
      const result = await clearObservations();
      if (!result.cleared) {
        setDestructiveError(
          "Le journal n’a pas pu être supprimé. Aucune observation n’a été masquée. Réessaie.",
        );
        setIsApplyingAction(false);
        return;
      }
      setObservations([]);
      setTotalCount(0);
    } else if (confirmation === "progress") {
      resetProgressProfile();
    }
    setIsApplyingAction(false);
    setConfirmation(null);
  }

  return (
    <PageShell eyebrow="Mémoire locale" title="Journal" contentClassName="pb-4">
      <AnimatePresence>
        {confirmation ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-background/85 p-3 backdrop-blur-xl sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
          >
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
            >
              <AppCard padding="lg">
                <p className="premium-kicker">Action locale</p>
                <h2
                  id="confirmation-title"
                  className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-text"
                >
                  {confirmation === "journal"
                    ? "Vider le journal ?"
                    : "Réinitialiser la progression ?"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {confirmation === "journal"
                    ? "Les observations seront supprimées de cet appareil. La progression sera conservée."
                    : "Les rangs, découvertes et accomplissements seront remis à zéro. Le journal sera conservé."}
                </p>
                {destructiveError ? (
                  <p
                    className="mt-4 rounded-brand border border-danger/25 bg-danger/10 px-3 py-2 text-sm leading-6 text-danger"
                    role="alert"
                  >
                    {destructiveError}
                  </p>
                ) : null}
                <div className="mt-6 grid gap-2">
                  <AppButton
                    variant="danger"
                    onClick={confirmDestructiveAction}
                    isLoading={isApplyingAction}
                    fullWidth
                  >
                    Confirmer
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    onClick={() => setConfirmation(null)}
                    disabled={isApplyingAction}
                    fullWidth
                  >
                    Annuler
                  </AppButton>
                </div>
              </AppCard>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="grid gap-5">
        <Link href="/atlas" className="block rounded-[20px]">
          <AppCard
            variant="subtle"
            padding="sm"
            className="border-accent/20 bg-accent/[0.04] transition-colors hover:border-accent/40"
          >
            <div className="flex min-h-11 items-center justify-between gap-4">
              <div>
                <p className="font-[Georgia,'Times_New_Roman',serif] text-lg text-text">
                  Mon atlas
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted">Retrouver mes découvertes</p>
              </div>
              <span className="text-xl text-accent" aria-hidden="true">
                ✦
              </span>
            </div>
          </AppCard>
        </Link>
        {observations.length > 0 ? (
          <JournalList
            observations={observations}
            totalCount={totalCount}
            onClear={handleClear}
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
          />
        ) : (
          <EmptyState
            title="Journal vide"
            message="Marque une quête comme vue ou pas trouvée pour garder une trace locale."
          />
        )}
        <Link href="/glossary" className="block rounded-[20px]">
          <AppCard
            variant="subtle"
            padding="sm"
            className="transition-colors hover:border-accent/30"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[Georgia,'Times_New_Roman',serif] text-lg text-text">
                  Glossaire
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">Comprendre les termes du ciel</p>
              </div>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] font-bold text-accent-cyan"
                aria-hidden="true"
              >
                ?
              </span>
            </div>
          </AppCard>
        </Link>
        <AppCard variant="subtle" padding="sm">
          <p className="font-[Georgia,'Times_New_Roman',serif] text-lg text-text">
            Données locales
          </p>
          <p className="mt-1 text-xs leading-5 text-faint">
            {"Cette action ne supprime pas les observations du journal."}
          </p>
          <AppButton
            type="button"
            variant="danger"
            size="sm"
            onClick={handleResetProgress}
            className="mt-4"
          >
            Réinitialiser la progression
          </AppButton>
        </AppCard>
      </div>
    </PageShell>
  );
}
