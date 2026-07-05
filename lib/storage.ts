/**
 * Persistance locale
 *
 * Centralise la quête active, la dernière position, le journal et le profil de progression.
 * Les lectures valident les anciennes données avant de les réutiliser et les écritures gardent
 * un fallback mémoire lorsque `localStorage` est indisponible.
 *
 * Invariants de confidentialité :
 * - ne jamais envoyer les données stockées vers un serveur depuis ce module ;
 * - arrondir les coordonnées avant toute persistance ;
 * - limiter le journal aux 50 observations les plus récentes ;
 * - tolérer les données corrompues ou issues d'une ancienne version sans faire planter l'UI ;
 * - les photos restent locales dans IndexedDB ; localStorage ne garde que leurs identifiants.
 */
import { deletePhoto, savePhotoFromDataUrl } from "./photo-db.ts";
import { applyQuestReward, createEmptyProgressProfile, getLocalNightKey } from "./progression.ts";
import {
  getBestSkyWindowValidity,
  type BestSkyWindowValidityReason,
} from "./sky-window-freshness.ts";
export {
  getOnboardingCompleted,
  resetOnboardingCompleted,
  setOnboardingCompleted,
} from "./onboarding.ts";
import type {
  AchievementId,
  BestSkyWindow,
  EveningQuestAssignment,
  Observation,
  ObservationPhotoDraft,
  ProgressProfile,
  ProgressReward,
  QuestTargetType,
  SkyQuest,
} from "@/lib/types";

const OBSERVATIONS_KEY = "skyquest.observations.v0";
const ACTIVE_QUEST_KEY = "skyquest.activeQuest.v0";
const LAST_LOCATION_KEY = "skyquest.lastLocation.v0";
const PROGRESS_PROFILE_KEY = "skyquest.progression.v1";
const BEST_SKY_WINDOW_KEY = "skyquest.bestSkyWindow.v1";
const EVENING_QUEST_ASSIGNMENT_KEY = "skyquest.eveningQuestAssignment.v1";

type StoredLocation = {
  latitude: number;
  longitude: number;
};

let memoryObservations: Observation[] = [];
let memoryProfile = createEmptyProgressProfile();
let memoryActiveQuest: SkyQuest | null = null;
let memoryLastLocation: StoredLocation | null = null;
let memoryBestSkyWindow: BestSkyWindow | null = null;
let memoryEveningQuestAssignment: EveningQuestAssignment | null = null;
let legacyMigrationPromise: Promise<Observation[]> | null = null;
const failedStorageKeys = new Set<string>();

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage() || failedStorageKeys.has(key)) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  if (!canUseStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    failedStorageKeys.delete(key);
    return true;
  } catch {
    // Local storage can fail in private mode; the app remains usable.
    failedStorageKeys.add(key);
    return false;
  }
}

function removeStoredValue(key: string): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
    failedStorageKeys.delete(key);
  } catch {
    failedStorageKeys.add(key);
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeProgressProfile(
  value: Partial<ProgressProfile>,
  fallbackUpdatedAt: string,
): ProgressProfile {
  const currentStreak =
    typeof value.currentStreak === "number" && Number.isFinite(value.currentStreak)
      ? Math.max(0, Math.trunc(value.currentStreak))
      : 0;
  const longestStreak =
    typeof value.longestStreak === "number" && Number.isFinite(value.longestStreak)
      ? Math.max(0, Math.trunc(value.longestStreak))
      : currentStreak;
  const lastObservationNightKey =
    typeof value.lastObservationNightKey === "string" ? value.lastObservationNightKey : null;
  const streakFreezeCount =
    typeof value.streakFreezeCount === "number" && Number.isFinite(value.streakFreezeCount)
      ? Math.min(1, Math.max(0, Math.trunc(value.streakFreezeCount)))
      : 1;
  const lastFreezeRegenerationKey =
    typeof value.lastFreezeRegenerationKey === "string" ? value.lastFreezeRegenerationKey : null;
  const lastStreakFreezeUsedNightKey =
    typeof value.lastStreakFreezeUsedNightKey === "string"
      ? value.lastStreakFreezeUsedNightKey
      : streakFreezeCount === 0
        ? (lastFreezeRegenerationKey ?? lastObservationNightKey)
        : null;
  const eveningQuestCompletions = Array.isArray(value.eveningQuestCompletions)
    ? value.eveningQuestCompletions
        .filter(
          (item) =>
            item &&
            typeof item.nightKey === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.nightKey) &&
            typeof item.target === "string" &&
            item.target.trim().length > 0 &&
            typeof item.completedAt === "string" &&
            Number.isFinite(new Date(item.completedAt).getTime()) &&
            typeof item.bonusXp === "number" &&
            Number.isFinite(item.bonusXp) &&
            item.bonusXp >= 0,
        )
        .sort(
          (left, right) =>
            new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
        )
        .slice(-180)
    : [];

  return {
    version: 1,
    totalXp:
      typeof value.totalXp === "number" && Number.isFinite(value.totalXp)
        ? Math.max(0, value.totalXp)
        : 0,
    discoveredTargets: Array.isArray(value.discoveredTargets)
      ? value.discoveredTargets.filter(
          (item) =>
            item &&
            typeof item.target === "string" &&
            isTargetType(item.targetType) &&
            typeof item.discoveredAt === "string",
        )
      : [],
    unlockedAchievements: Array.isArray(value.unlockedAchievements)
      ? value.unlockedAchievements.filter(
          (item) => item && isAchievementId(item.id) && typeof item.unlockedAt === "string",
        )
      : [],
    rewardHistory: Array.isArray(value.rewardHistory)
      ? value.rewardHistory
          .filter(
            (item) =>
              item &&
              typeof item.key === "string" &&
              typeof item.target === "string" &&
              typeof item.localNight === "string" &&
              typeof item.awardedXp === "number" &&
              (item.status === "seen" || item.status === "missed") &&
              typeof item.updatedAt === "string",
          )
          .map((item) => ({ ...item, hadMissed: item.hadMissed === true }))
      : [],
    eveningQuestCompletions,
    eveningQuestCompletionCount:
      typeof value.eveningQuestCompletionCount === "number" &&
      Number.isFinite(value.eveningQuestCompletionCount)
        ? Math.max(eveningQuestCompletions.length, Math.trunc(value.eveningQuestCompletionCount))
        : eveningQuestCompletions.length,
    currentStreak,
    longestStreak,
    lastObservationNightKey,
    streakFreezeCount,
    lastStreakFreezeUsedNightKey,
    lastFreezeRegenerationKey,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallbackUpdatedAt,
  };
}

export function saveProgressProfile(profile: ProgressProfile): ProgressProfile {
  memoryProfile = profile;
  writeJson(PROGRESS_PROFILE_KEY, profile);
  return profile;
}

type LegacyObservation = Observation & {
  photoDataUrl?: unknown;
  photoThumbnailDataUrl?: unknown;
};

function readValidObservations(): LegacyObservation[] {
  const stored = readJson<unknown>(OBSERVATIONS_KEY, memoryObservations);
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.filter((item): item is LegacyObservation => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const value = item as Partial<Observation>;
    return (
      typeof value.id === "string" &&
      typeof value.createdAt === "string" &&
      typeof value.questTitle === "string" &&
      typeof value.target === "string" &&
      (value.status === "seen" || value.status === "missed") &&
      typeof value.visibilityScore === "number"
    );
  });
}

async function migrateLegacyObservation(observation: LegacyObservation): Promise<Observation> {
  const { photoDataUrl, photoThumbnailDataUrl, ...cleanObservation } = observation;
  const migrated: Observation = { ...cleanObservation };

  if (typeof migrated.photoId !== "string") delete migrated.photoId;
  if (typeof migrated.photoThumbnailId !== "string") delete migrated.photoThumbnailId;

  if (!migrated.photoId && typeof photoDataUrl === "string") {
    migrated.photoId = await savePhotoFromDataUrl(photoDataUrl).catch(() => undefined);
  }
  if (!migrated.photoThumbnailId && typeof photoThumbnailDataUrl === "string") {
    migrated.photoThumbnailId = await savePhotoFromDataUrl(photoThumbnailDataUrl).catch(
      () => undefined,
    );
  }

  return migrated;
}

export async function getObservations(): Promise<Observation[]> {
  const stored = readValidObservations();
  const needsMigration = stored.some(
    (observation) =>
      Object.prototype.hasOwnProperty.call(observation, "photoDataUrl") ||
      Object.prototype.hasOwnProperty.call(observation, "photoThumbnailDataUrl"),
  );
  if (needsMigration) {
    if (!legacyMigrationPromise) {
      legacyMigrationPromise = Promise.all(stored.map(migrateLegacyObservation)).then(
        (observations) => {
          memoryObservations = observations;
          writeJson(OBSERVATIONS_KEY, observations);
          return observations;
        },
      );
    }

    try {
      return await legacyMigrationPromise;
    } finally {
      legacyMigrationPromise = null;
    }
  }

  memoryObservations = stored;
  return stored;
}

function isTargetType(value: unknown): value is QuestTargetType {
  return [
    "moon",
    "planet",
    "star",
    "asterism",
    "constellation",
    "star_cluster",
    "galaxy",
    "meteor_shower",
    "satellite",
    "free_observation",
  ].includes(String(value));
}

function isAchievementId(value: unknown): value is AchievementId {
  return [
    "first-look",
    "first-planet",
    "first-constellation",
    "moon-hunter",
    "planet-tour",
    "night-landmarks",
    "orbital-watcher",
    "persistent",
    "explorer",
    "confirmed-watcher",
  ].includes(String(value));
}

export function getProgressProfile(): ProgressProfile {
  const fallback = memoryProfile;
  const stored = readJson<unknown>(PROGRESS_PROFILE_KEY, fallback);
  if (!stored || typeof stored !== "object") {
    return fallback;
  }

  const value = stored as Partial<ProgressProfile>;
  const profile = normalizeProgressProfile(value, fallback.updatedAt);
  const needsMigration =
    typeof value.currentStreak !== "number" ||
    typeof value.longestStreak !== "number" ||
    !(
      value.lastObservationNightKey === null || typeof value.lastObservationNightKey === "string"
    ) ||
    typeof value.streakFreezeCount !== "number" ||
    !Array.isArray(value.eveningQuestCompletions) ||
    typeof value.eveningQuestCompletionCount !== "number" ||
    !(
      value.lastStreakFreezeUsedNightKey === null ||
      typeof value.lastStreakFreezeUsedNightKey === "string"
    ) ||
    !(
      value.lastFreezeRegenerationKey === null ||
      typeof value.lastFreezeRegenerationKey === "string"
    );

  memoryProfile = profile;
  if (needsMigration) {
    writeJson(PROGRESS_PROFILE_KEY, profile);
  }
  return profile;
}

export function resetProgressProfile(): ProgressProfile {
  const profile = createEmptyProgressProfile(new Date().toISOString());
  return saveProgressProfile(profile);
}

export async function addObservation(
  quest: SkyQuest,
  status: Observation["status"],
  location?: { latitude: number; longitude: number },
  photo?: ObservationPhotoDraft,
  now = new Date(),
): Promise<{
  observation: Observation;
  profile: ProgressProfile;
  reward: ProgressReward;
  persisted: boolean;
}> {
  const nightKey = getLocalNightKey(now);
  const eveningAssignment = getEveningQuestAssignment();
  const hasValidEveningAssignment =
    quest.questKind === "evening" &&
    quest.eveningQuestNightKey === nightKey &&
    eveningAssignment?.nightKey === nightKey &&
    eveningAssignment.status === "active" &&
    eveningAssignment.target.trim().toLocaleLowerCase("fr-FR") ===
      quest.target.trim().toLocaleLowerCase("fr-FR");
  const rewardQuest: SkyQuest = hasValidEveningAssignment
    ? quest
    : { ...quest, questKind: "standard", eveningQuestNightKey: undefined };
  const { profile, reward } = applyQuestReward(getProgressProfile(), rewardQuest, status, now);
  const [photoId, photoThumbnailId] = await Promise.all([
    photo?.photoDataUrl
      ? savePhotoFromDataUrl(photo.photoDataUrl).catch(() => undefined)
      : Promise.resolve(undefined),
    photo?.photoThumbnailDataUrl
      ? savePhotoFromDataUrl(photo.photoThumbnailDataUrl).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  const observation: Observation = {
    id: `${quest.id}-${status}-${Date.now()}`,
    createdAt: now.toISOString(),
    questTitle: rewardQuest.title,
    target: rewardQuest.target,
    status,
    visibilityScore: rewardQuest.visibilityScore,
    targetType: rewardQuest.targetType,
    difficulty: rewardQuest.difficulty,
    xpEarned: reward.xpEarned,
    isFirstDiscovery: reward.isFirstDiscovery,
    unlockedAchievements: reward.unlockedAchievements,
    totalXp: reward.totalXp,
    rankName: reward.rankName,
    streak: reward.currentStreak,
    weather: rewardQuest.weather,
    latitude: location ? roundCoordinate(location.latitude) : undefined,
    longitude: location ? roundCoordinate(location.longitude) : undefined,
    photoId,
    photoThumbnailId,
    questKind: rewardQuest.questKind,
    eveningQuestBonusXp: reward.eveningQuestBonusXp,
  };

  const previous = await getObservations();
  const next = [observation, ...previous].slice(0, 50);
  const discarded = previous.slice(49);
  saveProgressProfile(profile);
  if (reward.isEveningQuestCompleted) {
    completeEveningQuestAssignment(nightKey, rewardQuest.target, now);
  }
  memoryObservations = next;
  const observationPersisted = writeJson(OBSERVATIONS_KEY, next);
  await Promise.allSettled(
    discarded.flatMap((item) =>
      [item.photoId, item.photoThumbnailId]
        .filter((id): id is string => typeof id === "string")
        .map(deletePhoto),
    ),
  );
  return { observation, profile, reward, persisted: observationPersisted };
}

export async function clearObservations(): Promise<void> {
  const observations = await getObservations();
  memoryObservations = [];
  writeJson(OBSERVATIONS_KEY, []);
  await Promise.allSettled(
    observations.flatMap((observation) =>
      [observation.photoId, observation.photoThumbnailId]
        .filter((id): id is string => typeof id === "string")
        .map(deletePhoto),
    ),
  );
}

export function saveActiveQuest(quest: SkyQuest): void {
  memoryActiveQuest = quest;
  writeJson(ACTIVE_QUEST_KEY, quest);
}

export function getActiveQuest(): SkyQuest | null {
  const quest = readJson<SkyQuest | null>(ACTIVE_QUEST_KEY, memoryActiveQuest);
  memoryActiveQuest = quest;
  return quest;
}

function isValidEveningQuestAssignment(value: unknown): value is EveningQuestAssignment {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Partial<EveningQuestAssignment>;
  return (
    assignment.version === 1 &&
    typeof assignment.nightKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(assignment.nightKey) &&
    typeof assignment.target === "string" &&
    assignment.target.trim().length > 0 &&
    isTargetType(assignment.targetType) &&
    typeof assignment.assignedAt === "string" &&
    Number.isFinite(new Date(assignment.assignedAt).getTime()) &&
    typeof assignment.lastMatchedAt === "string" &&
    Number.isFinite(new Date(assignment.lastMatchedAt).getTime()) &&
    (assignment.status === "active" || assignment.status === "completed") &&
    (assignment.completedAt === undefined ||
      (typeof assignment.completedAt === "string" &&
        Number.isFinite(new Date(assignment.completedAt).getTime())))
  );
}

export function getEveningQuestAssignment(): EveningQuestAssignment | null {
  const value = readJson<unknown>(EVENING_QUEST_ASSIGNMENT_KEY, memoryEveningQuestAssignment);
  if (!isValidEveningQuestAssignment(value)) {
    memoryEveningQuestAssignment = null;
    if (value !== null) removeStoredValue(EVENING_QUEST_ASSIGNMENT_KEY);
    return null;
  }
  memoryEveningQuestAssignment = value;
  return value;
}

export function saveEveningQuestAssignment(
  assignment: EveningQuestAssignment,
): EveningQuestAssignment | null {
  if (!isValidEveningQuestAssignment(assignment)) return null;
  memoryEveningQuestAssignment = assignment;
  writeJson(EVENING_QUEST_ASSIGNMENT_KEY, assignment);
  return assignment;
}

export function clearExpiredEveningQuestAssignment(
  nightKey = getLocalNightKey(new Date()),
): EveningQuestAssignment | null {
  const assignment = getEveningQuestAssignment();
  if (!assignment || assignment.nightKey === nightKey) return assignment;
  memoryEveningQuestAssignment = null;
  removeStoredValue(EVENING_QUEST_ASSIGNMENT_KEY);
  return null;
}

export function completeEveningQuestAssignment(
  nightKey: string,
  target: string,
  now = new Date(),
): EveningQuestAssignment | null {
  const assignment = getEveningQuestAssignment();
  if (
    !assignment ||
    assignment.nightKey !== nightKey ||
    assignment.status !== "active" ||
    assignment.target.trim().toLocaleLowerCase("fr-FR") !== target.trim().toLocaleLowerCase("fr-FR")
  ) {
    return assignment;
  }
  return saveEveningQuestAssignment({
    ...assignment,
    status: "completed",
    completedAt: now.toISOString(),
  });
}

export function saveLastLocation(location: StoredLocation): void {
  const roundedLocation = {
    latitude: roundCoordinate(location.latitude),
    longitude: roundCoordinate(location.longitude),
  };
  memoryLastLocation = roundedLocation;
  writeJson(LAST_LOCATION_KEY, roundedLocation);
}

export function getLastLocation(): StoredLocation | null {
  const location = readJson<StoredLocation | null>(LAST_LOCATION_KEY, memoryLastLocation);
  memoryLastLocation = location;
  return location;
}

export function saveBestSkyWindow(window: BestSkyWindow): void {
  memoryBestSkyWindow = window;
  writeJson(BEST_SKY_WINDOW_KEY, window);
}

export type BestSkyWindowReadResult = {
  window: BestSkyWindow | null;
  reason: BestSkyWindowValidityReason | "missing" | "invalid_structure";
};

export function getBestSkyWindowStatus(now = new Date()): BestSkyWindowReadResult {
  const value = readJson<BestSkyWindow | null>(BEST_SKY_WINDOW_KEY, memoryBestSkyWindow);
  if (!value) {
    memoryBestSkyWindow = null;
    return { window: null, reason: "missing" };
  }

  if (
    typeof value.generatedAt !== "string" ||
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string" ||
    typeof value.score !== "number" ||
    !Array.isArray(value.hours) ||
    !Array.isArray(value.bestTargets) ||
    typeof value.isEstimated !== "boolean"
  ) {
    memoryBestSkyWindow = null;
    removeStoredValue(BEST_SKY_WINDOW_KEY);
    return { window: null, reason: "invalid_structure" };
  }

  const validity = getBestSkyWindowValidity(value, now);
  if (!validity.valid) {
    memoryBestSkyWindow = null;
    removeStoredValue(BEST_SKY_WINDOW_KEY);
    return { window: null, reason: validity.reason };
  }

  memoryBestSkyWindow = value;
  return { window: value, reason: "valid" };
}

export function getBestSkyWindow(now = new Date()): BestSkyWindow | null {
  return getBestSkyWindowStatus(now).window;
}
