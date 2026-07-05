"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import {
  createObservationCardBlob,
  getObservationBadgeLabels,
  getObservationTargetLabel,
} from "@/lib/observation-card";
import type { Observation } from "@/lib/types";
import { getRankProgress } from "@/lib/progression";
import { getProgressProfile } from "@/lib/storage";
import { formatVisibilityScoreForAccessibility } from "@/lib/visibility";

type ObservationMemoryCardProps = {
  observation: Observation;
  onClose?: () => void;
};

function getFileName(observation: Observation): string {
  const target = getObservationTargetLabel(observation)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `skyquest-${target || "observation"}-${observation.createdAt.slice(0, 10)}.png`;
}

export function ObservationMemoryCard({ observation, onClose }: ObservationMemoryCardProps) {
  const cardObservation = useMemo(() => {
    if (
      typeof observation.totalXp === "number" &&
      typeof observation.rankName === "string" &&
      typeof observation.streak === "number"
    ) {
      return observation;
    }
    const profile = getProgressProfile();
    return {
      ...observation,
      totalXp: observation.totalXp ?? profile.totalXp,
      rankName: observation.rankName ?? getRankProgress(profile.totalXp).current.name,
      streak: observation.streak ?? profile.currentStreak,
    };
  }, [observation]);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const badges = useMemo(() => getObservationBadgeLabels(cardObservation), [cardObservation]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setCardBlob(null);
    setCardUrl(null);
    setError(null);

    void createObservationCardBlob(cardObservation)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setCardBlob(blob);
        setCardUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError("La carte n’a pas pu être créée sur cet appareil.");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cardObservation]);

  function saveCard() {
    if (!cardUrl) return;
    const link = document.createElement("a");
    link.href = cardUrl;
    link.download = getFileName(observation);
    link.click();
    setMessage("Carte enregistrée.");
  }

  async function shareCard() {
    if (!cardBlob) return;
    const file = new File([cardBlob], getFileName(observation), { type: "image/png" });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `J’ai repéré ${getObservationTargetLabel(observation)} avec SkyQuest`,
          text: "Mon souvenir d’observation SkyQuest",
          files: [file],
        });
        setMessage("Carte partagée.");
        return;
      }
      saveCard();
      setMessage("Le partage d’image n’est pas disponible ici. La carte a été enregistrée.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setMessage("Partage impossible. Tu peux enregistrer la carte à la place.");
    }
  }

  return (
    <AppCard
      as="section"
      className="overflow-hidden border-accent/25 bg-surface bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_42%)]"
      padding="sm"
      aria-label={`Carte souvenir de l’observation. ${formatVisibilityScoreForAccessibility(observation.visibilityScore)}`}
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <p className="premium-kicker">Souvenir débloqué</p>
          <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-white">
            Ta carte d’observation
          </h2>
        </div>
        {onClose ? (
          <AppButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-11 w-11 px-0 text-lg text-muted"
            aria-label="Fermer la carte"
          >
            ×
          </AppButton>
        ) : null}
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-white/[0.12] bg-[#0b0d18] shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
        {cardUrl ? (
          // The canvas export is the source of truth, so the preview exactly matches the shared file.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardUrl}
            alt={`Carte souvenir SkyQuest. ${formatVisibilityScoreForAccessibility(observation.visibilityScore)}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            {error ?? "Création de la carte…"}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-accent/25 bg-accent/[0.1] px-3 py-1 text-xs font-bold text-accent-cyan"
          >
            ✦ {badge}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton onClick={() => void shareCard()} disabled={!cardBlob} fullWidth>
          Partager
        </AppButton>
        <AppButton variant="secondary" onClick={saveCard} disabled={!cardBlob} fullWidth>
          Enregistrer
        </AppButton>
      </div>
      {message ? (
        <p className="mt-3 text-center text-xs leading-5 text-muted" role="status">
          {message}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[11px] leading-4 text-faint">
        Générée sur cet appareil. Aucune photo n’est envoyée.
      </p>
    </AppCard>
  );
}
