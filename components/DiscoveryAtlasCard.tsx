"use client";

import Image from "next/image";
import type { DiscoveryAtlasProgressEntry } from "@/lib/discovery-atlas";

const statusLabels = {
  discovered: "Découverte",
  attempted: "Déjà tentée",
  locked: "À découvrir",
} as const;

function formatShortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function AtlasIllustration({ entry }: { entry: DiscoveryAtlasProgressEntry }) {
  if (entry.imageSrc) {
    return (
      <Image
        src={entry.imageSrc}
        alt=""
        fill
        sizes="(max-width: 600px) calc(50vw - 25px), 260px"
        className={`object-cover transition duration-300 ${entry.status === "discovered" ? "saturate-100" : "scale-105 saturate-[0.35]"}`}
      />
    );
  }

  const isMoon = entry.targetType === "moon";
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--accent)_28%,transparent),transparent_62%)]">
      <span
        className={`relative block h-16 w-16 rounded-full border border-white/20 shadow-[0_0_32px_color-mix(in_srgb,var(--accent-cyan)_20%,transparent)] ${
          isMoon
            ? "bg-[radial-gradient(circle_at_35%_30%,#f4f4f5,#b9bac6_52%,#777987)]"
            : "bg-[radial-gradient(circle_at_32%_26%,#d7d2ff,var(--accent)_48%,#24204b)]"
        }`}
        aria-hidden="true"
      >
        {isMoon ? (
          <span className="absolute left-2 top-7 h-3 w-3 rounded-full bg-black/10" />
        ) : null}
      </span>
    </span>
  );
}

export function DiscoveryAtlasCard({
  entry,
  onSelect,
}: {
  entry: DiscoveryAtlasProgressEntry;
  onSelect: (entry: DiscoveryAtlasProgressEntry) => void;
}) {
  const discoveryDate = formatShortDate(entry.firstDiscoveredAt);
  const ctaLabel =
    entry.status === "discovered"
      ? "Ouvrir la fiche"
      : entry.status === "attempted"
        ? "Réessayer"
        : "Essayer maintenant";

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="group min-h-11 overflow-hidden rounded-[18px] border border-white/[0.08] bg-surface-strong text-left shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${entry.frenchName}, ${statusLabels[entry.status]}. ${ctaLabel}`}
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-[#0c0d17] sm:aspect-[4/3]">
        <AtlasIllustration entry={entry} />
        <span
          className={`absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(6,6,12,0.72))] ${entry.status === "discovered" ? "" : "bg-black/35"}`}
        />
        <span
          className={`absolute left-2.5 top-2.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] backdrop-blur-md ${
            entry.status === "discovered"
              ? "border-success/25 bg-success/15 text-success"
              : entry.status === "attempted"
                ? "border-accent-cyan/25 bg-black/50 text-accent-cyan"
                : "border-white/15 bg-black/50 text-white/75"
          }`}
        >
          {statusLabels[entry.status]}
        </span>
      </span>
      <span className="block p-2.5 sm:p-3">
        <span className="block min-h-10 font-[Georgia,'Times_New_Roman',serif] text-[0.98rem] leading-tight text-text sm:min-h-11 sm:text-[1.05rem]">
          {entry.frenchName}
        </span>
        {entry.status === "discovered" ? (
          <span className="mt-1.5 block text-[11px] leading-4 text-muted">
            {discoveryDate ? `Découverte le ${discoveryDate}` : "Découverte enregistrée"}
            <span className="mt-0.5 block text-faint">
              {entry.successfulObservationCount} souvenir
              {entry.successfulObservationCount !== 1 ? "s" : ""} dans le journal
            </span>
          </span>
        ) : (
          <span className="mt-1.5 block text-[11px] leading-4 text-muted">
            {entry.status === "attempted"
              ? `${entry.missedObservationCount} tentative${entry.missedObservationCount > 1 ? "s" : ""} notée${entry.missedObservationCount > 1 ? "s" : ""}`
              : entry.categoryLabel}
          </span>
        )}
        <span className="mt-2 flex min-h-10 items-center border-t border-white/[0.06] pt-1.5 text-[11px] font-semibold text-accent-cyan sm:mt-3 sm:min-h-11 sm:pt-2 sm:text-xs">
          {ctaLabel}{" "}
          <span className="ml-auto" aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </button>
  );
}
