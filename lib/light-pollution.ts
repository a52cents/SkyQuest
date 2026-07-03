import type { QuestTargetType } from "./types";

export type LightPollutionLevel = "excellent" | "good" | "moderate" | "poor" | "very-poor";

export type LightPollutionSource =
  "world-atlas" | "viirs" | "black-marble" | "external-api" | "fallback" | "unknown";

export type LightPollutionEstimate = {
  level: LightPollutionLevel;
  score: number;
  label: string;
  shortAdvice: string;
  bortleClass?: number;
  sqm?: number;
  radiance?: number;
  source: LightPollutionSource;
  confidence: "high" | "medium" | "low";
  cachedAt?: string;
};

export type LightPollutionMeasurement = {
  score?: number;
  bortleClass?: number;
  sqm?: number;
  radiance?: number;
};

const TARGET_WEIGHTS: Record<QuestTargetType, number> = {
  moon: 0.05,
  planet: 0.08,
  star: 0.12,
  constellation: 0.18,
  asterism: 0.18,
  meteor_shower: 0.22,
  star_cluster: 0.28,
  galaxy: 0.35,
  satellite: 0.05,
  free_observation: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeLightPollutionScore(
  measurement: LightPollutionMeasurement | number,
): number {
  if (typeof measurement === "number") {
    return Math.round(clamp(measurement, 0, 100));
  }

  if (Number.isFinite(measurement.score)) {
    return Math.round(clamp(measurement.score as number, 0, 100));
  }

  if (Number.isFinite(measurement.bortleClass)) {
    const bortleClass = clamp(measurement.bortleClass as number, 1, 9);
    return Math.round(100 - ((bortleClass - 1) / 8) * 92);
  }

  if (Number.isFinite(measurement.sqm)) {
    const sqm = clamp(measurement.sqm as number, 17, 22);
    return Math.round(((sqm - 17) / 5) * 100);
  }

  if (Number.isFinite(measurement.radiance)) {
    const radiance = Math.max(0, measurement.radiance as number);
    return Math.round(clamp(100 - 25 * Math.log10(1 + radiance), 0, 100));
  }

  return 50;
}

export function getLightPollutionAdvice(
  score: number,
): Pick<LightPollutionEstimate, "level" | "label" | "shortAdvice"> {
  const normalizedScore = normalizeLightPollutionScore(score);
  if (normalizedScore >= 85) {
    return {
      level: "excellent",
      label: "Ciel très sombre",
      shortAdvice: "Très bon pour les objets faibles, si la météo reste favorable.",
    };
  }
  if (normalizedScore >= 70) {
    return {
      level: "good",
      label: "Ciel sombre",
      shortAdvice: "Bon pour les étoiles et plusieurs objets faibles.",
    };
  }
  if (normalizedScore >= 50) {
    return {
      level: "moderate",
      label: "Ciel périurbain",
      shortAdvice: "Très bon pour les planètes, moins idéal pour les galaxies.",
    };
  }
  if (normalizedScore >= 25) {
    return {
      level: "poor",
      label: "Ciel urbain",
      shortAdvice: "Privilégie la Lune, les planètes et les étoiles brillantes.",
    };
  }
  return {
    level: "very-poor",
    label: "Ciel très lumineux",
    shortAdvice: "Les objets faibles seront difficiles ; vise les cibles très brillantes.",
  };
}

export function getTargetLightPollutionPenalty(
  targetType: QuestTargetType,
  estimate: LightPollutionEstimate,
): number {
  const lostDarkness = 100 - normalizeLightPollutionScore(estimate.score);
  const confidenceFactor =
    estimate.confidence === "high" ? 1 : estimate.confidence === "medium" ? 0.85 : 0;
  return Math.round(lostDarkness * TARGET_WEIGHTS[targetType] * confidenceFactor);
}

export function getDefaultLightPollutionEstimate(): LightPollutionEstimate {
  const score = 50;
  return {
    level: "moderate",
    score,
    label: "Qualité non mesurée",
    shortAdvice: "Les cibles restent classées avec prudence selon la météo et leur hauteur.",
    source: "fallback",
    confidence: "low",
  };
}
