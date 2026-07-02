/**
 * Progression locale
 *
 * Calcule XP, rangs, premières découvertes, accomplissements et séries à partir d'une
 * observation. Les fonctions restent pures : `storage.ts` est seul responsable de persister
 * le profil retourné.
 *
 * Important :
 * - une observation `missed` reste dans le journal sans devenir une découverte confirmée ;
 * - l'historique de récompenses empêche les gains répétés abusifs pour une même cible/nuit ;
 * - les migrations doivent préserver autant que possible la progression existante ;
 * - ne pas dépendre de l'heure UTC seule pour une notion de « nuit locale ».
 */
import type {
  AchievementId,
  Observation,
  ProgressProfile,
  ProgressReward,
  QuestDifficulty,
  QuestTargetType,
  SkyQuest,
} from "@/lib/types";

export type Rank = {
  name: string;
  minimumXp: number;
};

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  goal: number;
};

export type AchievementProgress = AchievementDefinition & {
  progress: number;
  unlocked: boolean;
  unlockedAt?: string;
};

export const RANKS: readonly Rank[] = [
  { name: "Curieux du ciel", minimumXp: 0 },
  { name: "Éclaireur nocturne", minimumXp: 100 },
  { name: "Veilleur des étoiles", minimumXp: 300 },
  { name: "Pisteur céleste", minimumXp: 700 },
  { name: "Guide du ciel", minimumXp: 1500 },
];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first-look",
    title: "Premier regard",
    description: "Réussir une première observation.",
    goal: 1,
  },
  {
    id: "planet-tour",
    title: "Tour des planètes",
    description: "Observer trois planètes différentes.",
    goal: 3,
  },
  {
    id: "night-landmarks",
    title: "Repères nocturnes",
    description: "Observer trois constellations ou astérismes.",
    goal: 3,
  },
  { id: "orbital-watcher", title: "Guetteur orbital", description: "Observer l’ISS.", goal: 1 },
  {
    id: "persistent",
    title: "Persévérant",
    description: "Réussir une cible déjà manquée.",
    goal: 1,
  },
  { id: "explorer", title: "Explorateur", description: "Découvrir cinq cibles uniques.", goal: 5 },
  {
    id: "confirmed-watcher",
    title: "Veilleur confirmé",
    description: "Réussir dix observations.",
    goal: 10,
  },
];

export const COLLECTION_CATEGORIES: ReadonlyArray<{ type: QuestTargetType; label: string }> = [
  { type: "moon", label: "Lune" },
  { type: "planet", label: "Planètes" },
  { type: "star", label: "Étoiles" },
  { type: "constellation", label: "Constellations" },
  { type: "asterism", label: "Astérismes" },
  { type: "star_cluster", label: "Amas" },
  { type: "galaxy", label: "Galaxie" },
  { type: "meteor_shower", label: "Pluie de météores" },
  { type: "satellite", label: "Satellite" },
];

export function createEmptyProgressProfile(now = new Date(0).toISOString()): ProgressProfile {
  return {
    version: 1,
    totalXp: 0,
    discoveredTargets: [],
    unlockedAchievements: [],
    rewardHistory: [],
    currentStreak: 0,
    longestStreak: 0,
    lastObservationNightKey: null,
    streakFreezeCount: 1,
    lastFreezeRegenerationKey: null,
    updatedAt: now,
  };
}

export function getLocalNightKey(date: Date): string {
  const nightDate = new Date(date);
  nightDate.setHours(nightDate.getHours() - 12);
  const year = nightDate.getFullYear();
  const month = String(nightDate.getMonth() + 1).padStart(2, "0");
  const day = String(nightDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getConditionsBonus(visibilityScore: number): number {
  return Math.min(15, Math.round(Math.max(0, 80 - visibilityScore) / 2));
}

export function getSuccessXp(
  difficulty: QuestDifficulty,
  visibilityScore: number,
  isFirstDiscovery: boolean,
): number {
  const base = difficulty === "easy" ? 40 : 60;
  return Math.min(100, base + getConditionsBonus(visibilityScore) + (isFirstDiscovery ? 25 : 0));
}

export function getRankProgress(totalXp: number): {
  current: Rank;
  next: Rank | null;
  progressPercent: number;
  xpToNext: number;
} {
  const safeXp = Math.max(0, totalXp);
  const current = [...RANKS].reverse().find((rank) => safeXp >= rank.minimumXp) ?? RANKS[0];
  const currentIndex = RANKS.findIndex((rank) => rank.name === current.name);
  const next = RANKS[currentIndex + 1] ?? null;
  const progressPercent = next
    ? Math.min(
        100,
        Math.round(((safeXp - current.minimumXp) / (next.minimumXp - current.minimumXp)) * 100),
      )
    : 100;

  return {
    current,
    next,
    progressPercent,
    xpToNext: next ? Math.max(0, next.minimumXp - safeXp) : 0,
  };
}

function getNightDayNumber(nightKey: string): number {
  const [yearText, monthText, dayText] = nightKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getNightDifference(currentNightKey: string, previousNightKey: string): number {
  return getNightDayNumber(currentNightKey) - getNightDayNumber(previousNightKey);
}

type StreakUpdateResult = {
  profile: ProgressProfile;
  previousStreak: number;
  streakMessage: string | null;
};

function computeStreakOnSuccess(profile: ProgressProfile, now: Date): StreakUpdateResult {
  const currentNightKey = getLocalNightKey(now);
  const previousNightKey = profile.lastObservationNightKey;
  const previousStreak = profile.currentStreak;

  if (previousNightKey === currentNightKey) {
    return { profile, previousStreak, streakMessage: null };
  }

  const timestamp = now.toISOString();
  const nightDifference = previousNightKey
    ? getNightDifference(currentNightKey, previousNightKey)
    : null;
  let currentStreak = 1;
  let streakFreezeCount = Math.min(1, Math.max(0, profile.streakFreezeCount));
  let lastFreezeRegenerationKey = profile.lastFreezeRegenerationKey;
  let streakMessage: string | null = null;

  if (nightDifference === null || nightDifference <= 1) {
    currentStreak = previousStreak > 0 ? previousStreak + 1 : 1;
    streakMessage = `Série de ${currentStreak} nuit${currentStreak > 1 ? "s" : ""} !`;
  } else if (previousStreak > 0) {
    const freezeDifference = lastFreezeRegenerationKey
      ? getNightDifference(currentNightKey, lastFreezeRegenerationKey)
      : Number.POSITIVE_INFINITY;
    if (streakFreezeCount < 1 && freezeDifference >= 7) {
      streakFreezeCount = 1;
      lastFreezeRegenerationKey = currentNightKey;
    }

    if (streakFreezeCount > 0) {
      streakFreezeCount = 0;
      currentStreak = previousStreak + 1;
      streakMessage = `Série de ${currentStreak} nuit${currentStreak > 1 ? "s" : ""} !`;
    } else {
      currentStreak = 1;
      streakMessage = "Ouch, série perdue";
    }
  } else {
    currentStreak = 1;
    streakMessage = "Série de 1 nuit !";
  }

  const nextProfile: ProgressProfile = {
    ...profile,
    currentStreak,
    longestStreak: Math.max(profile.longestStreak, currentStreak),
    lastObservationNightKey: currentNightKey,
    streakFreezeCount,
    lastFreezeRegenerationKey,
    updatedAt: timestamp,
  };

  return { profile: nextProfile, previousStreak, streakMessage };
}

export function updateStreakOnSuccess(profile: ProgressProfile, now: Date): ProgressProfile {
  return computeStreakOnSuccess(profile, now).profile;
}

function getSuccessfulObservationCount(profile: ProgressProfile): number {
  return profile.rewardHistory.filter((entry) => entry.status === "seen").length;
}

function getAchievementValue(profile: ProgressProfile, id: AchievementId): number {
  const discoveries = profile.discoveredTargets;
  switch (id) {
    case "first-look":
      return Math.min(1, getSuccessfulObservationCount(profile));
    case "planet-tour":
      return discoveries.filter((item) => item.targetType === "planet").length;
    case "night-landmarks":
      return discoveries.filter(
        (item) => item.targetType === "constellation" || item.targetType === "asterism",
      ).length;
    case "orbital-watcher":
      return Math.min(1, discoveries.some((item) => item.target.toLowerCase() === "iss") ? 1 : 0);
    case "persistent":
      return Math.min(
        1,
        profile.rewardHistory.some((entry) => entry.status === "seen" && entry.hadMissed) ? 1 : 0,
      );
    case "explorer":
      return discoveries.length;
    case "confirmed-watcher":
      return getSuccessfulObservationCount(profile);
  }
}

export function getAchievementProgress(profile: ProgressProfile): AchievementProgress[] {
  return ACHIEVEMENTS.map((achievement) => {
    const unlock = profile.unlockedAchievements.find((item) => item.id === achievement.id);
    return {
      ...achievement,
      progress: Math.min(achievement.goal, getAchievementValue(profile, achievement.id)),
      unlocked: Boolean(unlock),
      unlockedAt: unlock?.unlockedAt,
    };
  });
}

export function applyQuestReward(
  profile: ProgressProfile,
  quest: SkyQuest,
  status: Observation["status"],
  now: Date,
): { profile: ProgressProfile; reward: ProgressReward } {
  const timestamp = now.toISOString();
  const target = quest.target.trim().toLowerCase();
  const localNight = getLocalNightKey(now);
  const key = `${localNight}:${target}`;
  const existingReward = profile.rewardHistory.find((entry) => entry.key === key);
  const isFreeObservation = quest.targetType === "free_observation";
  const isFirstDiscovery =
    status === "seen" &&
    !isFreeObservation &&
    !profile.discoveredTargets.some((item) => item.target.toLowerCase() === target);
  const desiredXp = isFreeObservation
    ? 15
    : status === "missed"
      ? 10
      : getSuccessXp(quest.difficulty, quest.visibilityScore, isFirstDiscovery);
  const xpEarned = Math.max(0, desiredXp - (existingReward?.awardedXp ?? 0));
  const hadMissed =
    existingReward?.hadMissed === true ||
    existingReward?.status === "missed" ||
    status === "missed" ||
    profile.rewardHistory.some((entry) => entry.target === target && entry.status === "missed");

  const rewardEntry = {
    key,
    target,
    localNight,
    awardedXp: Math.max(existingReward?.awardedXp ?? 0, desiredXp),
    status: status === "seen" ? ("seen" as const) : (existingReward?.status ?? ("missed" as const)),
    hadMissed,
    updatedAt: timestamp,
  };
  const rewardHistory = existingReward
    ? profile.rewardHistory.map((entry) => (entry.key === key ? rewardEntry : entry))
    : [...profile.rewardHistory, rewardEntry];
  const discoveredTargets = isFirstDiscovery
    ? [
        ...profile.discoveredTargets,
        { target: quest.target, targetType: quest.targetType, discoveredAt: timestamp },
      ]
    : profile.discoveredTargets;
  const intermediate: ProgressProfile = {
    ...profile,
    totalXp: profile.totalXp + xpEarned,
    discoveredTargets,
    rewardHistory,
    updatedAt: timestamp,
  };
  const streakResult =
    status === "seen"
      ? computeStreakOnSuccess(intermediate, now)
      : { profile: intermediate, previousStreak: intermediate.currentStreak, streakMessage: null };
  const streakProfile = streakResult.profile;
  const newlyUnlocked = getAchievementProgress(streakProfile)
    .filter((achievement) => achievement.progress >= achievement.goal)
    .map((achievement) => achievement.id)
    .filter((id) => !profile.unlockedAchievements.some((item) => item.id === id));
  const nextProfile: ProgressProfile = {
    ...streakProfile,
    unlockedAchievements: [
      ...profile.unlockedAchievements,
      ...newlyUnlocked.map((id) => ({ id, unlockedAt: timestamp })),
    ],
  };
  const rank = getRankProgress(nextProfile.totalXp);

  return {
    profile: nextProfile,
    reward: {
      xpEarned,
      totalXp: nextProfile.totalXp,
      isFirstDiscovery,
      unlockedAchievements: newlyUnlocked,
      previousStreak: streakResult.previousStreak,
      currentStreak: nextProfile.currentStreak,
      longestStreak: nextProfile.longestStreak,
      streakFreezeCount: nextProfile.streakFreezeCount,
      streakMessage: streakResult.streakMessage,
      rankName: rank.current.name,
      nextRankName: rank.next?.name ?? null,
      xpToNextRank: rank.xpToNext,
    },
  };
}
