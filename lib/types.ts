export type SkyObjectName = "Moon" | "Venus" | "Jupiter" | "Saturn" | "Mars";

export type QuestTargetType =
  | "moon"
  | "planet"
  | "star"
  | "asterism"
  | "constellation"
  | "star_cluster"
  | "galaxy"
  | "meteor_shower"
  | "satellite"
  | "free_observation";

export type RequiredGear = "naked_eye" | "binoculars_recommended";

export type QuestDifficulty = "easy" | "medium";

export type AchievementId =
  | "first-look"
  | "planet-tour"
  | "night-landmarks"
  | "orbital-watcher"
  | "persistent"
  | "explorer"
  | "confirmed-watcher";

export type SkyObject = {
  name: SkyObjectName;
  azimuth: number;
  altitude: number;
  magnitudeHint: "very-bright" | "bright" | "medium";
};

export type WeatherNow = {
  cloudCover: number;
  isDay: boolean;
  temperature?: number;
};

export type VisibilityLabel = "Excellente chance" | "Bonne chance" | "Tentable" | "Pas conseillé";

export type SkyQuest = {
  id: string;
  target: string;
  targetType: QuestTargetType;
  title: string;
  difficulty: QuestDifficulty;
  azimuth: number | null;
  altitude: number | null;
  cardinalDirection: string | null;
  visibilityScore: number;
  visibilityLabel: string;
  description: string;
  tip: string;
  requiredGear: RequiredGear;
  warning?: string;
};

export type Observation = {
  id: string;
  createdAt: string;
  questTitle: string;
  target: string;
  status: "seen" | "missed";
  visibilityScore: number;
  targetType?: QuestTargetType;
  difficulty?: QuestDifficulty;
  xpEarned?: number;
  isFirstDiscovery?: boolean;
  unlockedAchievements?: AchievementId[];
  latitude?: number;
  longitude?: number;
  photoDataUrl?: string;
  photoThumbnailDataUrl?: string;
};

export type DiscoveredTarget = {
  target: string;
  targetType: QuestTargetType;
  discoveredAt: string;
};

export type UnlockedAchievement = {
  id: AchievementId;
  unlockedAt: string;
};

export type RewardHistoryEntry = {
  key: string;
  target: string;
  localNight: string;
  awardedXp: number;
  status: Observation["status"];
  hadMissed: boolean;
  updatedAt: string;
};

export type ProgressProfile = {
  version: 1;
  totalXp: number;
  discoveredTargets: DiscoveredTarget[];
  unlockedAchievements: UnlockedAchievement[];
  rewardHistory: RewardHistoryEntry[];
  updatedAt: string;
};

export type ProgressReward = {
  xpEarned: number;
  totalXp: number;
  isFirstDiscovery: boolean;
  unlockedAchievements: AchievementId[];
  rankName: string;
  nextRankName: string | null;
  xpToNextRank: number;
};
