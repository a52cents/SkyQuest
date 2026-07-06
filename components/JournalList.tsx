import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { ObservationMemoryCard } from "@/components/ObservationMemoryCard";
import { getObservationTargetLabel, getSeasonLabel, getWeatherLabel } from "@/lib/observation-card";
import { getObservationReportLabel } from "@/lib/observation-report";
import { getPhotoObjectUrl, revokePhotoObjectUrl } from "@/lib/photo-db";
import type { Observation } from "@/lib/types";
import { formatVisibilityScore, formatVisibilityScoreForAccessibility } from "@/lib/visibility";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type JournalListProps = {
  observations: Observation[];
  totalCount: number;
  onClear: () => void;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
};

type AlbumGroup = {
  key: string;
  title: string;
  season: string;
  observations: Observation[];
};

function isFreeObservation(observation: Observation): boolean {
  return (
    observation.targetType === "free_observation" ||
    observation.target.toLowerCase() === "freeobservation"
  );
}

function groupAlbum(observations: Observation[]): AlbumGroup[] {
  const groups = new Map<string, AlbumGroup>();
  observations.forEach((observation) => {
    const date = new Date(observation.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = groups.get(key);
    if (existing) {
      existing.observations.push(observation);
      return;
    }
    groups.set(key, {
      key,
      title: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date),
      season: getSeasonLabel(date),
      observations: [observation],
    });
  });
  return [...groups.values()];
}

export function JournalList({
  observations,
  totalCount,
  onClear,
  onLoadMore,
  isLoadingMore = false,
}: JournalListProps) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string | null>>({});
  const [memoryObservation, setMemoryObservation] = useState<Observation | null>(null);
  const [view, setView] = useState<"album" | "history">("album");
  const prefersReducedMotion = useReducedMotion() ?? false;
  const albumGroups = useMemo(
    () =>
      groupAlbum(
        observations.filter(
          (observation) => observation.status === "seen" && !isFreeObservation(observation),
        ),
      ),
    [observations],
  );
  const listVariants: Variants = prefersReducedMotion
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const itemVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];
    void Promise.all(
      observations.map(async (observation) => {
        const photoId = observation.photoThumbnailId ?? observation.photoId;
        if (!photoId) return [observation.id, null] as const;
        const url = await getPhotoObjectUrl(photoId).catch(() => null);
        if (url) createdUrls.push(url);
        return [observation.id, url] as const;
      }),
    ).then((entries) => {
      if (active) setThumbnailUrls(Object.fromEntries(entries));
      else createdUrls.forEach(revokePhotoObjectUrl);
    });
    return () => {
      active = false;
      createdUrls.forEach(revokePhotoObjectUrl);
    };
  }, [observations]);

  return (
    <div className="grid gap-4">
      {memoryObservation ? (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-background/95 p-3 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Carte souvenir"
        >
          <div className="mx-auto w-full max-w-md py-3">
            <ObservationMemoryCard
              observation={memoryObservation}
              onClose={() => setMemoryObservation(null)}
            />
          </div>
        </div>
      ) : null}

      <div className="border-b border-white/[0.06] pb-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="premium-kicker">Mémoire locale</p>
            <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
              Mon ciel observé
            </h2>
            <p className="mt-1 text-sm text-faint">
              {totalCount} souvenir{totalCount > 1 ? "s" : ""} sur cet appareil
            </p>
          </div>
          <AppButton variant="danger" size="sm" onClick={onClear}>
            Vider
          </AppButton>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-full border border-white/[0.08] bg-white/[0.025] p-1">
          {(["album", "history"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
                view === option ? "bg-accent text-white" : "text-muted"
              }`}
              aria-pressed={view === option}
            >
              {option === "album" ? "Album" : "Historique"}
            </button>
          ))}
        </div>
      </div>

      {view === "album" ? (
        albumGroups.length > 0 ? (
          <div className="grid gap-7">
            {albumGroups.map((group) => (
              <section key={group.key} aria-labelledby={`album-${group.key}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3
                    id={`album-${group.key}`}
                    className="font-[Georgia,'Times_New_Roman',serif] text-xl capitalize text-white"
                  >
                    {group.title}
                  </h3>
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-accent-cyan">
                    {group.season}
                  </span>
                </div>
                <motion.div
                  className="grid grid-cols-2 gap-3"
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                >
                  {group.observations.map((observation) => (
                    <motion.button
                      key={observation.id}
                      type="button"
                      variants={itemVariants}
                      onClick={() => setMemoryObservation(observation)}
                      className="group relative aspect-[4/5] overflow-hidden rounded-[18px] border border-white/[0.1] bg-surface-strong bg-[radial-gradient(circle_at_70%_15%,color-mix(in_srgb,var(--accent)_36%,transparent),transparent_35%)] text-left shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
                      aria-label={`Ouvrir la carte de ${getObservationTargetLabel(observation)}. ${formatVisibilityScoreForAccessibility(observation.visibilityScore)}`}
                    >
                      {thumbnailUrls[observation.id] ? (
                        <span
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${thumbnailUrls[observation.id]})` }}
                        />
                      ) : null}
                      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,14,0.1),rgba(5,6,14,0.25)_38%,rgba(5,6,14,0.96))]" />
                      <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-white backdrop-blur-md">
                        {observation.questKind === "evening" ? "Quête du soir" : "✦ SKYQUEST"}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 p-3">
                        <span className="block font-[Georgia,'Times_New_Roman',serif] text-lg leading-tight text-white">
                          {getObservationTargetLabel(observation)}
                        </span>
                        <span className="mt-1 block text-[11px] text-white/65">
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(observation.createdAt))}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] font-semibold text-white/80">
                          <span>{getWeatherLabel(observation)}</span>
                          <span>{formatVisibilityScore(observation.visibilityScore)}</span>
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              </section>
            ))}
          </div>
        ) : (
          <AppCard variant="subtle" padding="sm">
            <p className="text-sm leading-6 text-muted">
              Ton album apparaîtra après ta première cible repérée.
            </p>
          </AppCard>
        )
      ) : (
        <motion.div className="grid gap-3" variants={listVariants} initial="hidden" animate="show">
          {observations.map((observation) => (
            <motion.div key={observation.id} variants={itemVariants}>
              <AppCard
                as="article"
                padding="sm"
                className="transition-colors hover:border-white/[0.14]"
              >
                <div className="flex items-start gap-3">
                  {thumbnailUrls[observation.id] ? (
                    <div
                      className="h-16 w-14 shrink-0 rounded-[12px] border border-white/10 bg-cover bg-center"
                      style={{ backgroundImage: `url(${thumbnailUrls[observation.id]})` }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.08em] text-faint">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(observation.createdAt))}
                    </p>
                    <h3 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-lg text-white">
                      {getObservationTargetLabel(observation)}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
                      {observation.questKind === "evening" ? (
                        <span className="rounded-md bg-accent/[0.09] px-2 py-1 text-accent-cyan">
                          Quête du soir
                        </span>
                      ) : null}
                      <span className="rounded-md bg-white/[0.04] px-2 py-1">
                        {isFreeObservation(observation)
                          ? observation.status === "seen"
                            ? "Quelque chose remarqué"
                            : "Rien de particulier"
                          : observation.status === "seen"
                            ? "Vu"
                            : "Pas trouvé"}
                      </span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-1">
                        {formatVisibilityScore(observation.visibilityScore)}
                      </span>
                      {typeof observation.xpEarned === "number" ? (
                        <span className="rounded-md bg-accent/[0.09] px-2 py-1 text-accent-cyan">
                          +{observation.xpEarned} Éclats d’étoile
                        </span>
                      ) : null}
                      {getObservationReportLabel(observation.observationReport) ? (
                        <span className="rounded-md bg-white/[0.04] px-2 py-1 text-text">
                          {getObservationReportLabel(observation.observationReport)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {observation.status === "seen" && !isFreeObservation(observation) ? (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setMemoryObservation(observation)}
                      className="shrink-0 border-accent/25 bg-accent/[0.09] text-xs text-accent-cyan"
                    >
                      Carte
                    </AppButton>
                  ) : null}
                </div>
              </AppCard>
            </motion.div>
          ))}
        </motion.div>
      )}
      {observations.length < totalCount ? (
        <AppButton fullWidth variant="secondary" isLoading={isLoadingMore} onClick={onLoadMore}>
          Afficher plus
        </AppButton>
      ) : null}
    </div>
  );
}
