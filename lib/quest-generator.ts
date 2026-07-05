/**
 * Génération des quêtes
 *
 * Combine la position GPS, la météo, l'heure, les objets astronomiques calculés, le
 * catalogue éditorial, les météores et un éventuel passage ISS. Les candidats sont scorés,
 * filtrés, diversifiés puis triés avant d'être retournés à l'interface.
 *
 * Règles produit :
 * - classer les quêtes fiables par pertinence et préserver une sélection diversifiée ;
 * - ne retenir que les scores >= 50 lorsque des candidats fiables existent ;
 * - ne jamais promettre qu'une observation est certaine ;
 * - retourner FreeObservation si la position manque, si un calcul échoue ou si aucune cible
 *   suffisamment fiable n'est disponible ;
 * - `limit` permet à l'appelant d'adapter la quantité de résultats à son interface.
 */
import { equatorialToHorizontal, getSkyObjects, getSunAltitude } from "@/lib/astro";
import { getIssPassEndTime, isIssPassGuidable, type IssVisiblePass } from "@/lib/iss";
import {
  getDefaultLightPollutionEstimate,
  type LightPollutionEstimate,
} from "@/lib/light-pollution";
import type { LightingPracticeEstimate } from "@/lib/lighting-practices";
import { isMeteorShowerActive, isNearMeteorShowerPeak, meteorShowers } from "@/lib/meteor-showers";
import { azimuthToCardinal } from "@/lib/orientation";
import type { TrackedSatellitePass } from "@/lib/satellites";
import { getSatellitePositionAt } from "@/lib/satellite-guidance";
import { catalogSkyObjects } from "@/lib/sky-catalog";
import {
  calculateCatalogVisibilityScore,
  calculateMeteorShowerVisibilityScore,
  calculateVisibilityScore,
  getVisibilityLabel,
} from "@/lib/visibility";
import type { AirQualityNow, SkyObject, SkyObjectName, SkyQuest, WeatherNow } from "@/lib/types";

type GenerateQuestsInput = {
  latitude: number | null;
  longitude: number | null;
  weather: WeatherNow;
  now: Date;
  issPass?: IssVisiblePass | null;
  satellitePasses?: TrackedSatellitePass[];
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate | null;
  airQuality?: AirQualityNow | null;
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
    generatedAt: now.toISOString(),
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
    description:
      "Le ciel n'est pas idéal maintenant. Observe la zone la plus dégagée et note ce que tu vois.",
    tip: "Choisis un point sombre, laisse tes yeux s'habituer, puis regarde lentement du Nord au Sud.",
    requiredGear: "naked_eye",
    generatedAt: now.toISOString(),
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
    generatedAt: now.toISOString(),
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
    generatedAt: now.toISOString(),
  };
}

function createIssQuest(pass: IssVisiblePass, score: number, now: Date): SkyQuest {
  const startTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    pass.startTime,
  );
  const durationMinutes = Math.max(1, Math.round(pass.durationSeconds / 60));

  return {
    id: `iss-${now.getTime()}`,
    target: "iss",
    targetType: "satellite",
    title: "Repère l'ISS",
    difficulty: "easy",
    azimuth: pass.startAzimuth,
    altitude: pass.trajectory?.[0]?.altitude ?? 10,
    cardinalDirection: azimuthToCardinal(pass.startAzimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: `Passage visible prévu vers ${startTime}, pendant environ ${durationMinutes} min si le ciel est dégagé.`,
    tip: "Elle ressemble à une étoile très brillante qui traverse lentement le ciel sans clignoter.",
    requiredGear: "naked_eye",
    generatedAt: now.toISOString(),
    targetTime: pass.maxTime.toISOString(),
    startsAt: pass.startTime.toISOString(),
    endsAt: getIssPassEndTime(pass).toISOString(),
    satelliteTrajectory: pass.trajectory,
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

function createTrackedSatelliteQuest(
  pass: TrackedSatellitePass,
  score: number,
  now: Date,
): SkyQuest {
  const startTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    pass.startTime,
  );
  const durationMinutes = Math.max(1, Math.round(pass.durationSeconds / 60));
  const isTrain = pass.kind === "starlink_train";

  return {
    id: `${pass.target}-${now.getTime()}`,
    target: pass.target,
    targetType: "satellite",
    title: isTrain ? "Cherche un train Starlink" : `Repère ${pass.name}`,
    difficulty: isTrain ? "medium" : "easy",
    azimuth: pass.startAzimuth,
    altitude: pass.trajectory?.[0]?.altitude ?? 10,
    cardinalDirection: azimuthToCardinal(pass.startAzimuth),
    visibilityScore: score,
    visibilityLabel: getVisibilityLabel(score),
    description: isTrain
      ? `Passage groupé estimé vers ${startTime}, avec environ ${pass.memberCount ?? 3} satellites calculés. À confirmer sur place.`
      : `Passage estimé vers ${startTime}, pendant environ ${durationMinutes} min si le ciel est dégagé.`,
    tip: isTrain
      ? "Cherche une suite de points lumineux avançant dans la même direction. Ils peuvent être très discrets."
      : "Cherche un point lumineux en mouvement régulier, sans promettre qu'il sera visible à l'œil nu.",
    requiredGear: "naked_eye",
    generatedAt: now.toISOString(),
    warning: "La trajectoire est calculée, mais la luminosité réelle reste incertaine.",
    targetTime: pass.maxTime.toISOString(),
    startsAt: pass.startTime.toISOString(),
    endsAt: getIssPassEndTime(pass).toISOString(),
    satelliteTrajectory: pass.trajectory,
  };
}

function shouldSkipDuplicate(candidate: SkyQuest, selected: SkyQuest[]): boolean {
  return selected.some(
    (quest) =>
      quest.target === candidate.target ||
      (quest.targetType === "meteor_shower" && candidate.targetType === "meteor_shower"),
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

export function generateQuests({
  latitude,
  longitude,
  weather,
  now,
  issPass,
  satellitePasses = [],
  lightPollution = getDefaultLightPollutionEstimate(),
  lightingPractice,
  airQuality,
  limit = 8,
}: GenerateQuestsInput): SkyQuest[] {
  if (latitude === null || longitude === null) {
    return [{ ...createFreeObservationQuest(now), weather }];
  }

  try {
    const sunAltitude = getSunAltitude(latitude, longitude, now);
    const effectiveWeather: WeatherNow = { ...weather, isDay: sunAltitude > 0 };
    const planetCandidates = getSkyObjects(latitude, longitude, now)
      .map((object) => {
        const score = calculateVisibilityScore({
          object,
          weather: effectiveWeather,
          sunAltitude,
          lightPollution,
          lightingPractice,
          airQuality,
        });

        return {
          quest: createQuest(object, score, now),
          score,
        };
      })
      .filter((item) => item.score >= 50);

    const catalogCandidates = catalogSkyObjects
      .filter((object) => object.type !== "satellite")
      .flatMap<QuestCandidate>((object) => {
        if (
          typeof object.rightAscensionHours !== "number" ||
          typeof object.declinationDegrees !== "number"
        ) {
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
          lightPollution,
          lightingPractice,
          airQuality,
        });

        if (score < 50) {
          return [];
        }

        return [
          {
            quest: createCatalogQuest({
              object,
              score,
              altitude: position.altitude,
              azimuth: position.azimuth,
              now,
            }),
            score,
          },
        ];
      });

    const meteorCandidates = meteorShowers
      .filter((shower) => isMeteorShowerActive(shower, now))
      .flatMap<QuestCandidate>((shower) => {
        const score = calculateMeteorShowerVisibilityScore({
          weather: effectiveWeather,
          sunAltitude,
          nearPeak: isNearMeteorShowerPeak(shower, now),
          lightPollution,
          lightingPractice,
          airQuality,
        });

        if (score < 50) {
          return [];
        }

        return [
          {
            quest: createMeteorShowerQuest({
              showerName: shower.name,
              radiantName: shower.radiantName,
              tip: shower.recommendedViewingTip,
              score,
              now,
            }),
            score,
          },
        ];
      });

    const issCandidates: QuestCandidate[] =
      issPass && isIssPassGuidable(issPass, now)
        ? [
            {
              quest: createIssQuest(issPass, scoreIssPass(issPass, effectiveWeather), now),
              score: scoreIssPass(issPass, effectiveWeather),
            },
          ].filter((candidate) => candidate.score >= 50)
        : [];

    const trackedSatelliteCandidates = satellitePasses
      .filter((pass) => isIssPassGuidable(pass, now))
      .map<QuestCandidate>((pass) => {
        const score = scoreIssPass(pass, effectiveWeather);
        return { quest: createTrackedSatelliteQuest(pass, score, now), score };
      })
      .filter((candidate) => candidate.score >= 50);

    const candidates = [
      ...issCandidates,
      ...trackedSatelliteCandidates,
      ...planetCandidates,
      ...catalogCandidates,
      ...meteorCandidates,
    ];
    const selected = selectQuestCandidates(candidates, limit);

    if (selected.length === 0) {
      return [{ ...createFreeObservationQuest(now), weather: effectiveWeather }];
    }

    return selected.map((quest) => ({ ...quest, weather: effectiveWeather }));
  } catch {
    return [{ ...createFreeObservationQuest(now), weather }];
  }
}

export function generateFutureQuestSuggestions({
  latitude,
  longitude,
  weather,
  now,
  issPass,
  lightPollution,
  lightingPractice,
  excludedTargets,
  horizonMinutes = 24 * 60,
}: {
  latitude: number;
  longitude: number;
  weather: WeatherNow;
  now: Date;
  issPass?: IssVisiblePass | null;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate | null;
  excludedTargets?: ReadonlySet<string>;
  horizonMinutes?: number;
}): FutureQuestSuggestion[] {
  const suggestions: FutureQuestSuggestion[] = [];
  const seenTargets = new Set<string>(excludedTargets);
  let futureIssSuggestion: FutureQuestSuggestion | null = null;

  if (
    issPass &&
    !seenTargets.has("iss") &&
    issPass.startTime.getTime() > now.getTime() &&
    issPass.startTime.getTime() <= now.getTime() + horizonMinutes * 60_000
  ) {
    const issQuest = generateQuests({
      latitude,
      longitude,
      weather,
      now: issPass.startTime,
      issPass,
      lightPollution,
      lightingPractice,
      limit: 20,
    }).find((quest) => quest.targetType === "satellite");

    if (issQuest) {
      futureIssSuggestion = {
        availableAt: issPass.startTime.toISOString(),
        quest: issQuest,
      };
    }
  }

  searchTimeline: for (
    let minutes = 30;
    minutes <= horizonMinutes;
    minutes += minutes < 24 * 60 ? 30 : 120
  ) {
    const date = new Date(now.getTime() + minutes * 60000);
    const quests = generateQuests({
      latitude,
      longitude,
      weather,
      now: date,
      issPass: null,
      lightPollution,
      lightingPractice,
      limit: 3,
    }).filter((quest) => quest.targetType !== "free_observation");

    for (const quest of quests) {
      if (!seenTargets.has(quest.target)) {
        suggestions.push({ availableAt: date.toISOString(), quest });
        seenTargets.add(quest.target);
      }

      if (suggestions.length >= 5) {
        break searchTimeline;
      }
    }
  }

  if (futureIssSuggestion) {
    suggestions.push(futureIssSuggestion);
  }

  return suggestions
    .sort(
      (left, right) => new Date(left.availableAt).getTime() - new Date(right.availableAt).getTime(),
    )
    .slice(0, 5);
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
    const object = getSkyObjects(latitude, longitude, now).find(
      (skyObject) => skyObject.name === quest.target,
    );
    position = object ? { azimuth: object.azimuth, altitude: object.altitude } : null;
  } else if (quest.targetType === "satellite") {
    position = getSatellitePositionAt(quest.satelliteTrajectory, now);
    if (!position) {
      return {
        ...quest,
        azimuth: null,
        altitude: null,
      };
    }
  } else if (quest.targetType !== "meteor_shower" && quest.targetType !== "free_observation") {
    const object = catalogSkyObjects.find((catalogObject) => catalogObject.id === quest.target);

    if (
      object &&
      typeof object.rightAscensionHours === "number" &&
      typeof object.declinationDegrees === "number"
    ) {
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
