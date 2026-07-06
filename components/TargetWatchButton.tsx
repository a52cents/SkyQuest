"use client";

import { useState } from "react";
import { AppButton } from "@/components/AppButton";
import { getLastLocation } from "@/lib/storage";
import { isTargetWatchSupported, watchTarget } from "@/lib/push-client";
import type { TargetWatchReason } from "@/lib/push-types";
import { resolveWatchableTarget } from "@/lib/target-watch";

export function TargetWatchButton({
  target,
  reason,
  label,
}: {
  target: string;
  reason: TargetWatchReason;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!isTargetWatchSupported() || !resolveWatchableTarget(target)) return null;

  async function enable() {
    setBusy(true);
    setMessage(null);
    const result = await watchTarget({ target, reason, location: getLastLocation() });
    setBusy(false);
    setMessage(
      result.ok
        ? "Cible surveillée pendant 14 jours."
        : (result.error ?? "Ce rappel n’a pas pu être créé."),
    );
  }

  return (
    <div>
      <AppButton variant="secondary" fullWidth isLoading={busy} onClick={() => void enable()}>
        {label}
      </AppButton>
      <p className="mt-2 text-[11px] leading-4 text-faint">
        SkyQuest enregistre seulement cette cible et ta zone approximative pour préparer ce rappel.
      </p>
      {message ? (
        <p className="mt-2 text-xs text-accent-cyan" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
