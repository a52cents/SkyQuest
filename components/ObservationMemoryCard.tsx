"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import {
  createObservationCardBlob,
  getObservationCardRarity,
  getObservationTargetLabel,
} from "@/lib/observation-card";
import type { Observation } from "@/lib/types";
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
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rarity = useMemo(() => getObservationCardRarity(observation), [observation]);
  const isShiny = rarity === "rare";

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setCardBlob(null);
    setCardUrl(null);
    setError(null);

    void createObservationCardBlob(observation)
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
  }, [observation]);

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
      className={`overflow-hidden bg-surface ${
        isShiny
          ? "border-accent-cyan/35 shadow-[0_20px_70px_rgba(89,85,255,0.16)]"
          : "border-white/[0.09]"
      }`}
      padding="sm"
      aria-label={`Carte souvenir de l’observation. ${formatVisibilityScoreForAccessibility(observation.visibilityScore)}`}
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <p className="premium-kicker">{isShiny ? "Carte rare" : "Souvenir"}</p>
          <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-white">
            {getObservationTargetLabel(observation)}
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

      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#0b0d18] shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
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
        {cardUrl && isShiny ? <div className="observation-card-shine" aria-hidden="true" /> : null}
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
    </AppCard>
  );
}
