import type { QuestTargetType } from "./types";

export type LightingPracticeCategory =
  | "probable_extinction"
  | "probable_reduction"
  | "abandoned_reduction"
  | "lighting_extension"
  | "outside_light_footprint";

export type LightingPracticeEstimate = {
  category: LightingPracticeCategory;
  municipalityCode: string;
  municipalityName: string;
  label: string;
  shortAdvice: string;
  scoreAdjustment: number;
  detectedAt?: string;
  source: "cerema-2026";
  confidence: "low" | "medium";
};

const LIGHTING_PRACTICE_CATEGORIES: ReadonlySet<string> = new Set([
  "probable_extinction",
  "probable_reduction",
  "abandoned_reduction",
  "lighting_extension",
  "outside_light_footprint",
]);

const TARGET_SENSITIVITY: Record<QuestTargetType, number> = {
  moon: 0.2,
  planet: 0.25,
  star: 0.5,
  constellation: 0.7,
  asterism: 0.7,
  meteor_shower: 0.9,
  star_cluster: 1,
  galaxy: 1,
  satellite: 0.2,
  free_observation: 0,
};

export function getTargetLightingPracticeAdjustment(
  targetType: QuestTargetType,
  estimate: LightingPracticeEstimate,
): number {
  return Math.round(estimate.scoreAdjustment * TARGET_SENSITIVITY[targetType]);
}

export function normalizeMunicipalityCode(code: string): string {
  if (/^751(?:0[1-9]|1\d|20)$/.test(code)) return "75056";
  if (/^132(?:0[1-9]|1[0-6])$/.test(code)) return "13055";
  if (/^6938[1-9]$/.test(code)) return "69123";
  return code;
}

export function isLightingPracticeEstimate(value: unknown): value is LightingPracticeEstimate {
  if (!value || typeof value !== "object") return false;
  const estimate = value as Partial<LightingPracticeEstimate>;
  return (
    typeof estimate.category === "string" &&
    LIGHTING_PRACTICE_CATEGORIES.has(estimate.category) &&
    typeof estimate.municipalityCode === "string" &&
    typeof estimate.municipalityName === "string" &&
    typeof estimate.label === "string" &&
    typeof estimate.shortAdvice === "string" &&
    typeof estimate.scoreAdjustment === "number" &&
    Number.isFinite(estimate.scoreAdjustment) &&
    estimate.source === "cerema-2026" &&
    (estimate.confidence === "low" || estimate.confidence === "medium")
  );
}
