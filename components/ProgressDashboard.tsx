import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppCard } from "@/components/AppCard";
import { getAppButtonClassName } from "@/components/AppButton";
import { buildDiscoveryAtlasProgress } from "@/lib/discovery-atlas";
import {
  ACHIEVEMENTS,
  getAchievementProgress,
  getRankProgress,
  getWeeklyStreakDisplayState,
} from "@/lib/progression";
import type { Observation, ProgressProfile } from "@/lib/types";

export function ProgressDashboard({
  profile,
  observations,
}: {
  profile: ProgressProfile;
  observations: Observation[];
}) {
  const rank = getRankProgress(profile.totalXp);
  const achievements = getAchievementProgress(profile);
  // Legacy profiles used getStreakDisplayState(profile, new Date()); their fields stay stored but
  // are intentionally absent from this UI.
  const streakDisplay = getWeeklyStreakDisplayState(profile, new Date());
  const atlas = buildDiscoveryAtlasProgress({ profile, observations });
  const prefersReducedMotion = useReducedMotion() ?? false;

  const containerVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      }
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.08 } },
      };

  const itemVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        show: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 150, damping: 20 } },
      };

  return (
    <div className="grid gap-4">
      <AppCard className="overflow-hidden border-accent/20 bg-surface-strong bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_48%)]">
        <p className="premium-kicker">Ma progression</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
              {rank.current.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{profile.totalXp} Éclats d’étoile</p>
          </div>
          <span className="text-3xl text-accent" aria-hidden="true">
            ✦
          </span>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-accent shadow-[0_0_14px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${rank.progressPercent}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-xs text-faint">
          {rank.next
            ? `${rank.xpToNext} Éclats d’étoile avant ${rank.next.name}`
            : "Tous les rangs symboliques sont atteints."}
        </p>
        <p className="mt-3 text-sm font-semibold text-accent-cyan">
          {profile.eveningQuestCompletionCount} quête
          {profile.eveningQuestCompletionCount !== 1 ? "s" : ""} du soir accomplie
          {profile.eveningQuestCompletionCount !== 1 ? "s" : ""}
        </p>
      </AppCard>

      <AppCard as="section">
        <p className="premium-kicker">Mon atlas du ciel</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] border border-accent/20 bg-accent/[0.07] p-3">
            <p className="text-2xl font-semibold text-white">{atlas.discoveredCount}</p>
            <p className="mt-1 text-xs text-muted">objets découverts</p>
          </div>
          <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-2xl font-semibold text-accent-cyan">
              {Math.round(atlas.completionPercent)}%
            </p>
            <p className="mt-1 text-xs text-muted">de l’atlas complété</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {atlas.latestDiscovery
            ? `Dernière découverte : ${atlas.latestDiscovery.frenchName}`
            : "Ta première découverte t’attend."}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.round(atlas.completionPercent)}%` }}
          />
        </div>
        <Link
          href="/atlas"
          className={getAppButtonClassName({ fullWidth: true, className: "mt-4" })}
        >
          Ouvrir mon atlas
        </Link>
      </AppCard>

      <AppCard as="section" variant="solid">
        <p className="premium-kicker">Rythme d’observation</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
              {streakDisplay.successfulNights}/2 nuits cette semaine
            </h2>
            <p className="mt-1 text-sm text-muted">
              Série · {streakDisplay.displayStreak} semaine
              {streakDisplay.displayStreak > 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-3xl text-accent" aria-hidden="true">
            ✦
          </span>
        </div>
        {streakDisplay.message ? (
          <p className="mt-3 text-sm font-medium text-accent">{streakDisplay.message}</p>
        ) : null}
        <p className="mt-3 text-xs text-faint">
          Record · {profile.longestWeeklyStreak} semaine
          {profile.longestWeeklyStreak > 1 ? "s" : ""}
        </p>
      </AppCard>

      <AppCard as="section">
        <p className="premium-kicker">Accomplissements</p>
        <motion.div
          className="mt-4 grid gap-2"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              className={`rounded-[12px] border p-3 ${achievement.unlocked ? "border-success/20 bg-success/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}
              variants={itemVariants}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`font-semibold ${achievement.unlocked ? "text-white" : "text-muted"}`}
                >
                  {achievement.title}
                </p>
                <span
                  className={`text-xs font-bold ${achievement.unlocked ? "text-success" : "text-faint"}`}
                >
                  {achievement.unlocked
                    ? "Débloqué"
                    : `${achievement.progress}/${achievement.goal}`}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-faint">
                {ACHIEVEMENTS.find((item) => item.id === achievement.id)?.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </AppCard>
    </div>
  );
}
