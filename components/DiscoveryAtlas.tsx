"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { DiscoveryAtlasCard } from "@/components/DiscoveryAtlasCard";
import { ObservationMemoryCard } from "@/components/ObservationMemoryCard";
import { TargetWatchButton } from "@/components/TargetWatchButton";
import {
  buildDiscoveryAtlasProgress,
  filterDiscoveryAtlasEntries,
  type DiscoveryAtlasProgressEntry,
  type DiscoveryStatus,
} from "@/lib/discovery-atlas";
import { getPhotoObjectUrl, revokePhotoObjectUrl } from "@/lib/photo-db";
import type { Observation, ProgressProfile } from "@/lib/types";

type AtlasFilter = "all" | DiscoveryStatus;

const filterOptions: Array<{ value: AtlasFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "discovered", label: "Découvertes" },
  { value: "attempted", label: "Tentées" },
  { value: "locked", label: "À découvrir" },
];

const statusLabels: Record<DiscoveryStatus, string> = {
  discovered: "Découverte",
  attempted: "Déjà tentée",
  locked: "À découvrir",
};

function formatDate(value: string | null): string {
  if (!value) return "Non renseignée";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(date);
}

function EntryDetail({
  entry,
  onClose,
}: {
  entry: DiscoveryAtlasProgressEntry;
  onClose: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const photoId = entry.recentMemory?.photoThumbnailId ?? entry.recentMemory?.photoId;
    if (!photoId) {
      setThumbnailUrl(null);
      return;
    }
    void getPhotoObjectUrl(photoId)
      .then((url) => {
        if (!active) {
          if (url) revokePhotoObjectUrl(url);
          return;
        }
        createdUrl = url;
        setThumbnailUrl(url);
      })
      .catch(() => setThumbnailUrl(null));
    return () => {
      active = false;
      if (createdUrl) revokePhotoObjectUrl(createdUrl);
    };
  }, [entry.recentMemory]);

  if (showMemory && entry.recentMemory) {
    return (
      <div className="mx-auto w-full max-w-md py-3">
        <ObservationMemoryCard
          observation={entry.recentMemory}
          onClose={() => setShowMemory(false)}
        />
      </div>
    );
  }

  const tryHref = `/?app=1&target=${encodeURIComponent(entry.target)}`;

  return (
    <AppCard padding="md" className="relative mx-auto my-3 w-full max-w-md">
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        aria-label="Fermer la fiche"
      >
        ×
      </button>
      <p className="premium-kicker pr-12">{entry.categoryLabel}</p>
      <h2
        id="atlas-entry-title"
        className="mt-2 pr-12 font-[Georgia,'Times_New_Roman',serif] text-2xl text-text"
      >
        {entry.frenchName}
      </h2>
      <span className="mt-3 inline-flex rounded-full border border-accent/25 bg-accent/[0.1] px-3 py-1 text-xs font-bold text-accent-cyan">
        {statusLabels[entry.status]}
      </span>

      {thumbnailUrl ? (
        // The URL is local, short-lived, and revoked by the effect cleanup.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt="Dernier souvenir local"
          className="mt-4 aspect-[16/9] w-full rounded-[14px] border border-white/10 object-cover"
        />
      ) : null}

      <p className="mt-4 text-sm leading-6 text-muted">{entry.shortDescription}</p>
      <dl className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
            Première découverte
          </dt>
          <dd className="mt-1 text-xs leading-5 text-text">
            {formatDate(entry.firstDiscoveredAt)}
          </dd>
        </div>
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
            Dernière observation
          </dt>
          <dd className="mt-1 text-xs leading-5 text-text">{formatDate(entry.lastObservedAt)}</dd>
        </div>
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
            Réussites au journal
          </dt>
          <dd className="mt-1 text-lg font-semibold text-text">
            {entry.successfulObservationCount}
          </dd>
        </div>
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] p-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
            Tentatives manquées
          </dt>
          <dd className="mt-1 text-lg font-semibold text-text">{entry.missedObservationCount}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-2">
        {entry.catalogId ? (
          <Link
            href={`/explore/${entry.catalogId}`}
            className={getAppButtonClassName({ variant: "secondary", fullWidth: true })}
          >
            Voir dans Explorer
          </Link>
        ) : null}
        {entry.status === "discovered" && entry.recentMemory ? (
          <AppButton variant="secondary" fullWidth onClick={() => setShowMemory(true)}>
            Voir mes souvenirs
          </AppButton>
        ) : entry.status === "discovered" ? (
          <Link
            href="/journal"
            className={getAppButtonClassName({ variant: "secondary", fullWidth: true })}
          >
            Voir mes souvenirs
          </Link>
        ) : (
          <>
            <Link href={tryHref} className={getAppButtonClassName({ fullWidth: true })}>
              Essayer maintenant
            </Link>
            <TargetWatchButton
              target={entry.target}
              reason="collection_gap"
              label="Surveiller cette cible"
            />
          </>
        )}
      </div>
      {entry.status !== "discovered" ? (
        <p className="mt-3 text-center text-[11px] leading-4 text-faint">
          SkyQuest recalculera le ciel et les conditions avant tout guidage.
        </p>
      ) : null}
    </AppCard>
  );
}

export function DiscoveryAtlas({
  profile,
  observations,
}: {
  profile: ProgressProfile;
  observations: Observation[];
}) {
  const searchParams = useSearchParams();
  const progress = useMemo(
    () => buildDiscoveryAtlasProgress({ profile, observations }),
    [observations, profile],
  );
  const [filter, setFilter] = useState<AtlasFilter>("all");
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DiscoveryAtlasProgressEntry | null>(null);
  const requestedEntryId = searchParams.get("entry");
  const visibleEntries = useMemo(
    () => filterDiscoveryAtlasEntries(progress.entries, filter, categoryLabel),
    [categoryLabel, filter, progress.entries],
  );

  useEffect(() => {
    if (!requestedEntryId) return;
    setSelectedEntry(progress.entries.find((entry) => entry.id === requestedEntryId) ?? null);
  }, [progress.entries, requestedEntryId]);

  const completionPercent = Math.round(progress.completionPercent);

  return (
    <div className="grid gap-4">
      {selectedEntry ? (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-background/92 p-3 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="atlas-entry-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEntry(null);
          }}
        >
          <EntryDetail entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        </div>
      ) : null}

      <AppCard
        padding="sm"
        className="overflow-hidden border-accent/20 bg-surface-strong bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--accent)_15%,transparent),transparent_48%)]"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="premium-kicker">Progression de la collection</p>
            <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-text">
              {progress.discoveredCount} / {progress.totalCount} découvertes
            </h2>
          </div>
          <span className="text-xl font-semibold text-accent-cyan">{completionPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 divide-x divide-white/[0.07] text-xs">
          <div className="pr-3">
            <span className="block text-faint">Déjà tentées</span>
            <strong className="mt-0.5 block text-sm text-text">{progress.attemptedCount}</strong>
          </div>
          <div className="min-w-0 pl-3">
            <span className="block text-faint">Prochain objectif</span>
            <strong className="mt-0.5 block truncate text-sm text-text">
              {progress.nextObjective?.frenchName ?? "Atlas complet"}
            </strong>
          </div>
        </div>
      </AppCard>

      {progress.discoveredCount === 0 ? (
        <AppCard variant="subtle" padding="sm">
          <p className="text-sm leading-6 text-muted">
            Accomplis une quête et indique que tu as trouvé la cible pour l’ajouter à ton atlas.
          </p>
          <Link href="/?app=1" className={getAppButtonClassName({ className: "mt-4 w-full" })}>
            Découvrir mon ciel maintenant
          </Link>
        </AppCard>
      ) : null}

      <section aria-labelledby="atlas-collection-title">
        <div className="mb-2">
          <p className="premium-kicker">Collection</p>
          <h2
            id="atlas-collection-title"
            className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-text"
          >
            Objets du ciel
          </h2>
        </div>
        <div
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2"
          aria-label="Filtres de catégorie"
        >
          <button
            type="button"
            onClick={() => setCategoryLabel(null)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ${
              categoryLabel === null
                ? "border-accent/40 bg-accent/15 text-white"
                : "border-white/[0.08] bg-surface text-muted"
            }`}
            aria-pressed={categoryLabel === null}
          >
            Toutes
          </button>
          {progress.categories.map((category) => (
            <button
              key={category.label}
              type="button"
              onClick={() => setCategoryLabel(category.label)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ${
                categoryLabel === category.label
                  ? "border-accent/40 bg-accent/15 text-white"
                  : "border-white/[0.08] bg-surface text-muted"
              }`}
              aria-pressed={categoryLabel === category.label}
            >
              {category.label} · {category.discoveredCount}/{category.totalCount}
            </button>
          ))}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-3" aria-label="Filtres de statut">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                filter === option.value
                  ? "border-accent bg-accent text-white"
                  : "border-white/[0.1] bg-surface text-muted"
              }`}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        {visibleEntries.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {visibleEntries.map((entry) => (
              <DiscoveryAtlasCard key={entry.id} entry={entry} onSelect={setSelectedEntry} />
            ))}
          </div>
        ) : (
          <AppCard variant="subtle" padding="sm">
            <p className="text-sm text-muted">Aucune entrée avec ces filtres.</p>
            <AppButton
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setFilter("all");
                setCategoryLabel(null);
              }}
            >
              Voir toute la collection
            </AppButton>
          </AppCard>
        )}
      </section>

      {progress.specialDiscoveries.length > 0 ? (
        <section aria-labelledby="special-discoveries-title">
          <p className="premium-kicker">Hors collection principale</p>
          <h2
            id="special-discoveries-title"
            className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-text"
          >
            Découvertes spéciales
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Ces satellites observés enrichissent ton histoire sans modifier le pourcentage de
            l’atlas.
          </p>
          <div className="mt-3 grid gap-2">
            {progress.specialDiscoveries.map((discovery) => (
              <AppCard key={discovery.id} variant="subtle" padding="sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-text">{discovery.frenchName}</h3>
                    <p className="mt-1 text-xs text-muted">
                      Découverte le {formatDate(discovery.firstDiscoveredAt)}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/[0.08] px-2.5 py-1 text-[10px] font-bold text-accent-cyan">
                    Satellite
                  </span>
                </div>
              </AppCard>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
