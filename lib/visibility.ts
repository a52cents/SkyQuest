import type { SkyObject, VisibilityLabel, WeatherNow } from "@/lib/types";
import type { CatalogSkyObject } from "@/lib/sky-catalog";

type VisibilityInput = {
  object: SkyObject;
  weather: WeatherNow;
  sunAltitude: number;
};

export function calculateVisibilityScore({ object, weather, sunAltitude }: VisibilityInput): number {
  if (object.altitude < 5) {
    return 5;
  }

  let score = 45;

  if (object.altitude < 10) {
    score -= 30;
  } else if (object.altitude < 20) {
    score += 8;
  } else {
    score += 24;
  }

  if (weather.cloudCover > 80) {
    score -= 42;
  } else if (weather.cloudCover >= 50) {
    score -= 22;
  } else if (weather.cloudCover < 30) {
    score += 10;
  }

  const daylight = weather.isDay || sunAltitude > 0;
  const brightTwilight = sunAltitude > -3;

  if (daylight) {
    if (object.name === "Moon") {
      score -= 8;
    } else if (object.name === "Venus") {
      score -= 52;
    } else {
      score -= 60;
    }
  } else if (brightTwilight) {
    if (object.name === "Moon") {
      score -= 4;
    } else if (object.name === "Venus") {
      score -= 18;
    } else {
      score -= 36;
    }
  }

  if (object.name === "Moon" || object.name === "Venus") {
    score += 16;
  } else if (object.name === "Jupiter") {
    score += 12;
  } else {
    score += 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getVisibilityLabel(score: number): VisibilityLabel {
  if (score >= 80) {
    return "Excellente chance";
  }
  if (score >= 60) {
    return "Bonne chance";
  }
  if (score >= 40) {
    return "Tentable";
  }
  return "Pas conseillé";
}

function isDarkEnoughForStars(weather: WeatherNow, sunAltitude: number): boolean {
  // Beginner-friendly star/constellation quests need a genuinely darkening sky.
  // Civil twilight (-3°) is still too bright for reliable naked-eye guidance,
  // so catalog objects wait until the Sun is at least 8° below the horizon.
  return !weather.isDay && sunAltitude <= -8;
}

function getCloudPenalty(cloudCover: number): number {
  if (cloudCover > 80) {
    return -42;
  }
  if (cloudCover >= 50) {
    return -22;
  }
  if (cloudCover < 30) {
    return 10;
  }
  return 0;
}

function getSeasonBonus(objectId: string, date: Date): number {
  const month = date.getMonth() + 1;
  const isSpringSummer = month >= 4 && month <= 8;
  const isSummerAutumn = month >= 6 && month <= 10;
  const isAutumnWinter = month >= 10 || month <= 2;

  if (objectId === "summer-triangle" && isSummerAutumn) {
    return 18;
  }
  if (objectId === "vega" && isSummerAutumn) {
    return 10;
  }
  if (objectId === "arcturus" && isSpringSummer) {
    return 10;
  }
  if (objectId === "pleiades" && isAutumnWinter) {
    return 14;
  }
  if (objectId === "andromeda" && month >= 8 && month <= 11) {
    return 10;
  }

  return 0;
}

export function calculateCatalogVisibilityScore({
  object,
  altitude,
  weather,
  sunAltitude,
  now,
}: {
  object: CatalogSkyObject;
  altitude: number;
  weather: WeatherNow;
  sunAltitude: number;
  now: Date;
}): number {
  if (altitude < 10 || !object.franceFriendly || !isDarkEnoughForStars(weather, sunAltitude)) {
    return 0;
  }

  if (object.id === "antares" && altitude < 15) {
    return 0;
  }

  if (object.id === "andromeda" && (altitude < 25 || weather.cloudCover >= 35 || sunAltitude > -8)) {
    return 0;
  }

  let score = 36 + Math.round(object.priority * 0.35);

  if (altitude < 15) {
    score -= 28;
  } else if (altitude < 25) {
    score -= 8;
  } else {
    score += 14;
  }

  score += getCloudPenalty(weather.cloudCover);
  score += getSeasonBonus(object.id, now);

  if (object.requiredGear === "binoculars_recommended") {
    score -= 14;
  }

  if (object.difficulty === "medium") {
    score -= 8;
  } else if (object.difficulty === "hard") {
    score -= 26;
  } else {
    score += 8;
  }

  if (object.type === "asterism") {
    score += 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateMeteorShowerVisibilityScore({
  weather,
  sunAltitude,
  nearPeak,
}: {
  weather: WeatherNow;
  sunAltitude: number;
  nearPeak: boolean;
}): number {
  if (!isDarkEnoughForStars(weather, sunAltitude)) {
    return 0;
  }

  let score = nearPeak ? 76 : 58;
  score += getCloudPenalty(weather.cloudCover);

  return Math.max(0, Math.min(100, Math.round(score)));
}
