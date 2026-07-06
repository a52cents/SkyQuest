"use client";

import Link from "next/link";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { ObservationReportPicker } from "@/components/ObservationReportPicker";
import { TargetWatchButton } from "@/components/TargetWatchButton";
import { isQuestFresh } from "@/lib/quest-freshness";
import { isIssQuestGuidable } from "@/lib/iss";
import type { Observation, SkyQuest } from "@/lib/types";

const ADVICE: Record<string, string> = {
  clouds: "Attends une éclaircie : quelques minutes peuvent suffire.",
  blocked_horizon: "Décale-toi légèrement pour dégager l’horizon, sans quitter un endroit sûr.",
  uncertain_direction: "Commence par le repère cardinal, puis remonte doucement dans le ciel.",
  too_faint: "Laisse tes yeux s’habituer à l’obscurité ou essaie avec des jumelles.",
  not_enough_time: "Garde cette cible pour une nouvelle tentative plus tranquille.",
};

export function MissedObservationFeedback({
  observation,
  quest,
  onRetry,
  onObservationUpdated,
}: {
  observation: Observation;
  quest: SkyQuest;
  onRetry: () => void;
  onObservationUpdated: (observation: Observation) => void;
}) {
  const reportValue = observation.observationReport?.value;
  const advice =
    (reportValue ? ADVICE[reportValue] : null) ??
    (observation.weather && observation.weather.cloudCover >= 60
      ? ADVICE.clouds
      : "Les conditions et le repérage varient vite : ta tentative reste utile.");
  const canRetry =
    isQuestFresh(quest) &&
    (quest.targetType !== "satellite" || isIssQuestGuidable(quest.startsAt, quest.endsAt));
  const tonightHref = `/tonight?target=${encodeURIComponent(observation.target)}`;

  return (
    <AppCard className="border-accent/20 bg-surface-strong">
      <p className="premium-kicker">Tentative enregistrée</p>
      <h2 className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-2xl text-white">
        Ce n’est pas grave
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Tu sauras mieux où chercher la prochaine fois.
      </p>
      <p className="mt-3 rounded-[12px] border border-white/[0.07] bg-white/[0.03] p-3 text-sm leading-6 text-text">
        {advice}
      </p>
      <ObservationReportPicker observation={observation} onUpdated={onObservationUpdated} />
      <div className="mt-5 grid gap-2">
        {canRetry ? (
          <AppButton fullWidth onClick={onRetry}>
            Réessayer maintenant
          </AppButton>
        ) : null}
        <Link
          href={tonightHref}
          className={getAppButtonClassName({
            variant: canRetry ? "secondary" : "primary",
            fullWidth: true,
          })}
        >
          Voir le meilleur créneau
        </Link>
        {observation.targetType !== "free_observation" ? (
          <TargetWatchButton
            target={observation.target}
            reason="missed_retry"
            label="Me prévenir pour cette cible"
          />
        ) : null}
      </div>
      {!canRetry ? (
        <p className="mt-3 text-xs leading-5 text-faint">
          Cette estimation a vieilli : SkyQuest recalculera le ciel avant le prochain guidage.
        </p>
      ) : null}
    </AppCard>
  );
}
