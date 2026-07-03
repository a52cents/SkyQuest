import "server-only";
import lightingIndex from "./data/cerema-lighting-practices-2026.json";
import { normalizeMunicipalityCode, type LightingPracticeEstimate } from "./lighting-practices";

type CategoryCode = "E" | "R" | "A" | "D" | "HT";
type IndexEntry = [CategoryCode, string];

const CATEGORY_DETAILS: Record<
  CategoryCode,
  Pick<LightingPracticeEstimate, "category" | "label" | "shortAdvice" | "scoreAdjustment">
> = {
  E: {
    category: "probable_extinction",
    label: "Extinction nocturne probable",
    shortAdvice: "La commune semble réduire fortement son éclairage au cœur de la nuit.",
    scoreAdjustment: 4,
  },
  R: {
    category: "probable_reduction",
    label: "Éclairage probablement réduit",
    shortAdvice: "Une réduction ou rénovation importante de l’éclairage a été détectée.",
    scoreAdjustment: 2,
  },
  A: {
    category: "abandoned_reduction",
    label: "Réduction possiblement abandonnée",
    shortAdvice: "Une reprise de l’éclairage a été détectée après une baisse précédente.",
    scoreAdjustment: -3,
  },
  D: {
    category: "lighting_extension",
    label: "Éclairage possiblement étendu",
    shortAdvice: "Une hausse durable de l’éclairage nocturne a été détectée.",
    scoreAdjustment: -3,
  },
  HT: {
    category: "outside_light_footprint",
    label: "Peu de lumière détectée",
    shortAdvice:
      "La commune se situe hors de la principale tache lumineuse détectée par satellite.",
    scoreAdjustment: 5,
  },
};

const municipalities = lightingIndex.municipalities as unknown as Record<
  string,
  IndexEntry | undefined
>;

export function getLightingPracticeEstimate(
  municipalityCode: string,
  municipalityName: string,
): LightingPracticeEstimate | null {
  const normalizedCode = normalizeMunicipalityCode(municipalityCode);
  const entry = municipalities[normalizedCode];
  if (!entry) return null;

  const [categoryCode, detectedAt] = entry;
  const details = CATEGORY_DETAILS[categoryCode];
  return {
    ...details,
    municipalityCode: normalizedCode,
    municipalityName,
    detectedAt: detectedAt || undefined,
    source: "cerema-2026",
    confidence: details.category === "outside_light_footprint" ? "low" : "medium",
  };
}
