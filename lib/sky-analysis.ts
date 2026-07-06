import { fetchAirQualityNow } from "./air-quality.ts";
import { fetchNextIssVisiblePass } from "./iss.ts";
import type { LightPollutionEstimate } from "./light-pollution.ts";
import { fetchLightPollutionEstimate } from "./light-pollution-client.ts";
import type { LightingPracticeEstimate } from "./lighting-practices.ts";
import { fetchLightingPracticeEstimate } from "./lighting-practices-client.ts";
import { generateQuests } from "./quest-generator.ts";
import { fetchTrackedSatellitePasses } from "./satellites.ts";
import { calculateBestSkyWindow } from "./sky-window.ts";
import type { DashboardAnalysis, StoredLocation } from "./storage-parsers.ts";
import type {
  AirQualityNow,
  BestSkyWindow,
  SkyQuest,
  WeatherForecast,
  WeatherNow,
} from "./types.ts";
import {
  fetchWeatherForecast,
  fetchWeatherNow,
  getFallbackWeather,
  getFallbackWeatherForecast,
} from "./weather.ts";

export type SkyAnalysisSnapshot = DashboardAnalysis;

export type SkyAnalysisUpdate = {
  analysis: SkyAnalysisSnapshot;
  weatherNotice: string | null;
  isRefined: boolean;
};

export type SkyAnalysisInput = {
  coords: StoredLocation;
  now?: Date;
  questLimit?: number;
  onInitial?: (update: SkyAnalysisUpdate) => void;
};

type BuildSkyAnalysisInput = {
  coords: StoredLocation;
  weather: WeatherNow;
  forecast: WeatherForecast;
  now: Date;
  savedAt: number;
  questLimit: number;
  issPass?: Awaited<ReturnType<typeof fetchNextIssVisiblePass>> | null;
  satellitePasses?: Awaited<ReturnType<typeof fetchTrackedSatellitePasses>>;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate | null;
  airQuality?: AirQualityNow | null;
};

function getWeatherNotice({
  currentWeatherFailed,
  forecastFailed,
}: {
  currentWeatherFailed: boolean;
  forecastFailed: boolean;
}): string | null {
  if (currentWeatherFailed && forecastFailed) {
    return "Météo indisponible : des estimations prudentes sont utilisées.";
  }
  if (currentWeatherFailed) {
    return "Météo actuelle indisponible : une estimation prudente est utilisée.";
  }
  if (forecastFailed) {
    return "Prévision horaire indisponible : le créneau est estimé prudemment.";
  }
  return null;
}

export function createSkyAnalysisSnapshot({
  coords,
  weather,
  forecast,
  now,
  savedAt,
  questLimit,
  issPass,
  satellitePasses,
  lightPollution,
  lightingPractice,
  airQuality,
}: BuildSkyAnalysisInput): SkyAnalysisSnapshot {
  const quests: SkyQuest[] = generateQuests({
    latitude: coords.latitude,
    longitude: coords.longitude,
    weather,
    now,
    issPass,
    satellitePasses,
    lightPollution,
    lightingPractice,
    airQuality,
    limit: questLimit,
  });
  const bestSkyWindow: BestSkyWindow = calculateBestSkyWindow({
    latitude: coords.latitude,
    longitude: coords.longitude,
    forecast,
    lightPollution,
    lightingPractice,
    airQuality,
    now,
  });

  return {
    savedAt,
    generatedAt: now.toISOString(),
    position: coords,
    weather,
    quests,
    bestSkyWindow,
    ...(lightPollution ? { lightPollution } : {}),
    ...(lightingPractice ? { lightingPractice } : {}),
    ...(airQuality ? { airQuality } : {}),
  };
}

export async function runSkyAnalysis({
  coords,
  now = new Date(),
  questLimit = 20,
  onInitial,
}: SkyAnalysisInput): Promise<SkyAnalysisUpdate> {
  let currentWeatherFailed = false;
  let forecastFailed = false;
  const currentWeatherPromise = fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
    currentWeatherFailed = true;
    return getFallbackWeather();
  });
  const forecastPromise = fetchWeatherForecast(coords.latitude, coords.longitude, 24).catch(() => {
    forecastFailed = true;
    return getFallbackWeatherForecast(now);
  });
  const enrichmentPromise = Promise.all([
    fetchNextIssVisiblePass({
      latitude: coords.latitude,
      longitude: coords.longitude,
      now,
    }).catch(() => null),
    fetchTrackedSatellitePasses({
      latitude: coords.latitude,
      longitude: coords.longitude,
      now,
    }).catch(() => []),
    fetchLightPollutionEstimate(coords.latitude, coords.longitude),
    fetchLightingPracticeEstimate(coords.latitude, coords.longitude),
    fetchAirQualityNow(coords.latitude, coords.longitude).catch(() => null),
  ]);

  const [weather, forecast] = await Promise.all([currentWeatherPromise, forecastPromise]);
  const weatherNotice = getWeatherNotice({ currentWeatherFailed, forecastFailed });
  const savedAt = Date.now();
  const initialAnalysis = createSkyAnalysisSnapshot({
    coords,
    weather,
    forecast,
    now,
    savedAt,
    questLimit,
  });

  onInitial?.({ analysis: initialAnalysis, weatherNotice, isRefined: false });

  const [issPass, satellitePasses, lightPollution, lightingPractice, airQuality] =
    await enrichmentPromise;
  const refinedAnalysis = createSkyAnalysisSnapshot({
    coords,
    weather,
    forecast,
    now,
    savedAt,
    questLimit,
    issPass,
    satellitePasses,
    lightPollution,
    lightingPractice,
    airQuality,
  });

  return { analysis: refinedAnalysis, weatherNotice, isRefined: true };
}
