import { getMoonIllumination, getSkyObjects, getSunAltitude } from "@/lib/astro";
import { generateQuests } from "@/lib/quest-generator";
import type { LightPollutionEstimate } from "@/lib/light-pollution";
import type { LightingPracticeEstimate } from "@/lib/lighting-practices";
import { catalogSkyObjects } from "@/lib/sky-catalog";
import { calculateFogRisk, selectBestWindowRange } from "@/lib/sky-window-score";
import type {
  BestSkyWindow,
  SkyWindowHour,
  WeatherForecast,
  WeatherHour,
  WeatherNow,
} from "@/lib/types";

const HOUR_MS = 60 * 60 * 1000;
const TARGET_LABELS: Record<string, string> = {
  Moon: "Lune",
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export { calculateFogRisk } from "@/lib/sky-window-score";

function getDarknessScore(sunAltitude: number): number {
  if (sunAltitude <= -18) return 30;
  if (sunAltitude <= -12) return 26;
  if (sunAltitude <= -6) return 18;
  if (sunAltitude <= 0) return 6;
  return 0;
}

function getTargetLabel(target: string): string {
  return (
    TARGET_LABELS[target] ??
    catalogSkyObjects.find((object) => object.id === target)?.frenchName ??
    target
  );
}

function getMoonPhaseLabel(illumination: number): string {
  if (illumination < 0.08) return "Nouvelle Lune";
  if (illumination < 0.42) return "Croissant lunaire";
  if (illumination < 0.58) return "Quartier de Lune";
  if (illumination < 0.92) return "Lune gibbeuse";
  return "Pleine Lune";
}

function scoreHour({
  latitude,
  longitude,
  hour,
  lightPollution,
  lightingPractice,
}: {
  latitude: number;
  longitude: number;
  hour: WeatherHour;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate | null;
}): SkyWindowHour {
  const date = new Date(hour.date);
  const sunAltitude = getSunAltitude(latitude, longitude, date);
  const fogRisk = calculateFogRisk(hour);
  const weather: WeatherNow = {
    cloudCover: hour.cloudCover,
    isDay: sunAltitude > 0,
    temperature: hour.temperature,
  };
  const quests = generateQuests({
    latitude,
    longitude,
    weather,
    now: date,
    lightPollution,
    lightingPractice,
    limit: 5,
  }).filter((quest) => quest.targetType !== "free_observation");
  const bestTargets = quests.slice(0, 3).map((quest) => getTargetLabel(quest.target));
  const targetQuality = quests[0]?.visibilityScore ?? 0;
  const cloudScore = (1 - hour.cloudCover / 100) * 45;
  const fogPenalty = fogRisk === "high" ? 20 : fogRisk === "moderate" ? 8 : 0;
  const moon = getSkyObjects(latitude, longitude, date).find((object) => object.name === "Moon");
  const moonPenalty =
    moon && moon.altitude > 10 && getMoonIllumination(date) > 0.75 && bestTargets.length > 0
      ? 4
      : 0;
  let score = cloudScore + getDarknessScore(sunAltitude) + targetQuality * 0.25;
  score -= fogPenalty + moonPenalty;
  if (sunAltitude > -6) score = Math.min(score, 35);

  return {
    date: hour.date,
    score: clampScore(score),
    cloudCover: hour.cloudCover,
    relativeHumidity: hour.relativeHumidity,
    fogRisk,
    sunAltitude,
    isAstronomicalDark: sunAltitude <= -18,
    bestTargets,
  };
}

export function calculateBestSkyWindow({
  latitude,
  longitude,
  forecast,
  lightPollution,
  lightingPractice,
  now = new Date(),
}: {
  latitude: number;
  longitude: number;
  forecast: WeatherForecast;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate | null;
  now?: Date;
}): BestSkyWindow {
  const hours = forecast.hours
    .filter((hour) => new Date(hour.date).getTime() >= now.getTime() - HOUR_MS)
    .slice(0, 24)
    .map((hour) => scoreHour({ latitude, longitude, hour, lightPollution, lightingPractice }));

  if (hours.length === 0) throw new Error("No hourly forecast available");

  const nightHours = hours.filter((hour) => hour.sunAltitude <= -6);
  const candidates = nightHours.length > 0 ? nightHours : hours;
  const bestHour = candidates.reduce((best, hour) => (hour.score > best.score ? hour : best));
  const { startIndex, endIndex } = selectBestWindowRange(
    hours,
    hours.findIndex((hour) => hour.date === bestHour.date),
  );

  const targetPool = hours.slice(startIndex, endIndex + 1).flatMap((hour) => hour.bestTargets);
  const bestTargets = [...new Set(targetPool)].slice(0, 3);
  const moonIllumination = getMoonIllumination(new Date(bestHour.date));

  return {
    generatedAt: now.toISOString(),
    startsAt: hours[startIndex].date,
    endsAt: new Date(new Date(hours[endIndex].date).getTime() + HOUR_MS).toISOString(),
    score: bestHour.score,
    bestTargets,
    moonIlluminationPercent: Math.round(moonIllumination * 100),
    moonPhaseLabel: getMoonPhaseLabel(moonIllumination),
    hours,
    timezone: forecast.timezone,
    isEstimated: forecast.isEstimated,
  };
}
