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
import { deletePhoto, savePhotoFromDataUrl } from "@/lib/photo-db";
import { applyQuestReward, createEmptyProgressProfile } from "@/lib/progression";
export {
  getOnboardingCompleted,
  resetOnboardingCompleted,
  setOnboardingCompleted,
} from "@/lib/onboarding";
import type {
  AchievementId,
  BestSkyWindow,
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

type StoredLocation = {
  latitude: number;
  longitude: number;
};

let memoryObservations: Observation[] = [];
let memoryProfile = createEmptyProgressProfile();
let memoryActiveQuest: SkyQuest | null = null;
let memoryLastLocation: StoredLocation | null = null;
let memoryBestSkyWindow: BestSkyWindow | null = null;
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
    currentStreak,
    longestStreak,
    lastObservationNightKey:
      typeof value.lastObservationNightKey === "string" ? value.lastObservationNightKey : null,
    streakFreezeCount:
      typeof value.streakFreezeCount === "number" && Number.isFinite(value.streakFreezeCount)
        ? Math.min(1, Math.max(0, Math.trunc(value.streakFreezeCount)))
        : 1,
    lastFreezeRegenerationKey:
      typeof value.lastFreezeRegenerationKey === "string" ? value.lastFreezeRegenerationKey : null,
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
  const { profile, reward } = applyQuestReward(getProgressProfile(), quest, status, now);
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
    questTitle: quest.title,
    target: quest.target,
    status,
    visibilityScore: quest.visibilityScore,
    targetType: quest.targetType,
    difficulty: quest.difficulty,
    xpEarned: reward.xpEarned,
    isFirstDiscovery: reward.isFirstDiscovery,
    unlockedAchievements: reward.unlockedAchievements,
    totalXp: reward.totalXp,
    rankName: reward.rankName,
    streak: reward.currentStreak,
    weather: quest.weather,
    latitude: location ? roundCoordinate(location.latitude) : undefined,
    longitude: location ? roundCoordinate(location.longitude) : undefined,
    photoId,
    photoThumbnailId,
  };

  const previous = await getObservations();
  const next = [observation, ...previous].slice(0, 50);
  const discarded = previous.slice(49);
  saveProgressProfile(profile);
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

export function getBestSkyWindow(): BestSkyWindow | null {
  const value = readJson<BestSkyWindow | null>(BEST_SKY_WINDOW_KEY, memoryBestSkyWindow);
  if (
    !value ||
    typeof value.generatedAt !== "string" ||
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string" ||
    typeof value.score !== "number" ||
    !Array.isArray(value.hours) ||
    !Array.isArray(value.bestTargets)
  ) {
    return null;
  }
  memoryBestSkyWindow = value;
  return value;
}
