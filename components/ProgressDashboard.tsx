import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppCard } from "@/components/AppCard";
import {
  ACHIEVEMENTS,
  COLLECTION_CATEGORIES,
  getAchievementProgress,
  getRankProgress,
  getStreakDisplayState,
} from "@/lib/progression";
import type { ProgressProfile } from "@/lib/types";

export function ProgressDashboard({ profile }: { profile: ProgressProfile }) {
  const rank = getRankProgress(profile.totalXp);
  const achievements = getAchievementProgress(profile);
  const streakDisplay = getStreakDisplayState(profile, new Date());
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
        <p className="premium-kicker">Mon ciel découvert</p>
        <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl font-normal tracking-[-0.02em] text-white">
          {profile.discoveredTargets.length} cible
          {profile.discoveredTargets.length !== 1 ? "s" : ""} unique
          {profile.discoveredTargets.length !== 1 ? "s" : ""}
        </h2>
        <motion.div
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {COLLECTION_CATEGORIES.map((category) => {
            const count = profile.discoveredTargets.filter(
              (target) => target.targetType === category.type,
            ).length;
            return (
              <motion.div
                key={category.type}
                className={`rounded-[12px] border p-3 ${count > 0 ? "border-accent/20 bg-accent/[0.07]" : "border-white/[0.06] bg-white/[0.02]"}`}
                variants={itemVariants}
              >
                <p className={`text-sm font-semibold ${count > 0 ? "text-white" : "text-faint"}`}>
                  {category.label}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {count > 0 ? `${count} découverte${count > 1 ? "s" : ""}` : "Non découvert"}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </AppCard>

      <AppCard as="section" variant="solid">
        <p className="premium-kicker">Rythme d’observation</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal tracking-[-0.03em] text-white">
              {streakDisplay.displayStreak} nuit{streakDisplay.displayStreak > 1 ? "s" : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Record · {profile.longestStreak} nuit{profile.longestStreak > 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-3xl text-accent" aria-hidden="true">
            ✦
          </span>
        </div>
        {streakDisplay.message ? (
          <p className="mt-3 text-sm font-medium text-accent">{streakDisplay.message}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-white">Streak Freeze</p>
            <p className="text-xs text-muted">Protège une nuit manquée.</p>
          </div>
          <div
            className={`flex items-center gap-2 text-sm font-bold ${profile.streakFreezeCount > 0 ? "text-white" : "text-faint"}`}
          >
            <span aria-hidden="true">❄</span>
            <span>{profile.streakFreezeCount}/1</span>
          </div>
        </div>
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
