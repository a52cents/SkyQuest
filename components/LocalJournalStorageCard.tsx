"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function LocalJournalStorageCard() {
  const [usage, setUsage] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void navigator.storage?.estimate?.().then((estimate) => {
      if (active && typeof estimate.usage === "number") setUsage(formatBytes(estimate.usage));
    });
    void navigator.storage?.persisted?.().then((persisted) => {
      if (active) setIsPersisted(persisted);
    });
    return () => {
      active = false;
    };
  }, []);

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setMessage("Cette protection n’est pas proposée par ce navigateur.");
      return;
    }
    const persisted = await navigator.storage.persist().catch(() => false);
    setIsPersisted(persisted);
    setMessage(
      persisted
        ? "Le navigateur a accepté de mieux protéger les données locales."
        : "Le navigateur n’a pas accordé cette protection pour le moment.",
    );
  }

  return (
    <AppCard as="section" variant="subtle" padding="sm">
      <p className="premium-kicker">Stockage du journal</p>
      <h2 className="mt-1 text-lg font-semibold text-text">Sur cet appareil</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {usage ? `SkyQuest utilise environ ${usage} de stockage local. ` : ""}
        Ce journal n’est pas une sauvegarde multi-appareil et le navigateur peut encore effacer ses
        données dans certains cas.
      </p>
      {isPersisted ? (
        <p className="mt-3 text-sm font-semibold text-success">Protection locale accordée</p>
      ) : (
        <AppButton
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => void requestPersistence()}
        >
          Protéger mon journal sur cet appareil
        </AppButton>
      )}
      {message ? (
        <p className="mt-2 text-xs leading-5 text-muted" role="status">
          {message}
        </p>
      ) : null}
    </AppCard>
  );
}
