import type { SkyObject, VisibilityLabel, WeatherNow } from "@/lib/types";

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

  const daylight = weather.isDay || sunAltitude > -3;
  if (daylight) {
    if (object.name === "Moon") {
      score -= 8;
    } else if (object.name === "Venus") {
      score -= 24;
    } else {
      score -= 45;
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
