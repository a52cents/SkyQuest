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

export const EVENING_QUEST_BONUS_XP = 25;
const EVENING_QUEST_COMPLETION_HISTORY_LIMIT = 180;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first-look",
    title: "Premier regard",
    description: "Réussir une première observation.",
    goal: 1,
  },
  {
    id: "first-planet",
    title: "Première planète",
    description: "Découvrir une première planète.",
    goal: 1,
  },
  {
    id: "first-constellation",
    title: "Première constellation",
    description: "Découvrir une première constellation ou un astérisme.",
    goal: 1,
  },
  {
    id: "moon-hunter",
    title: "Chasseur de Lune",
    description: "Réussir une première observation de la Lune.",
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
    eveningQuestCompletions: [],
    eveningQuestCompletionCount: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastObservationNightKey: null,
    streakFreezeCount: 1,
    lastStreakFreezeUsedNightKey: null,
    lastFreezeRegenerationKey: null,
    weeklyStreak: 0,
    longestWeeklyStreak: 0,
    currentWeek: {
      weekKey: getLocalWeekKey(new Date(now)),
      successfulNightKeys: [],
      completed: false,
    },
    lastCompletedWeekKey: null,
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

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalWeekKey(date: Date): string {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  const dayFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayFromMonday);
  return localDateKey(monday);
}

function parseLocalDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function weekDifference(currentWeekKey: string, previousWeekKey: string): number {
  return Math.round(
    (parseLocalDateKey(currentWeekKey).getTime() - parseLocalDateKey(previousWeekKey).getTime()) /
      (7 * 86_400_000),
  );
}

export function applyWeeklyObservation(
  profile: ProgressProfile,
  localNightKey: string,
  now: Date,
): ProgressProfile {
  const weekKey = getLocalWeekKey(parseLocalDateKey(localNightKey));
  const nowWeekKey = getLocalWeekKey(now);
  if (weekKey !== nowWeekKey) return profile;

  const isCurrentStoredWeek = profile.currentWeek.weekKey === weekKey;
  const previousWeekWasIncomplete =
    !isCurrentStoredWeek && profile.currentWeek.weekKey < weekKey && !profile.currentWeek.completed;
  let weeklyStreak = previousWeekWasIncomplete ? 0 : profile.weeklyStreak;
  if (
    !isCurrentStoredWeek &&
    profile.lastCompletedWeekKey &&
    weekDifference(weekKey, profile.lastCompletedWeekKey) > 1
  ) {
    weeklyStreak = 0;
  }

  const successfulNightKeys = [
    ...new Set([
      ...(isCurrentStoredWeek ? profile.currentWeek.successfulNightKeys : []),
      localNightKey,
    ]),
  ].sort();
  const wasCompleted = isCurrentStoredWeek && profile.currentWeek.completed;
  const completed = successfulNightKeys.length >= 2;
  let lastCompletedWeekKey = profile.lastCompletedWeekKey;

  if (completed && !wasCompleted) {
    weeklyStreak =
      lastCompletedWeekKey && weekDifference(weekKey, lastCompletedWeekKey) === 1
        ? Math.max(1, weeklyStreak) + 1
        : 1;
    lastCompletedWeekKey = weekKey;
  }

  return {
    ...profile,
    weeklyStreak,
    longestWeeklyStreak: Math.max(profile.longestWeeklyStreak, weeklyStreak),
    currentWeek: { weekKey, successfulNightKeys, completed },
    lastCompletedWeekKey,
    updatedAt: now.toISOString(),
  };
}

export type WeeklyStreakDisplayState = {
  successfulNights: number;
  goalNights: 2;
  displayStreak: number;
  message: string;
};

export function getWeeklyStreakDisplayState(
  profile: ProgressProfile,
  now: Date,
): WeeklyStreakDisplayState {
  const weekKey = getLocalWeekKey(now);
  const isCurrentWeek = profile.currentWeek.weekKey === weekKey;
  const successfulNights = isCurrentWeek ? profile.currentWeek.successfulNightKeys.length : 0;
  const lastCompletionDistance = profile.lastCompletedWeekKey
    ? weekDifference(weekKey, profile.lastCompletedWeekKey)
    : Number.POSITIVE_INFINITY;
  const displayStreak = lastCompletionDistance <= 1 ? profile.weeklyStreak : 0;
  return {
    successfulNights: Math.min(2, successfulNights),
    goalNights: 2,
    displayStreak,
    message:
      successfulNights >= 2
        ? "Semaine validée."
        : successfulNights === 1
          ? "Encore une nuit pour valider cette semaine"
          : "Deux nuits différentes valident ta semaine.",
  };
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

export type StreakDisplayStatus = "active" | "at_risk" | "protected" | "expired";

export type StreakDisplayState = {
  displayStreak: number;
  status: StreakDisplayStatus;
  message: string | null;
};

export function getStreakDisplayState(profile: ProgressProfile, now: Date): StreakDisplayState {
  if (profile.currentStreak <= 0 || !profile.lastObservationNightKey) {
    return {
      displayStreak: 0,
      status: "expired",
      message: "Observe cette nuit pour commencer une nouvelle série.",
    };
  }

  const currentNightKey = getLocalNightKey(now);
  const nightDifference = getNightDifference(currentNightKey, profile.lastObservationNightKey);

  if (nightDifference <= 0) {
    return {
      displayStreak: profile.currentStreak,
      status: "active",
      message: `Série de ${profile.currentStreak} nuit${profile.currentStreak > 1 ? "s" : ""} !`,
    };
  }

  if (nightDifference === 1) {
    return {
      displayStreak: profile.currentStreak,
      status: "at_risk",
      message: "Observe cette nuit pour continuer ta série.",
    };
  }

  if (nightDifference === 2 && profile.streakFreezeCount > 0) {
    return {
      displayStreak: profile.currentStreak,
      status: "protected",
      message: "Ton freeze protège cette série.",
    };
  }

  return {
    displayStreak: 0,
    status: "expired",
    message: "Observe cette nuit pour commencer une nouvelle série.",
  };
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
  const nightDifference = previousNightKey
    ? getNightDifference(currentNightKey, previousNightKey)
    : null;

  if (nightDifference !== null && nightDifference <= 0) {
    return { profile, previousStreak, streakMessage: null };
  }

  const timestamp = now.toISOString();
  let currentStreak = 1;
  let streakFreezeCount = Math.min(1, Math.max(0, profile.streakFreezeCount));
  let lastStreakFreezeUsedNightKey = profile.lastStreakFreezeUsedNightKey;
  let lastFreezeRegenerationKey = profile.lastFreezeRegenerationKey;
  let streakMessage: string | null = null;

  if (nightDifference === null || previousStreak <= 0) {
    currentStreak = 1;
    streakMessage = "Série de 1 nuit !";
  } else if (nightDifference === 1) {
    currentStreak = previousStreak + 1;
    streakMessage = `Série de ${currentStreak} nuit${currentStreak > 1 ? "s" : ""} !`;
  } else if (nightDifference === 2) {
    if (streakFreezeCount > 0) {
      streakFreezeCount = 0;
      currentStreak = previousStreak + 1;
      lastStreakFreezeUsedNightKey = currentNightKey;
      streakMessage = "Ton freeze protège cette série.";
    } else {
      currentStreak = 1;
      streakMessage = "Nouvelle série commencée.";
    }
  } else {
    currentStreak = 1;
    streakMessage = "Nouvelle série commencée.";
  }

  // Regeneration happens only after the current streak outcome is settled. A newly
  // available freeze can protect a future gap, never the one handled above.
  if (streakFreezeCount === 0 && lastStreakFreezeUsedNightKey) {
    const nightsSinceFreezeUse = getNightDifference(currentNightKey, lastStreakFreezeUsedNightKey);
    if (nightsSinceFreezeUse >= 7) {
      streakFreezeCount = 1;
      lastFreezeRegenerationKey = currentNightKey;
    }
  }

  const nextProfile: ProgressProfile = {
    ...profile,
    currentStreak,
    longestStreak: Math.max(profile.longestStreak, currentStreak),
    lastObservationNightKey: currentNightKey,
    streakFreezeCount,
    lastStreakFreezeUsedNightKey,
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
    case "first-planet":
      return Math.min(1, discoveries.some((item) => item.targetType === "planet") ? 1 : 0);
    case "first-constellation":
      return Math.min(
        1,
        discoveries.some(
          (item) => item.targetType === "constellation" || item.targetType === "asterism",
        )
          ? 1
          : 0,
      );
    case "moon-hunter":
      return Math.min(1, discoveries.some((item) => item.targetType === "moon") ? 1 : 0);
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
    ? status === "seen"
      ? 15
      : 5
    : status === "missed"
      ? 10
      : getSuccessXp(quest.difficulty, quest.visibilityScore, isFirstDiscovery);
  const standardXpEarned = Math.max(0, desiredXp - (existingReward?.awardedXp ?? 0));
  const isEligibleEveningQuest =
    quest.questKind === "evening" && quest.eveningQuestNightKey === localNight && status === "seen";
  const hasEveningQuestCompletion = profile.eveningQuestCompletions.some(
    (completion) => completion.nightKey === localNight,
  );
  const eveningQuestBonusXp =
    isEligibleEveningQuest && !hasEveningQuestCompletion ? EVENING_QUEST_BONUS_XP : 0;
  const isEveningQuestCompleted = eveningQuestBonusXp > 0;
  const xpEarned = standardXpEarned + eveningQuestBonusXp;
  const eveningQuestCompletionCount = Number.isFinite(profile.eveningQuestCompletionCount)
    ? profile.eveningQuestCompletionCount
    : profile.eveningQuestCompletions.length;
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
    eveningQuestCompletions: isEveningQuestCompleted
      ? [
          ...profile.eveningQuestCompletions,
          {
            nightKey: localNight,
            target: quest.target,
            completedAt: timestamp,
            bonusXp: eveningQuestBonusXp,
          },
        ].slice(-EVENING_QUEST_COMPLETION_HISTORY_LIMIT)
      : profile.eveningQuestCompletions,
    eveningQuestCompletionCount: eveningQuestCompletionCount + (isEveningQuestCompleted ? 1 : 0),
    updatedAt: timestamp,
  };
  const previousWeeklyStreak = intermediate.weeklyStreak;
  // Legacy daily fields remain maintained for backward-compatible local profiles, but the product
  // now displays and rewards only the weekly cadence below.
  const legacyStreakProfile =
    status === "seen" ? computeStreakOnSuccess(intermediate, now).profile : intermediate;
  const streakProfile =
    status === "seen"
      ? applyWeeklyObservation(legacyStreakProfile, localNight, now)
      : legacyStreakProfile;
  const weeklyProgress = getWeeklyStreakDisplayState(streakProfile, now);
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
      eveningQuestBonusXp,
      isEveningQuestCompleted,
      totalXp: nextProfile.totalXp,
      isFirstDiscovery,
      unlockedAchievements: newlyUnlocked,
      previousStreak: previousWeeklyStreak,
      currentStreak: nextProfile.weeklyStreak,
      longestStreak: nextProfile.longestWeeklyStreak,
      streakFreezeCount: nextProfile.streakFreezeCount,
      streakMessage: status === "seen" ? weeklyProgress.message : null,
      rankName: rank.current.name,
      nextRankName: rank.next?.name ?? null,
      xpToNextRank: rank.xpToNext,
    },
  };
}
