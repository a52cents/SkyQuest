import { meteorShowers } from "./meteor-showers.ts";
import { catalogSkyObjects } from "./sky-catalog.ts";
import type { Observation, ProgressProfile, QuestTargetType } from "@/lib/types";

export type DiscoveryAtlasEntry = {
  id: string;
  target: string;
  targetType: QuestTargetType;
  frenchName: string;
  shortDescription: string;
  categoryLabel: string;
  catalogId?: string;
  imageSrc?: string;
  legacyTargetAliases?: string[];
};

export type DiscoveryStatus = "locked" | "attempted" | "discovered";

export type DiscoveryAtlasProgressEntry = DiscoveryAtlasEntry & {
  status: DiscoveryStatus;
  firstDiscoveredAt: string | null;
  lastObservedAt: string | null;
  successfulObservationCount: number;
  missedObservationCount: number;
  recentMemory: Observation | null;
};

export type DiscoveryAtlasCategoryProgress = {
  label: string;
  discoveredCount: number;
  totalCount: number;
};

export type SpecialDiscovery = {
  id: string;
  target: string;
  frenchName: string;
  firstDiscoveredAt: string;
  lastObservedAt: string | null;
  successfulObservationCount: number;
  recentMemory: Observation | null;
};

export type DiscoveryAtlasProgress = {
  entries: DiscoveryAtlasProgressEntry[];
  specialDiscoveries: SpecialDiscovery[];
  categories: DiscoveryAtlasCategoryProgress[];
  discoveredCount: number;
  attemptedCount: number;
  totalCount: number;
  completionRatio: number;
  completionPercent: number;
  latestDiscovery: DiscoveryAtlasProgressEntry | null;
  nextObjective: DiscoveryAtlasProgressEntry | null;
};

const categoryLabels: Record<QuestTargetType, string> = {
  moon: "Lune",
  planet: "Planètes",
  star: "Étoiles",
  asterism: "Astérismes",
  constellation: "Constellations",
  star_cluster: "Amas d’étoiles",
  galaxy: "Galaxies",
  meteor_shower: "Pluies de météores",
  satellite: "Satellites",
  free_observation: "Observation libre",
};

const solarSystemEntries: DiscoveryAtlasEntry[] = [
  {
    id: "solar-moon",
    target: "Moon",
    targetType: "moon",
    frenchName: "Lune",
    shortDescription: "Notre satellite naturel, souvent le repère le plus simple pour commencer.",
    categoryLabel: categoryLabels.moon,
    legacyTargetAliases: ["Lune", "the moon"],
  },
  {
    id: "solar-venus",
    target: "Venus",
    targetType: "planet",
    frenchName: "Vénus",
    shortDescription: "Une planète très brillante, visible près de l’horizon à certaines périodes.",
    categoryLabel: categoryLabels.planet,
    legacyTargetAliases: ["Vénus"],
  },
  {
    id: "solar-jupiter",
    target: "Jupiter",
    targetType: "planet",
    frenchName: "Jupiter",
    shortDescription: "La plus grande planète du Système solaire, lumineuse à l’œil nu.",
    categoryLabel: categoryLabels.planet,
  },
  {
    id: "solar-saturn",
    target: "Saturn",
    targetType: "planet",
    frenchName: "Saturne",
    shortDescription: "Une planète à l’éclat calme dont les anneaux demandent un instrument.",
    categoryLabel: categoryLabels.planet,
    legacyTargetAliases: ["Saturne"],
  },
  {
    id: "solar-mars",
    target: "Mars",
    targetType: "planet",
    frenchName: "Mars",
    shortDescription:
      "La planète rouge, reconnaissable à sa teinte orangée quand elle est visible.",
    categoryLabel: categoryLabels.planet,
  },
];

// This explicit list keeps the collection denominator editorial and stable. If the Explorer
// catalog grows, a new object only joins the atlas after an intentional product decision.
const atlasCatalogIds = [
  "polaris",
  "ursa-major",
  "cassiopeia",
  "summer-triangle",
  "vega",
  "arcturus",
  "antares",
  "pleiades",
  "andromeda",
  "iss",
] as const;

const catalogEntries: DiscoveryAtlasEntry[] = atlasCatalogIds.flatMap((catalogId) => {
  const catalogSkyObject = catalogSkyObjects.find((item) => item.id === catalogId);
  if (!catalogSkyObject) return [];
  return [
    {
      id: `catalog-${catalogSkyObject.id}`,
      target: catalogSkyObject.id,
      targetType: catalogSkyObject.type,
      frenchName: catalogSkyObject.frenchName,
      shortDescription: catalogSkyObject.description,
      categoryLabel: categoryLabels[catalogSkyObject.type],
      catalogId: catalogSkyObject.id,
      imageSrc: catalogSkyObject.image.src,
      legacyTargetAliases: [
        catalogSkyObject.name,
        catalogSkyObject.frenchName,
        catalogSkyObject.questTitle,
        `catalog-${catalogSkyObject.id}`,
      ],
    },
  ];
});

const meteorEntries: DiscoveryAtlasEntry[] = meteorShowers.map((shower) => ({
  id: `meteor-${shower.id}`,
  target: `meteor-${shower.name.toLocaleLowerCase("fr-FR")}`,
  targetType: "meteor_shower",
  frenchName: shower.name,
  shortDescription: `Une pluie d’étoiles filantes dont le radiant se situe vers ${shower.radiantName}.`,
  categoryLabel: categoryLabels.meteor_shower,
  legacyTargetAliases: [
    shower.id,
    shower.name,
    `meteor-${shower.id}`,
    `meteor_shower_${shower.id}`,
    `meteor-shower-${shower.id}`,
    `meteor-${shower.name}`,
  ],
}));

export const discoveryAtlasEntries: readonly DiscoveryAtlasEntry[] = [
  ...solarSystemEntries,
  ...catalogEntries,
  ...meteorEntries,
];

export function normalizeDiscoveryTarget(target: string): string {
  return target
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const excludedTargets = new Set(["freeobservation", "observationlibre"]);
const entriesByAlias = new Map<string, DiscoveryAtlasEntry>();

for (const entry of discoveryAtlasEntries) {
  const aliases = [entry.id, entry.target, entry.frenchName, ...(entry.legacyTargetAliases ?? [])];
  for (const alias of aliases) {
    const normalizedAlias = normalizeDiscoveryTarget(alias);
    if (normalizedAlias && !entriesByAlias.has(normalizedAlias)) {
      entriesByAlias.set(normalizedAlias, entry);
    }
  }
}

export function resolveDiscoveryAtlasEntry(
  target: string,
  targetType?: QuestTargetType,
): DiscoveryAtlasEntry | null {
  if (typeof target !== "string") return null;
  if (targetType === "free_observation") return null;
  const normalizedTarget = normalizeDiscoveryTarget(target);
  if (!normalizedTarget || excludedTargets.has(normalizedTarget)) return null;
  return entriesByAlias.get(normalizedTarget) ?? null;
}

function validDateTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isValidObservation(value: unknown): value is Observation {
  if (!value || typeof value !== "object") return false;
  const observation = value as Partial<Observation>;
  return (
    typeof observation.id === "string" &&
    typeof observation.target === "string" &&
    (observation.status === "seen" || observation.status === "missed") &&
    validDateTimestamp(observation.createdAt) !== null
  );
}

function earliestIsoDate(values: string[]): string | null {
  const timestamps = values
    .map(validDateTimestamp)
    .filter((value): value is number => value !== null);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

function latestObservation(observations: Observation[]): Observation | null {
  return (
    [...observations].sort(
      (left, right) =>
        (validDateTimestamp(right.createdAt) ?? 0) - (validDateTimestamp(left.createdAt) ?? 0),
    )[0] ?? null
  );
}

function getSpecialDiscoveryName(target: string, observations: Observation[]): string {
  const title = latestObservation(observations)?.questTitle;
  const fromTitle = title
    ?.replace(/^(repère|trouve|observe|cherche|suis)\s+/i, "")
    .replace(/^une?\s+/i, "")
    .trim();
  return fromTitle || target;
}

export function buildDiscoveryAtlasProgress({
  profile,
  observations,
}: {
  profile: ProgressProfile;
  observations: Observation[];
}): DiscoveryAtlasProgress {
  const safeObservations = Array.isArray(observations)
    ? observations.filter(isValidObservation)
    : [];
  const safeDiscoveries = Array.isArray(profile?.discoveredTargets)
    ? profile.discoveredTargets.filter(
        (item) =>
          item &&
          typeof item.target === "string" &&
          typeof item.targetType === "string" &&
          validDateTimestamp(item.discoveredAt) !== null,
      )
    : [];

  const observationsByEntry = new Map<string, Observation[]>();
  for (const observation of safeObservations) {
    const entry = resolveDiscoveryAtlasEntry(observation.target, observation.targetType);
    if (!entry) continue;
    const current = observationsByEntry.get(entry.id) ?? [];
    current.push(observation);
    observationsByEntry.set(entry.id, current);
  }

  const discoveriesByEntry = new Map<string, typeof safeDiscoveries>();
  for (const discovery of safeDiscoveries) {
    const entry = resolveDiscoveryAtlasEntry(discovery.target, discovery.targetType);
    if (!entry) continue;
    const current = discoveriesByEntry.get(entry.id) ?? [];
    current.push(discovery);
    discoveriesByEntry.set(entry.id, current);
  }

  const entries = discoveryAtlasEntries.map<DiscoveryAtlasProgressEntry>((entry) => {
    const entryObservations = observationsByEntry.get(entry.id) ?? [];
    const seenObservations = entryObservations.filter((item) => item.status === "seen");
    const missedObservations = entryObservations.filter((item) => item.status === "missed");
    const profileDiscoveries = discoveriesByEntry.get(entry.id) ?? [];
    const isDiscovered = profileDiscoveries.length > 0 || seenObservations.length > 0;
    const status: DiscoveryStatus = isDiscovered
      ? "discovered"
      : missedObservations.length > 0
        ? "attempted"
        : "locked";

    return {
      ...entry,
      status,
      firstDiscoveredAt: earliestIsoDate([
        ...profileDiscoveries.map((item) => item.discoveredAt),
        ...seenObservations.map((item) => item.createdAt),
      ]),
      lastObservedAt: latestObservation(entryObservations)?.createdAt ?? null,
      // Journal counters can be lower than lifetime totals because local storage intentionally
      // retains a limited observation history. discoveredTargets remains the unlock authority.
      successfulObservationCount: seenObservations.length,
      missedObservationCount: missedObservations.length,
      recentMemory: latestObservation(seenObservations),
    };
  });

  const specialTargets = new Map<
    string,
    { target: string; discoveredDates: string[]; observations: Observation[] }
  >();
  for (const discovery of safeDiscoveries) {
    if (discovery.targetType !== "satellite") continue;
    if (resolveDiscoveryAtlasEntry(discovery.target, discovery.targetType)) continue;
    const key = normalizeDiscoveryTarget(discovery.target);
    if (!key) continue;
    const current = specialTargets.get(key) ?? {
      target: discovery.target,
      discoveredDates: [],
      observations: [],
    };
    current.discoveredDates.push(discovery.discoveredAt);
    specialTargets.set(key, current);
  }
  for (const observation of safeObservations) {
    if (observation.status !== "seen" || observation.targetType !== "satellite") continue;
    if (resolveDiscoveryAtlasEntry(observation.target, observation.targetType)) continue;
    const key = normalizeDiscoveryTarget(observation.target);
    if (!key) continue;
    const current = specialTargets.get(key) ?? {
      target: observation.target,
      discoveredDates: [],
      observations: [],
    };
    current.discoveredDates.push(observation.createdAt);
    current.observations.push(observation);
    specialTargets.set(key, current);
  }

  const specialDiscoveries = [...specialTargets.entries()]
    .map<SpecialDiscovery | null>(([key, item]) => {
      const firstDiscoveredAt = earliestIsoDate(item.discoveredDates);
      if (!firstDiscoveredAt) return null;
      const seenObservations = item.observations.filter(
        (observation) => observation.status === "seen",
      );
      return {
        id: `special-${key}`,
        target: item.target,
        frenchName: getSpecialDiscoveryName(item.target, seenObservations),
        firstDiscoveredAt,
        lastObservedAt: latestObservation(item.observations)?.createdAt ?? null,
        successfulObservationCount: seenObservations.length,
        recentMemory: latestObservation(seenObservations),
      };
    })
    .filter((item): item is SpecialDiscovery => item !== null)
    .sort(
      (left, right) =>
        (validDateTimestamp(right.firstDiscoveredAt) ?? 0) -
        (validDateTimestamp(left.firstDiscoveredAt) ?? 0),
    );

  const categoryMap = new Map<string, DiscoveryAtlasCategoryProgress>();
  for (const entry of entries) {
    const current = categoryMap.get(entry.categoryLabel) ?? {
      label: entry.categoryLabel,
      discoveredCount: 0,
      totalCount: 0,
    };
    current.totalCount += 1;
    if (entry.status === "discovered") current.discoveredCount += 1;
    categoryMap.set(entry.categoryLabel, current);
  }

  const discoveredEntries = entries.filter((entry) => entry.status === "discovered");
  const discoveredCount = discoveredEntries.length;
  const totalCount = entries.length;
  const completionRatio = totalCount === 0 ? 0 : discoveredCount / totalCount;
  const latestDiscovery =
    [...discoveredEntries].sort(
      (left, right) =>
        (validDateTimestamp(right.firstDiscoveredAt) ?? 0) -
        (validDateTimestamp(left.firstDiscoveredAt) ?? 0),
    )[0] ?? null;

  return {
    entries,
    specialDiscoveries,
    categories: [...categoryMap.values()],
    discoveredCount,
    attemptedCount: entries.filter((entry) => entry.status === "attempted").length,
    totalCount,
    completionRatio,
    completionPercent: completionRatio * 100,
    latestDiscovery,
    nextObjective:
      entries.find((entry) => entry.status === "attempted") ??
      entries.find((entry) => entry.status === "locked") ??
      null,
  };
}

export function filterDiscoveryAtlasEntries(
  entries: DiscoveryAtlasProgressEntry[],
  status: "all" | DiscoveryStatus,
  categoryLabel: string | null = null,
): DiscoveryAtlasProgressEntry[] {
  return entries.filter(
    (entry) =>
      (status === "all" || entry.status === status) &&
      (categoryLabel === null || entry.categoryLabel === categoryLabel),
  );
}
