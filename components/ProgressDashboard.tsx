import { AppCard } from "@/components/AppCard";
import { ACHIEVEMENTS, COLLECTION_CATEGORIES, getAchievementProgress, getRankProgress } from "@/lib/progression";
import type { ProgressProfile } from "@/lib/types";

export function ProgressDashboard({ profile }: { profile: ProgressProfile }) {
  const rank = getRankProgress(profile.totalXp);
  const achievements = getAchievementProgress(profile);

  return (
    <div className="grid gap-4">
      <AppCard className="overflow-hidden border-accent/20 bg-[radial-gradient(circle_at_100%_0%,rgba(115,201,235,0.11),transparent_45%),rgba(15,20,34,0.82)]">
        <p className="premium-kicker">Ma progression</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{rank.current.name}</h2>
            <p className="mt-1 text-sm text-muted">{profile.totalXp} Éclats d’étoile</p>
          </div>
          <span className="text-3xl text-accent-cyan" aria-hidden="true">✦</span>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-cyan" style={{ width: `${rank.progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-faint">
          {rank.next ? `${rank.xpToNext} Éclats avant ${rank.next.name}` : "Tous les rangs symboliques sont atteints."}
        </p>
      </AppCard>

      <AppCard as="section">
        <p className="premium-kicker">Mon ciel découvert</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">
          {profile.discoveredTargets.length} cible{profile.discoveredTargets.length !== 1 ? "s" : ""} unique{profile.discoveredTargets.length !== 1 ? "s" : ""}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLLECTION_CATEGORIES.map((category) => {
            const count = profile.discoveredTargets.filter((target) => target.targetType === category.type).length;
            return (
              <div key={category.type} className={`rounded-[14px] border p-3 ${count > 0 ? "border-accent-cyan/20 bg-accent-cyan/[0.07]" : "border-white/[0.07] bg-white/[0.025]"}`}>
                <p className={`text-sm font-semibold ${count > 0 ? "text-white" : "text-faint"}`}>{category.label}</p>
                <p className="mt-1 text-xs text-muted">{count > 0 ? `${count} découverte${count > 1 ? "s" : ""}` : "Non découvert"}</p>
              </div>
            );
          })}
        </div>
      </AppCard>

      <AppCard as="section" className="border-accent-cyan/15 bg-[linear-gradient(145deg,rgba(17,25,41,0.92),rgba(10,14,24,0.96))]">
        <p className="premium-kicker">Série en cours</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">
              {profile.currentStreak} nuit{profile.currentStreak > 1 ? "s" : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Record · {profile.longestStreak} nuit{profile.longestStreak > 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-3xl text-accent-cyan" aria-hidden="true">🔥</span>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-[16px] border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-white">Streak Freeze</p>
            <p className="text-xs text-muted">Protège une nuit manquée.</p>
          </div>
          <div className={`flex items-center gap-2 text-sm font-bold ${profile.streakFreezeCount > 0 ? "text-white" : "text-faint"}`}>
            <span aria-hidden="true">❄</span>
            <span>{profile.streakFreezeCount}/1</span>
          </div>
        </div>
      </AppCard>

      <AppCard as="section">
        <p className="premium-kicker">Accomplissements</p>
        <div className="mt-4 grid gap-2">
          {achievements.map((achievement) => (
            <div key={achievement.id} className={`rounded-[14px] border p-3 ${achievement.unlocked ? "border-success/20 bg-success/[0.06]" : "border-white/[0.07] bg-white/[0.025]"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`font-semibold ${achievement.unlocked ? "text-white" : "text-muted"}`}>{achievement.title}</p>
                <span className={`text-xs font-bold ${achievement.unlocked ? "text-success" : "text-faint"}`}>
                  {achievement.unlocked ? "Débloqué" : `${achievement.progress}/${achievement.goal}`}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-faint">{ACHIEVEMENTS.find((item) => item.id === achievement.id)?.description}</p>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}
