import { equatorialToHorizontal, getSkyObjects, getSunAltitude } from "@/lib/astro";
import type { IssVisiblePass } from "@/lib/iss";
import { isMeteorShowerActive, isNearMeteorShowerPeak, meteorShowers } from "@/lib/meteor-showers";
import { azimuthToCardinal } from "@/lib/orientation";
import { catalogSkyObjects } from "@/lib/sky-catalog";
import {
  calculateCatalogVisibilityScore,
  calculateMeteorShowerVisibilityScore,
  calculateVisibilityScore,
  getVisibilityLabel,
} from "@/lib/visibility";
import type { SkyObject, SkyObjectName, SkyQuest, WeatherNow } from "@/lib/types";

type GenerateQuestsInput = {
  latitude: number | null;
  longitude: number | null;
  weather: WeatherNow;
  now: Date;
  issPass?: IssVisiblePass | null;
  limit?: number;
};

export type FutureQuestSuggestion = {
  availableAt: string;
  quest: SkyQuest;
};

const objectLabels: Record<SkyObjectName, string> = {
  Moon: "la Lune",
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

type QuestCandidate = {
  quest: SkyQuest;
  score: number;
};

function getDifficulty(object: SkyObject): SkyQuest["difficulty"] {
  return object.name === "Saturn" || object.name === "Mars" ? "medium" : "easy";
}

function getDescription(object: SkyObject, score: number): string {
  if (object.name === "Moon") {
    return "C'est l'objet le plus facile à repérer quand elle est au-dessus de l'horizon.";
  }

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
  if (object.name === "Moon") {
    return "C'est l'objet le plus facile à repérer. Regarde dans la direction indiquée et cherche le disque lumineux.";
  }

  const fists = Math.max(1, Math.round(object.altitude / 10));
  return `Tends le bras : un poing fermé représente environ 10°. Cherche environ ${fists} poing${fists > 1 ? "s" : ""} au-dessus de l'horizon.`;
}

function createQuest(object: SkyObject, score: number, now: Date): SkyQuest {
  return {
    id: `${object.name.toLowerCase()}-${now.getTime()}`,
    target: object.name,
    targetType: object.name === "Moon" ? "moon" : "planet",
    title: object.name === "Moon" ? "Trouve la Lune" : `Repère ${objectLabels[object.name]}`,
    difficulty: getDifficulty(object),
    azimuth: object.azimuth,
    altitude: object.altitude,
    cardinalDirection: azimuthToCardinal(object.azimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: getDescription(object, score),
    tip: getTip(object),
    requiredGear: "naked_eye",
  };
}

function createFreeObservationQuest(now: Date): SkyQuest {
  return {
    id: `free-observation-${now.getTime()}`,
    target: "FreeObservation",
    targetType: "free_observation",
    title: "Observe le ciel pendant 2 minutes",
    difficulty: "easy",
    azimuth: null,
    altitude: null,
    cardinalDirection: null,
    visibilityScore: 40,
    visibilityLabel: "Tentable",
    description: "Le ciel n'est pas idéal maintenant. Observe la zone la plus dégagée et note ce que tu vois.",
    tip: "Choisis un point sombre, laisse tes yeux s'habituer, puis regarde lentement du Nord au Sud.",
    requiredGear: "naked_eye",
  };
}

function createCatalogQuest({
  object,
  score,
  altitude,
  azimuth,
  now,
}: {
  object: (typeof catalogSkyObjects)[number];
  score: number;
  altitude: number;
  azimuth: number;
  now: Date;
}): SkyQuest {
  return {
    id: `${object.id}-${now.getTime()}`,
    target: object.id,
    targetType: object.type === "meteor_shower" ? "meteor_shower" : object.type,
    title: object.questTitle,
    difficulty: object.difficulty === "easy" ? "easy" : "medium",
    azimuth,
    altitude,
    cardinalDirection: azimuthToCardinal(azimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: object.description,
    tip: object.observationTip,
    requiredGear: object.requiredGear,
    warning: object.warning,
  };
}

function createMeteorShowerQuest({
  showerName,
  radiantName,
  tip,
  score,
  now,
}: {
  showerName: string;
  radiantName: string;
  tip: string;
  score: number;
  now: Date;
}): SkyQuest {
  return {
    id: `meteor-shower-${showerName.toLowerCase()}-${now.getTime()}`,
    target: `meteor-${showerName.toLowerCase()}`,
    targetType: "meteor_shower",
    title: "Observe une pluie d'étoiles filantes",
    difficulty: "easy",
    azimuth: null,
    altitude: null,
    cardinalDirection: null,
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: `${showerName} active maintenant. Le radiant est vers ${radiantName}, mais regarde surtout une zone sombre du ciel.`,
    tip: `${tip} Pas besoin de regarder exactement le radiant.`,
    requiredGear: "naked_eye",
  };
}

function createIssQuest(pass: IssVisiblePass, score: number, now: Date): SkyQuest {
  const startTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(pass.startTime);
  const durationMinutes = Math.max(1, Math.round(pass.durationSeconds / 60));

  return {
    id: `iss-${now.getTime()}`,
    target: "iss",
    targetType: "satellite",
    title: "Repère l'ISS",
    difficulty: "easy",
    azimuth: pass.maxAzimuth,
    altitude: pass.maxElevation,
    cardinalDirection: azimuthToCardinal(pass.maxAzimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: `Passage visible prévu vers ${startTime}, pendant environ ${durationMinutes} min si le ciel est dégagé.`,
    tip: "Elle ressemble à une étoile très brillante qui traverse lentement le ciel sans clignoter.",
    requiredGear: "naked_eye",
    targetTime: pass.maxTime.toISOString(),
  };
}

function scoreIssPass(pass: IssVisiblePass, weather: WeatherNow): number {
  if (weather.cloudCover > 80 || pass.maxElevation < 15) {
    return 0;
  }

  let score = 74;

  if (pass.maxElevation >= 35) {
    score += 14;
  } else if (pass.maxElevation < 25) {
    score -= 8;
  }

  if (weather.cloudCover >= 50) {
    score -= 20;
  } else if (weather.cloudCover < 30) {
    score += 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function shouldSkipDuplicate(candidate: SkyQuest, selected: SkyQuest[]): boolean {
  if (candidate.target === "vega" && selected.some((quest) => quest.target === "summer-triangle")) {
    return true;
  }

  if (candidate.target === "summer-triangle" && selected.some((quest) => quest.target === "vega")) {
    return true;
  }

  return selected.some(
    (quest) => quest.target === candidate.target || (quest.targetType === "meteor_shower" && candidate.targetType === "meteor_shower"),
  );
}

function selectQuestCandidates(candidates: QuestCandidate[], limit: number): SkyQuest[] {
  const selected: SkyQuest[] = [];

  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (selected.length >= limit) {
      break;
    }

    if (!shouldSkipDuplicate(candidate.quest, selected)) {
      selected.push(candidate.quest);
    }
  }

  return selected;
}

function isIssPassNearTime(pass: IssVisiblePass | null | undefined, date: Date): boolean {
  if (!pass) {
    return false;
  }

  const minutesUntilPass = (pass.startTime.getTime() - date.getTime()) / 60000;
  return minutesUntilPass >= 0 && minutesUntilPass <= 45;
}

export function generateQuests({
  latitude,
  longitude,
  weather,
  now,
  issPass,
  limit = 8,
}: GenerateQuestsInput): SkyQuest[] {
  if (latitude === null || longitude === null) {
    return [createFreeObservationQuest(now)];
  }

  try {
    const sunAltitude = getSunAltitude(latitude, longitude, now);
    const effectiveWeather: WeatherNow = { ...weather, isDay: sunAltitude > 0 };
    const planetCandidates = getSkyObjects(latitude, longitude, now)
      .map((object) => {
        const score = calculateVisibilityScore({ object, weather: effectiveWeather, sunAltitude });

        return {
          quest: createQuest(object, score, now),
          score,
        };
      })
      .filter((item) => item.score >= 50);

    const catalogCandidates = catalogSkyObjects
      .filter((object) => object.type !== "satellite")
      .flatMap<QuestCandidate>((object) => {
        if (typeof object.rightAscensionHours !== "number" || typeof object.declinationDegrees !== "number") {
          return [];
        }

        const position = equatorialToHorizontal({
          rightAscensionHours: object.rightAscensionHours,
          declinationDegrees: object.declinationDegrees,
          latitude,
          longitude,
          date: now,
        });

        const score = calculateCatalogVisibilityScore({
          object,
          altitude: position.altitude,
          weather: effectiveWeather,
          sunAltitude,
          now,
        });

        if (score < 50) {
          return [];
        }

        return [{
          quest: createCatalogQuest({ object, score, altitude: position.altitude, azimuth: position.azimuth, now }),
          score,
        }];
      });

    const meteorCandidates = meteorShowers
      .filter((shower) => isMeteorShowerActive(shower, now))
      .flatMap<QuestCandidate>((shower) => {
        const score = calculateMeteorShowerVisibilityScore({
          weather: effectiveWeather,
          sunAltitude,
          nearPeak: isNearMeteorShowerPeak(shower, now),
        });

        if (score < 50) {
          return [];
        }

        return [{
          quest: createMeteorShowerQuest({
            showerName: shower.name,
            radiantName: shower.radiantName,
            tip: shower.recommendedViewingTip,
            score,
            now,
          }),
          score,
        }];
      });

    const issCandidates: QuestCandidate[] = issPass
      ? [{ quest: createIssQuest(issPass, scoreIssPass(issPass, effectiveWeather), now), score: scoreIssPass(issPass, effectiveWeather) }]
        .filter((candidate) => candidate.score >= 50)
      : [];

    const candidates = [...issCandidates, ...planetCandidates, ...catalogCandidates, ...meteorCandidates];
    const selected = selectQuestCandidates(candidates, limit);

    if (selected.length === 0) {
      return [createFreeObservationQuest(now)];
    }

    return selected;
  } catch {
    return [createFreeObservationQuest(now)];
  }
}

export function generateFutureQuestSuggestions({
  latitude,
  longitude,
  weather,
  now,
  issPass,
}: {
  latitude: number;
  longitude: number;
  weather: WeatherNow;
  now: Date;
  issPass?: IssVisiblePass | null;
}): FutureQuestSuggestion[] {
  const suggestions: FutureQuestSuggestion[] = [];
  const seenTargets = new Set<string>();

  for (let minutes = 30; minutes <= 24 * 60; minutes += 30) {
    const date = new Date(now.getTime() + minutes * 60000);
    const quests = generateQuests({
      latitude,
      longitude,
      weather,
      now: date,
      issPass: isIssPassNearTime(issPass, date) ? issPass : null,
      limit: 3,
    }).filter((quest) => quest.targetType !== "free_observation");

    for (const quest of quests) {
      if (!seenTargets.has(quest.target)) {
        suggestions.push({ availableAt: date.toISOString(), quest });
        seenTargets.add(quest.target);
      }

      if (suggestions.length >= 5) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

export function recalculateQuestPosition({
  quest,
  latitude,
  longitude,
  now,
}: {
  quest: SkyQuest;
  latitude: number;
  longitude: number;
  now: Date;
}): SkyQuest {
  let position: { azimuth: number; altitude: number } | null = null;

  if (quest.targetType === "moon" || quest.targetType === "planet") {
    const object = getSkyObjects(latitude, longitude, now).find((skyObject) => skyObject.name === quest.target);
    position = object ? { azimuth: object.azimuth, altitude: object.altitude } : null;
  } else if (quest.targetType !== "satellite" && quest.targetType !== "meteor_shower" && quest.targetType !== "free_observation") {
    const object = catalogSkyObjects.find((catalogObject) => catalogObject.id === quest.target);

    if (object && typeof object.rightAscensionHours === "number" && typeof object.declinationDegrees === "number") {
      position = equatorialToHorizontal({
        rightAscensionHours: object.rightAscensionHours,
        declinationDegrees: object.declinationDegrees,
        latitude,
        longitude,
        date: now,
      });
    }
  }

  if (!position) {
    return quest;
  }

  return {
    ...quest,
    azimuth: position.azimuth,
    altitude: position.altitude,
    cardinalDirection: azimuthToCardinal(position.azimuth),
  };
}
