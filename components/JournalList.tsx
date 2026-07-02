import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { getPhotoObjectUrl, revokePhotoObjectUrl } from "@/lib/photo-db";
import type { Observation } from "@/lib/types";
import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type JournalListProps = {
  observations: Observation[];
  onClear: () => void;
};

export function JournalList({ observations, onClear }: JournalListProps) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string | null>>({});
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const listVariants: Variants = prefersReducedMotion
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
  const itemVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    let isActive = true;
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
      if (isActive) {
        setThumbnailUrls(Object.fromEntries(entries));
      } else {
        createdUrls.forEach(revokePhotoObjectUrl);
      }
    });

    return () => {
      isActive = false;
      createdUrls.forEach(revokePhotoObjectUrl);
    };
  }, [observations]);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setPreviewUrl(undefined);

    if (previewPhotoId) {
      void getPhotoObjectUrl(previewPhotoId)
        .catch(() => null)
        .then((url) => {
          objectUrl = url;
          if (isActive) setPreviewUrl(url);
          else if (url) revokePhotoObjectUrl(url);
        });
    }

    return () => {
      isActive = false;
      if (objectUrl) revokePhotoObjectUrl(objectUrl);
    };
  }, [previewPhotoId]);

  return (
    <div className="grid gap-4">
      {previewPhotoId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0b]/90 p-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu photo"
        >
          <div className="w-full max-w-3xl">
            {previewUrl ? (
              <div
                className="h-[70dvh] rounded-[22px] border border-white/[0.12] bg-contain bg-center bg-no-repeat shadow-2xl"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
            ) : (
              <div className="flex h-[70dvh] items-center justify-center rounded-[22px] border border-white/[0.12] bg-white/[0.04] p-6 text-center text-sm text-muted">
                {previewUrl === undefined
                  ? "Chargement de la photoâ€¦"
                  : "Cette photo n'est plus disponible sur cet appareil."}
              </div>
            )}
            <AppButton
              variant="ghost"
              className="mt-3"
              fullWidth
              onClick={() => setPreviewPhotoId(null)}
            >
              Fermer
            </AppButton>
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <p className="premium-kicker">Historique</p>
          <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
            Observations récentes
          </h2>
          <p className="mt-1 text-sm text-faint">
            {observations.length} entrée{observations.length > 1 ? "s" : ""} sur cet appareil
          </p>
        </div>
        <AppButton variant="danger" size="sm" onClick={onClear}>
          Vider
        </AppButton>
      </div>

      <motion.div className="grid gap-3" variants={listVariants} initial="hidden" animate="show">
        {observations.map((observation) => (
          <motion.div
            key={observation.id}
            variants={itemVariants}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
          >
            <AppCard
              as="article"
              className="transition-colors hover:border-white/[0.14]"
              padding="sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-faint">
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(observation.createdAt))}
                  </p>
                  <h3 className="mt-1.5 font-[Georgia,'Times_New_Roman',serif] text-lg font-normal tracking-[-0.02em] text-white">
                    {observation.questTitle}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{observation.target}</p>
                </div>
                {observation.photoThumbnailId || observation.photoId ? (
                  <button
                    type="button"
                    aria-label="Voir la photo"
                    onClick={() =>
                      setPreviewPhotoId(observation.photoId ?? observation.photoThumbnailId ?? null)
                    }
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.12] bg-white/[0.04] bg-cover bg-center text-[10px] text-faint transition-transform active:scale-95"
                    style={
                      thumbnailUrls[observation.id]
                        ? { backgroundImage: `url(${thumbnailUrls[observation.id]})` }
                        : undefined
                    }
                  >
                    {thumbnailUrls[observation.id] ? null : "Photo"}
                  </button>
                ) : null}
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    observation.status === "seen"
                      ? "border-success/20 bg-success/[0.09] text-success"
                      : "border-white/[0.08] bg-white/[0.04] text-muted"
                  }`}
                >
                  {observation.status === "seen" ? "Vu" : "Pas trouvé"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-3 text-xs text-muted">
                <span className="rounded-md bg-white/[0.035] px-2.5 py-1">
                  Conditions {observation.visibilityScore}/100
                </span>
                {typeof observation.xpEarned === "number" ? (
                  <span className="rounded-md bg-accent/[0.09] px-2.5 py-1 font-semibold text-[#bdb7ff]">
                    +{observation.xpEarned} Éclats
                  </span>
                ) : null}
                {observation.latitude !== undefined && observation.longitude !== undefined ? (
                  <span className="rounded-md bg-white/[0.035] px-2.5 py-1">
                    {observation.latitude.toFixed(2)}, {observation.longitude.toFixed(2)}
                  </span>
                ) : null}
              </div>
            </AppCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
