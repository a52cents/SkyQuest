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
  | "first-planet"
  | "first-constellation"
  | "moon-hunter"
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

export type AirQualityNow = {
  europeanAqi?: number;
  pm2_5?: number;
  pm10?: number;
  aerosolOpticalDepth?: number;
  dust?: number;
};

export type WeatherHour = {
  date: string;
  cloudCover: number;
  relativeHumidity: number;
  temperature?: number;
  dewPoint?: number;
  visibilityMeters?: number;
};

export type WeatherForecast = {
  hours: WeatherHour[];
  timezone: string;
  isEstimated: boolean;
};

export type FogRisk = "low" | "moderate" | "high";

export type SkyWindowHour = {
  date: string;
  score: number;
  cloudCover: number;
  relativeHumidity: number;
  fogRisk: FogRisk;
  sunAltitude: number;
  isAstronomicalDark: boolean;
  bestTargets: string[];
};

export type BestSkyWindow = {
  generatedAt: string;
  startsAt: string;
  endsAt: string;
  score: number;
  bestTargets: string[];
  moonIlluminationPercent: number;
  moonPhaseLabel: string;
  hours: SkyWindowHour[];
  timezone: string;
  isEstimated: boolean;
};

export type VisibilityLabel = "Excellente chance" | "Bonne chance" | "Tentable" | "Pas conseillé";

export type SatelliteTrajectoryPoint = {
  at: string;
  azimuth: number;
  altitude: number;
};

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
  generatedAt: string;
  warning?: string;
  targetTime?: string;
  startsAt?: string;
  endsAt?: string;
  satelliteTrajectory?: SatelliteTrajectoryPoint[];
  weather?: WeatherNow;
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
  totalXp?: number;
  rankName?: string;
  streak?: number;
  weather?: WeatherNow;
  latitude?: number;
  longitude?: number;
  photoId?: string;
  photoThumbnailId?: string;
};

export type ObservationPhotoDraft = {
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
  currentStreak: number;
  longestStreak: number;
  lastObservationNightKey: string | null;
  streakFreezeCount: number;
  lastFreezeRegenerationKey: string | null;
  updatedAt: string;
};

export type ProgressReward = {
  xpEarned: number;
  totalXp: number;
  isFirstDiscovery: boolean;
  unlockedAchievements: AchievementId[];
  previousStreak: number;
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  streakMessage: string | null;
  rankName: string;
  nextRankName: string | null;
  xpToNextRank: number;
};
