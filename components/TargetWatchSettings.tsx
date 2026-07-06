"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { cancelTargetWatch, getTargetWatches } from "@/lib/push-client";
import type { TargetWatch } from "@/lib/push-types";
import { getWatchableTargetLabel } from "@/lib/target-watch";

export function TargetWatchSettings() {
  const [watches, setWatches] = useState<TargetWatch[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void getTargetWatches().then(setWatches);
  }, []);

  if (watches.length === 0) return null;

  async function cancel(watchId?: string) {
    setBusyId(watchId ?? "all");
    if (await cancelTargetWatch(watchId)) {
      setWatches((current) => (watchId ? current.filter((item) => item.id !== watchId) : []));
    }
    setBusyId(null);
  }

  return (
    <section className="mt-4 border-t border-white/[0.07] pt-4">
      <p className="text-sm font-semibold text-text">Cibles surveillées</p>
      <div className="mt-2 grid gap-2">
        {watches.map((watch) => (
          <div
            key={watch.id}
            className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.03] p-3"
          >
            <span className="text-sm text-muted">{getWatchableTargetLabel(watch.target)}</span>
            <AppButton
              variant="ghost"
              size="sm"
              isLoading={busyId === watch.id}
              onClick={() => void cancel(watch.id)}
            >
              Annuler
            </AppButton>
          </div>
        ))}
      </div>
      <AppButton
        variant="ghost"
        size="sm"
        className="mt-2"
        isLoading={busyId === "all"}
        onClick={() => void cancel()}
      >
        Tout désactiver
      </AppButton>
    </section>
  );
}
