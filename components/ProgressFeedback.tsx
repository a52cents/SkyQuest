import Link from "next/link";
import { useEffect, useRef } from "react";
import { AppCard } from "@/components/AppCard";
import { getAppButtonClassName } from "@/components/AppButton";
import { ACHIEVEMENTS, getRankProgress } from "@/lib/progression";
import { haptic } from "@/lib/haptics";
import type { ProgressReward } from "@/lib/types";

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
    <AppCard className="border-accent/25 bg-[linear-gradient(145deg,rgba(117,104,238,0.14),rgba(15,20,34,0.9))]" aria-live="polite">
      <p className="premium-kicker">Progression enregistrée</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        {reward.xpEarned > 0 ? `+${reward.xpEarned} Éclats d’étoile` : "Déjà compté cette nuit"}
      </h2>
      {reward.isFirstDiscovery ? <p className="mt-2 text-sm font-semibold text-accent-cyan">Nouvelle cible dans ton ciel découvert.</p> : null}
      {reward.unlockedAchievements.map((id) => (
        <p key={id} className="mt-2 text-sm font-semibold text-success">
          Accomplissement · {ACHIEVEMENTS.find((item) => item.id === id)?.title ?? id}
        </p>
      ))}
      <div className="mt-4">
        <div className="flex justify-between gap-3 text-xs text-muted">
          <span>{rank.current.name}</span>
          <span>{rank.next ? `${rank.xpToNext} Éclats avant ${rank.next.name}` : "Rang maximal"}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-cyan" style={{ width: `${rank.progressPercent}%` }} />
        </div>
      </div>
      {showJournalLink ? (
        <Link href="/journal" className={getAppButtonClassName({ className: "mt-5 w-full" })}>
          Voir mon journal
        </Link>
      ) : null}
    </AppCard>
  );
}
