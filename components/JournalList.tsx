import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import type { Observation } from "@/lib/types";
import { useState } from "react";

type JournalListProps = {
  observations: Observation[];
  onClear: () => void;
};

export function JournalList({ observations, onClear }: JournalListProps) {
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      {previewPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Apercu photo">
          <div className="w-full max-w-3xl">
            <div
              className="h-[70dvh] rounded-brand-lg border border-brand-border bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${previewPhoto})` }}
            />
            <AppButton variant="ghost" className="mt-3" fullWidth onClick={() => setPreviewPhoto(null)}>
              Fermer
            </AppButton>
          </div>
        </div>
      ) : null}

      <AppCard className="rounded-[28px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">Historique</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">Observations récentes</h2>
          </div>
          <AppButton variant="danger" size="sm" onClick={onClear}>
            Vider
          </AppButton>
        </div>
      </AppCard>

      {observations.map((observation) => (
        <AppCard as="article" key={observation.id} className="rounded-[24px]" padding="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-faint">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(observation.createdAt),
                )}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{observation.questTitle}</h3>
              <p className="mt-1 text-sm text-muted">Objet : {observation.target}</p>
            </div>
            {observation.photoThumbnailDataUrl || observation.photoDataUrl ? (
              <button
                type="button"
                aria-label="Voir la photo"
                onClick={() => setPreviewPhoto(observation.photoDataUrl ?? observation.photoThumbnailDataUrl ?? null)}
                className="h-16 w-16 shrink-0 rounded-brand border border-brand-border bg-cover bg-center"
                style={{ backgroundImage: `url(${observation.photoThumbnailDataUrl ?? observation.photoDataUrl})` }}
              />
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                observation.status === "seen" ? "bg-success/12 text-success" : "bg-white/[0.06] text-muted"
              }`}
            >
              {observation.status === "seen" ? "Vu" : "Pas trouvé"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
            <span className="rounded-full bg-white/[0.05] px-3 py-1">Score {observation.visibilityScore}</span>
            {observation.latitude !== undefined && observation.longitude !== undefined ? (
              <span className="rounded-full bg-white/[0.05] px-3 py-1">
                {observation.latitude.toFixed(2)}, {observation.longitude.toFixed(2)}
              </span>
            ) : null}
          </div>
        </AppCard>
      ))}
    </div>
  );
}
