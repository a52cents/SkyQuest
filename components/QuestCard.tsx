import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { haptic } from "@/lib/haptics";
import type { QuestTargetType, SkyQuest } from "@/lib/types";

type QuestCardProps = {
  quest: SkyQuest;
  onStart: (quest: SkyQuest) => void;
  onSeen: (quest: SkyQuest) => void;
  onMissed: (quest: SkyQuest) => void;
  layout?: boolean;
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

export function QuestCard({ quest, onStart, onSeen, onMissed, layout }: QuestCardProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const cardVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        show: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120 } },
      };

  function handleStart() {
    haptic("select");
    onStart(quest);
  }

  return (
    <motion.div layout={layout} initial="hidden" animate="show" variants={cardVariants}>
      <AppCard as="article" className="group relative overflow-hidden rounded-[24px] transition-colors duration-200 hover:border-white/[0.20]">
        <div className="absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-accent/70 to-transparent" aria-hidden="true" />
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-white/[0.09] bg-white/[0.04] text-xl text-accent-cyan shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {icons[quest.targetType]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <VisibilityBadge label={quest.visibilityLabel} score={quest.visibilityScore} />
              <span className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-muted">
                {quest.difficulty === "easy" ? "Facile" : "Moyen"}
              </span>
              <span className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-muted">
                {typeLabels[quest.targetType]}
              </span>
            </div>
            <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-white">{quest.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-6 text-muted">{quest.description}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 rounded-[18px] border border-white/[0.07] bg-black/15 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Direction</p>
            <p className="mt-1 text-base font-semibold text-white">{quest.cardinalDirection ?? "Libre"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Hauteur</p>
            <p className="mt-1 text-base font-semibold leading-5 text-white">
              {quest.altitude !== null ? `${Math.round(quest.altitude)}° au-dessus de l'horizon` : "À ton rythme"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">Matériel</p>
            <p className="mt-1 text-base font-semibold text-white">{getGearLabel(quest)}</p>
          </div>
        </div>

        <p className="mt-4 border-l border-accent/60 py-1 pl-4 text-sm leading-6 text-muted">{quest.tip}</p>
        {quest.warning ? (
          <p className="mt-3 rounded-[14px] border border-warning/20 bg-warning/[0.07] p-3 text-sm font-semibold leading-5 text-warning">
            {quest.warning}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          <AppButton onClick={handleStart} fullWidth>
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
    </motion.div>
  );
}
