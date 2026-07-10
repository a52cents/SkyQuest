import { isLightingPracticeEstimate, type LightingPracticeEstimate } from "./lighting-practices.ts";
import type { LightPollutionEstimate } from "./light-pollution.ts";
import type {
  AirQualityNow,
  BestSkyWindow,
  FogRisk,
  QuestDifficulty,
  QuestKind,
  QuestTargetType,
  RequiredGear,
  SatelliteTrajectoryPoint,
  SkyQuest,
  SkyWindowHour,
  WeatherNow,
} from "./types.ts";

export type StoredLocation = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
};

export type DashboardAnalysis = {
  savedAt: number;
  generatedAt: string;
  position: StoredLocation;
  weather: WeatherNow;
  quests: SkyQuest[];
  bestSkyWindow?: BestSkyWindow;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate;
  airQuality?: AirQualityNow;
};

const TARGET_TYPES = new Set<QuestTargetType>([
  "moon",
  "planet",
  "star",
  "asterism",
  "constellation",
  "star_cluster",
  "galaxy",
  "meteor_shower",
  "satellite",
  "free_observation",
]);
const DIFFICULTIES = new Set<QuestDifficulty>(["easy", "medium"]);
const REQUIRED_GEAR = new Set<RequiredGear>(["naked_eye", "binoculars_recommended"]);
const QUEST_KINDS = new Set<QuestKind>(["standard", "evening"]);
const FOG_RISKS = new Set<FogRisk>(["low", "moderate", "high"]);
const LIGHT_POLLUTION_LEVELS = new Set(["excellent", "good", "moderate", "poor", "very-poor"]);
const LIGHT_POLLUTION_SOURCES = new Set([
  "world-atlas",
  "viirs",
  "black-marble",
  "external-api",
  "fallback",
  "unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseWeatherNow(value: unknown): WeatherNow | null {
  if (!isRecord(value)) return null;
  if (
    !isNumberInRange(value.cloudCover, 0, 100) ||
    typeof value.isDay !== "boolean" ||
    !isOptionalFiniteNumber(value.temperature)
  ) {
    return null;
  }
  return value as WeatherNow;
}

function parseSatelliteTrajectoryPoint(value: unknown): SatelliteTrajectoryPoint | null {
  if (!isRecord(value)) return null;
  if (
    !isValidDateString(value.at) ||
    !isNumberInRange(value.azimuth, 0, 360) ||
    value.azimuth === 360 ||
    !isNumberInRange(value.altitude, -90, 90)
  ) {
    return null;
  }
  return value as SatelliteTrajectoryPoint;
}

export function parseStoredLocation(value: unknown): StoredLocation | null {
  if (!isRecord(value)) return null;
  if (
    !isNumberInRange(value.latitude, -90, 90) ||
    !isNumberInRange(value.longitude, -180, 180) ||
    (value.altitudeMeters !== undefined && !isNumberInRange(value.altitudeMeters, -1_000, 850_000))
  ) {
    return null;
  }
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    ...(typeof value.altitudeMeters === "number" ? { altitudeMeters: value.altitudeMeters } : {}),
  };
}

export function parseSkyQuest(value: unknown): SkyQuest | null {
  if (!isRecord(value)) return null;
  const azimuthValid =
    value.azimuth === null || (isNumberInRange(value.azimuth, 0, 360) && value.azimuth !== 360);
  const altitudeValid = value.altitude === null || isNumberInRange(value.altitude, -90, 90);
  const cardinalDirectionValid =
    value.cardinalDirection === null || typeof value.cardinalDirection === "string";
  const trajectoryValid =
    value.satelliteTrajectory === undefined ||
    (Array.isArray(value.satelliteTrajectory) &&
      value.satelliteTrajectory.every((point) => parseSatelliteTrajectoryPoint(point) !== null));
  const weatherValid = value.weather === undefined || parseWeatherNow(value.weather) !== null;

  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.target !== "string" ||
    value.target.length === 0 ||
    !TARGET_TYPES.has(value.targetType as QuestTargetType) ||
    typeof value.title !== "string" ||
    !DIFFICULTIES.has(value.difficulty as QuestDifficulty) ||
    !azimuthValid ||
    !altitudeValid ||
    !cardinalDirectionValid ||
    !isNumberInRange(value.visibilityScore, 0, 100) ||
    typeof value.visibilityLabel !== "string" ||
    typeof value.description !== "string" ||
    typeof value.tip !== "string" ||
    !REQUIRED_GEAR.has(value.requiredGear as RequiredGear) ||
    !isValidDateString(value.generatedAt) ||
    !isOptionalString(value.warning) ||
    !(value.targetTime === undefined || isValidDateString(value.targetTime)) ||
    !(value.startsAt === undefined || isValidDateString(value.startsAt)) ||
    !(value.endsAt === undefined || isValidDateString(value.endsAt)) ||
    !trajectoryValid ||
    !weatherValid ||
    !(value.questKind === undefined || QUEST_KINDS.has(value.questKind as QuestKind)) ||
    !(
      value.eveningQuestNightKey === undefined ||
      (typeof value.eveningQuestNightKey === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.eveningQuestNightKey))
    )
  ) {
    return null;
  }
  return value as SkyQuest;
}

function parseSkyWindowHour(value: unknown): SkyWindowHour | null {
  if (!isRecord(value)) return null;
  if (
    !isValidDateString(value.date) ||
    !isNumberInRange(value.score, 0, 100) ||
    !isNumberInRange(value.cloudCover, 0, 100) ||
    !isNumberInRange(value.relativeHumidity, 0, 100) ||
    !FOG_RISKS.has(value.fogRisk as FogRisk) ||
    !isNumberInRange(value.sunAltitude, -90, 90) ||
    typeof value.isAstronomicalDark !== "boolean" ||
    !isStringArray(value.bestTargets)
  ) {
    return null;
  }
  return value as SkyWindowHour;
}

export function parseBestSkyWindow(value: unknown): BestSkyWindow | null {
  if (!isRecord(value)) return null;
  if (
    !isValidDateString(value.generatedAt) ||
    !isValidDateString(value.startsAt) ||
    !isValidDateString(value.endsAt) ||
    new Date(value.startsAt).getTime() >= new Date(value.endsAt).getTime() ||
    !isNumberInRange(value.score, 0, 100) ||
    !isStringArray(value.bestTargets) ||
    !isNumberInRange(value.moonIlluminationPercent, 0, 100) ||
    typeof value.moonPhaseLabel !== "string" ||
    !Array.isArray(value.hours) ||
    !value.hours.every((hour) => parseSkyWindowHour(hour) !== null) ||
    typeof value.timezone !== "string" ||
    typeof value.isEstimated !== "boolean"
  ) {
    return null;
  }
  return value as BestSkyWindow;
}

function parseLightPollutionEstimate(value: unknown): LightPollutionEstimate | null {
  if (!isRecord(value)) return null;
  if (
    !LIGHT_POLLUTION_LEVELS.has(String(value.level)) ||
    !isNumberInRange(value.score, 0, 100) ||
    typeof value.label !== "string" ||
    typeof value.shortAdvice !== "string" ||
    !LIGHT_POLLUTION_SOURCES.has(String(value.source)) ||
    !(value.confidence === "high" || value.confidence === "medium" || value.confidence === "low") ||
    !isOptionalFiniteNumber(value.bortleClass) ||
    !isOptionalFiniteNumber(value.sqm) ||
    !isOptionalFiniteNumber(value.radiance) ||
    !(value.cachedAt === undefined || isValidDateString(value.cachedAt))
  ) {
    return null;
  }
  return value as LightPollutionEstimate;
}

function parseAirQualityNow(value: unknown): AirQualityNow | null {
  if (!isRecord(value)) return null;
  const fields = ["europeanAqi", "pm2_5", "pm10", "aerosolOpticalDepth", "dust"] as const;
  if (!fields.every((field) => isOptionalFiniteNumber(value[field]))) return null;
  return value as AirQualityNow;
}

export function parseDashboardAnalysis(value: unknown): DashboardAnalysis | null {
  if (!isRecord(value) || !isFiniteNumber(value.savedAt)) return null;
  const savedAtDate = new Date(value.savedAt);
  if (!Number.isFinite(savedAtDate.getTime())) return null;
  const generatedAt =
    value.generatedAt === undefined
      ? savedAtDate.toISOString()
      : isValidDateString(value.generatedAt)
        ? value.generatedAt
        : null;
  const position = parseStoredLocation(value.position);
  const weather = parseWeatherNow(value.weather);
  const quests =
    Array.isArray(value.quests) && value.quests.length <= 100
      ? value.quests.map(parseSkyQuest)
      : null;
  const bestSkyWindow =
    value.bestSkyWindow === undefined ? undefined : parseBestSkyWindow(value.bestSkyWindow);
  const lightPollution =
    value.lightPollution === undefined
      ? undefined
      : parseLightPollutionEstimate(value.lightPollution);
  const lightingPractice =
    value.lightingPractice === undefined
      ? undefined
      : isLightingPracticeEstimate(value.lightingPractice)
        ? value.lightingPractice
        : null;
  const airQuality =
    value.airQuality === undefined ? undefined : parseAirQualityNow(value.airQuality);

  if (
    !generatedAt ||
    !position ||
    !weather ||
    !quests ||
    quests.some((quest) => quest === null) ||
    bestSkyWindow === null ||
    lightPollution === null ||
    lightingPractice === null ||
    airQuality === null
  ) {
    return null;
  }

  return {
    savedAt: value.savedAt,
    generatedAt,
    position,
    weather,
    quests: quests as SkyQuest[],
    ...(bestSkyWindow ? { bestSkyWindow } : {}),
    ...(lightPollution ? { lightPollution } : {}),
    ...(lightingPractice ? { lightingPractice } : {}),
    ...(airQuality ? { airQuality } : {}),
  };
}
