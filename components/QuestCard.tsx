import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import type { QuestTargetType, SkyQuest } from "@/lib/types";

type QuestCardProps = {
  quest: SkyQuest;
  onStart: (quest: SkyQuest) => void;
  onSeen: (quest: SkyQuest) => void;
  onMissed: (quest: SkyQuest) => void;
};

const icons: Record<QuestTargetType, string> = {
  moon: "☾",
  planet: "◎",
  star: "✦",
  asterism: "✧",
  constellation: "⌁",
  star_cluster: "✺",
  galaxy: "◉",
  meteor_shower: "☄",
  satellite: "◆",
  free_observation: "✧",
};

const typeLabels: Record<QuestTargetType, string> = {
  moon: "Lune",
  planet: "Planète",
  star: "Étoile",
  asterism: "Repère",
  constellation: "Constellation",
  star_cluster: "Amas d'étoiles",
  galaxy: "Galaxie",
  meteor_shower: "Étoiles filantes",
  satellite: "Satellite",
  free_observation: "Libre",
};

function getGearLabel(quest: SkyQuest): string {
  return quest.requiredGear === "binoculars_recommended" ? "Jumelles conseillées" : "Visible à l'oeil nu";
}

export function QuestCard({ quest, onStart, onSeen, onMissed }: QuestCardProps) {
  return (
    <AppCard as="article" className="overflow-hidden rounded-[28px]">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-brand-border bg-white/[0.07] text-2xl">
          {icons[quest.targetType]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VisibilityBadge label={quest.visibilityLabel} score={quest.visibilityScore} />
            <span className="rounded-full border border-brand-border bg-white/[0.05] px-3 py-1 text-sm font-semibold text-muted">
              {quest.difficulty === "easy" ? "Facile" : "Moyen"}
            </span>
            <span className="rounded-full border border-brand-border bg-white/[0.05] px-3 py-1 text-sm font-semibold text-muted">
              {typeLabels[quest.targetType]}
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-white">{quest.title}</h3>
          <p className="mt-2 text-base leading-6 text-muted">{quest.description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-[22px] border border-brand-border bg-background/35 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Direction</p>
          <p className="mt-1 text-lg font-bold text-white">{quest.cardinalDirection ?? "Libre"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Hauteur</p>
          <p className="mt-1 text-lg font-bold text-white">
            {quest.altitude !== null ? `${Math.round(quest.altitude)}° au-dessus de l'horizon` : "À ton rythme"}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Matériel</p>
          <p className="mt-1 text-lg font-bold text-white">{getGearLabel(quest)}</p>
        </div>
      </div>

      <p className="mt-4 rounded-[20px] bg-accent/10 p-4 text-sm leading-6 text-muted">{quest.tip}</p>
      {quest.warning ? (
        <p className="mt-3 rounded-[18px] border border-warning/25 bg-warning/10 p-3 text-sm font-semibold leading-5 text-warning">
          {quest.warning}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        <AppButton onClick={() => onStart(quest)} fullWidth>
          Commencer
        </AppButton>
        <div className="grid grid-cols-2 gap-3">
          <AppButton variant="success" size="sm" onClick={() => onSeen(quest)}>
            Je l&apos;ai vu
          </AppButton>
          <AppButton variant="ghost" size="sm" onClick={() => onMissed(quest)}>
            Pas trouvé
          </AppButton>
        </div>
      </div>
    </AppCard>
  );
}
