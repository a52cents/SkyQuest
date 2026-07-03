import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { AppCard } from "@/components/AppCard";
import { getAppButtonClassName } from "@/components/AppButton";
import { ACHIEVEMENTS, getRankProgress } from "@/lib/progression";
import { haptic } from "@/lib/haptics";
import type { ProgressReward } from "@/lib/types";

function AnimatedXp({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionValue = useMotionValue(prefersReducedMotion ? value : 0);
  const roundedValue = useTransform(motionValue, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(prefersReducedMotion ? value : 0);

  useMotionValueEvent(roundedValue, "change", (latest) => {
    setDisplayValue(latest);
  });

  useEffect(() => {
    setDisplayValue(prefersReducedMotion ? value : 0);
    const controls = animate(motionValue, value, {
      duration: prefersReducedMotion ? 0 : 0.6,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [motionValue, prefersReducedMotion, value]);

  return <span>+{displayValue} Éclats d’étoile</span>;
}

export function ProgressFeedback({
  reward,
  showJournalLink = false,
  previousRankName,
}: {
  reward: ProgressReward;
  showJournalLink?: boolean;
  previousRankName?: string | null;
}) {
  const rank = getRankProgress(reward.totalXp);
  const currentRankName = rank.current.name;
  const didAnnounceRef = useRef(false);
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (didAnnounceRef.current) {
      return;
    }

    didAnnounceRef.current = true;

    if (reward.unlockedAchievements.length > 0) {
      haptic("achievement");
    }

    if (previousRankName && previousRankName !== currentRankName) {
      haptic("rank-up");
    }
  }, [previousRankName, currentRankName, reward.unlockedAchievements.length]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${reward.totalXp}-${reward.xpEarned}-${currentRankName}`}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9, y: 20 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { type: "spring", stiffness: 200, damping: 20 },
              }
        }
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.15 } }
        }
      >
        <AppCard
          className="border-accent/25 bg-surface-strong bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_48%)]"
          aria-live="polite"
        >
          <p className="premium-kicker">Progression enregistrée</p>
          <h2 className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
            {reward.xpEarned > 0 ? (
              <AnimatedXp value={reward.xpEarned} />
            ) : (
              "Déjà compté cette nuit"
            )}
          </h2>
          {reward.streakMessage ? (
            <p className="mt-2 text-sm font-semibold text-accent">{reward.streakMessage}</p>
          ) : null}
          {reward.isFirstDiscovery ? (
            <p className="mt-2 text-sm font-semibold text-accent">
              Nouvelle cible dans ton ciel découvert.
            </p>
          ) : null}
          {reward.unlockedAchievements.map((id) => (
            <p key={id} className="mt-2 text-sm font-semibold text-success">
              Accomplissement · {ACHIEVEMENTS.find((item) => item.id === id)?.title ?? id}
            </p>
          ))}
          <div className="mt-4">
            <div className="flex justify-between gap-3 text-xs text-muted">
              <span>{rank.current.name}</span>
              <span>
                {rank.next
                  ? `${rank.xpToNext} Éclats d’étoile avant ${rank.next.name}`
                  : "Rang maximal"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-accent shadow-[0_0_14px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
                initial={prefersReducedMotion ? false : { width: 0 }}
                animate={{ width: `${rank.progressPercent}%` }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }
                }
              />
            </div>
          </div>
          {showJournalLink ? (
            <Link href="/journal" className={getAppButtonClassName({ className: "mt-5 w-full" })}>
              Voir mon journal
            </Link>
          ) : null}
        </AppCard>
      </motion.div>
    </AnimatePresence>
  );
}
