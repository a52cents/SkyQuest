import { getSkyObjects, getSunAltitude } from "@/lib/astro";
import { azimuthToCardinal } from "@/lib/orientation";
import { calculateVisibilityScore, getVisibilityLabel } from "@/lib/visibility";
import type { SkyObject, SkyObjectName, SkyQuest, WeatherNow } from "@/lib/types";

type GenerateQuestsInput = {
  latitude: number | null;
  longitude: number | null;
  weather: WeatherNow;
  now: Date;
};

const objectLabels: Record<SkyObjectName, string> = {
  Moon: "la Lune",
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

function getDifficulty(object: SkyObject): SkyQuest["difficulty"] {
  return object.name === "Saturn" || object.name === "Mars" ? "medium" : "easy";
}

function getDescription(object: SkyObject, score: number): string {
  const label = objectLabels[object.name];

  if (score >= 80) {
    return `Conditions favorables pour tenter de repérer ${label}.`;
  }

  if (score >= 60) {
    return `Bonne chance de visibilité pour ${label}, si l'horizon est dégagé.`;
  }

  return `${label} est à tenter, mais les conditions ne sont pas idéales.`;
}

function getTip(object: SkyObject): string {
  const fists = Math.max(1, Math.round(object.altitude / 10));
  return `Tends le bras : un poing fermé représente environ 10°. Cherche environ ${fists} poing${fists > 1 ? "s" : ""} au-dessus de l'horizon.`;
}

function createQuest(object: SkyObject, score: number, now: Date): SkyQuest {
  return {
    id: `${object.name.toLowerCase()}-${now.getTime()}`,
    target: object.name,
    title: object.name === "Moon" ? "Trouve la Lune" : `Repère ${objectLabels[object.name]}`,
    difficulty: getDifficulty(object),
    azimuth: Math.round(object.azimuth),
    altitude: Math.round(object.altitude),
    cardinalDirection: azimuthToCardinal(object.azimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: getDescription(object, score),
    tip: getTip(object),
  };
}

function createFreeObservationQuest(now: Date): SkyQuest {
  return {
    id: `free-observation-${now.getTime()}`,
    target: "FreeObservation",
    title: "Observe le ciel pendant 2 minutes",
    difficulty: "easy",
    azimuth: null,
    altitude: null,
    cardinalDirection: null,
    visibilityScore: 40,
    visibilityLabel: "Tentable",
    description: "Le ciel n'est pas idéal maintenant. Observe la zone la plus dégagée et note ce que tu vois.",
    tip: "Choisis un point sombre, laisse tes yeux s'habituer, puis regarde lentement du Nord au Sud.",
  };
}

export function generateQuests({ latitude, longitude, weather, now }: GenerateQuestsInput): SkyQuest[] {
  if (latitude === null || longitude === null) {
    return [createFreeObservationQuest(now)];
  }

  try {
    const sunAltitude = getSunAltitude(latitude, longitude, now);
    const scored = getSkyObjects(latitude, longitude, now)
      .map((object) => ({
        object,
        score: calculateVisibilityScore({ object, weather, sunAltitude }),
      }))
      .sort((a, b) => b.score - a.score);

    const reliable = scored.filter((item) => item.score >= 50);
    const selected = reliable.length > 0 ? reliable.slice(0, 3) : scored.filter((item) => item.score >= 40).slice(0, 1);

    if (selected.length === 0) {
      return [createFreeObservationQuest(now)];
    }

    return selected.map((item) => createQuest(item.object, item.score, now));
  } catch {
    return [createFreeObservationQuest(now)];
  }
}
