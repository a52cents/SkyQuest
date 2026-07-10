/**
 * Persistance locale
 *
 * Centralise la quête active, la dernière position, le journal et le profil de progression.
 * Les lectures valident les anciennes données avant de les réutiliser. Les réglages gardent un
 * fallback mémoire lorsque `localStorage` est indisponible ; une observation, ses photos et sa
 * progression ne sont validées qu'après le commit IndexedDB de l'observation.
 *
 * Invariants de confidentialité :
 * - ne jamais envoyer les données stockées vers un serveur depuis ce module ;
 * - arrondir les coordonnées avant toute persistance ;
 * - ne jamais supprimer silencieusement une ancienne observation ;
 * - tolérer les données corrompues ou issues d'une ancienne version sans faire planter l'UI ;
 * - les photos restent locales dans IndexedDB ; localStorage ne garde que leurs identifiants.
 */
import { photoDataUrlToBlob, savePhotoFromDataUrl } from "./photo-db.ts";
import {
  addStoredObservationWithPhotos,
  clearStoredObservations,
  countObservations as countDatabaseObservations,
  getObservation as getDatabaseObservation,
  getObservationPage as getDatabaseObservationPage,
  importStoredObservations,
  MAX_STORED_OBSERVATIONS,
  updateStoredObservation,
  type ObservationPageOptions,
} from "./local-database.ts";
import { applyQuestReward, createEmptyProgressProfile, getLocalNightKey } from "./progression.ts";
import {
  getBestSkyWindowValidity,
  type BestSkyWindowValidityReason,
} from "./sky-window-freshness.ts";
import {
  parseBestSkyWindow,
  parseSkyQuest,
  parseStoredLocation,
  type StoredLocation,
} from "./storage-parsers.ts";
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
  ObservationReport,
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

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    removeStoredValue(key);
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

function removeStoredValue(key: string): boolean {
  if (!canUseStorage()) return true;

  try {
    window.localStorage.removeItem(key);
    failedStorageKeys.delete(key);
    return true;
  } catch {
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
  const weeklyStreak =
    typeof value.weeklyStreak === "number" && Number.isFinite(value.weeklyStreak)
      ? Math.max(0, Math.trunc(value.weeklyStreak))
      : 0;
  const longestWeeklyStreak =
    typeof value.longestWeeklyStreak === "number" && Number.isFinite(value.longestWeeklyStreak)
      ? Math.max(weeklyStreak, Math.trunc(value.longestWeeklyStreak))
      : weeklyStreak;
  const emptyWeeklyProgress = createEmptyProgressProfile(fallbackUpdatedAt).currentWeek;
  const currentWeek =
    value.currentWeek &&
    typeof value.currentWeek.weekKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.currentWeek.weekKey) &&
    Array.isArray(value.currentWeek.successfulNightKeys)
      ? {
          weekKey: value.currentWeek.weekKey,
          successfulNightKeys: [
            ...new Set(
              value.currentWeek.successfulNightKeys.filter(
                (key): key is string => typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key),
              ),
            ),
          ],
          completed:
            value.currentWeek.completed === true &&
            new Set(value.currentWeek.successfulNightKeys).size >= 2,
        }
      : emptyWeeklyProgress;

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
    weeklyStreak,
    longestWeeklyStreak,
    currentWeek,
    lastCompletedWeekKey:
      typeof value.lastCompletedWeekKey === "string" ? value.lastCompletedWeekKey : null,
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

function isObservationReport(value: unknown): value is ObservationReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<ObservationReport>;
  const seenValues = ["bright", "faint", "color_noticed", "shape_recognized", "movement_seen"];
  const missedValues = [
    "clouds",
    "blocked_horizon",
    "uncertain_direction",
    "too_faint",
    "not_enough_time",
  ];
  return (
    typeof report.recordedAt === "string" &&
    Number.isFinite(new Date(report.recordedAt).getTime()) &&
    ((report.kind === "seen_detail" && seenValues.includes(String(report.value))) ||
      (report.kind === "missed_reason" && missedValues.includes(String(report.value))))
  );
}

function normalizeObservation(value: unknown): LegacyObservation | null {
  if (!value || typeof value !== "object") return null;
  const observation = value as LegacyObservation;
  if (
    typeof observation.id !== "string" ||
    typeof observation.createdAt !== "string" ||
    !Number.isFinite(new Date(observation.createdAt).getTime()) ||
    typeof observation.questTitle !== "string" ||
    typeof observation.target !== "string" ||
    (observation.status !== "seen" && observation.status !== "missed") ||
    typeof observation.visibilityScore !== "number"
  ) {
    return null;
  }
  if (
    observation.observationReport &&
    (!isObservationReport(observation.observationReport) ||
      (observation.status === "seen" && observation.observationReport.kind !== "seen_detail") ||
      (observation.status === "missed" && observation.observationReport.kind !== "missed_reason"))
  ) {
    const cleanObservation = { ...observation };
    delete cleanObservation.observationReport;
    return cleanObservation;
  }
  return observation;
}

function readValidObservations(): LegacyObservation[] {
  const stored = readJson<unknown>(OBSERVATIONS_KEY, memoryObservations);
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .map(normalizeObservation)
    .filter((item): item is LegacyObservation => Boolean(item));
}

async function migrateLegacyObservation(observation: LegacyObservation): Promise<Observation> {
  const { photoDataUrl, photoThumbnailDataUrl, ...cleanObservation } = observation;
  const migrated: Observation = { ...cleanObservation };

  if (typeof migrated.photoId !== "string") delete migrated.photoId;
  if (typeof migrated.photoThumbnailId !== "string") delete migrated.photoThumbnailId;

  if (!migrated.photoId && typeof photoDataUrl === "string") {
    migrated.photoId = await savePhotoFromDataUrl(
      photoDataUrl,
      `legacy-${observation.id}-photo`,
    ).catch(() => undefined);
  }
  if (!migrated.photoThumbnailId && typeof photoThumbnailDataUrl === "string") {
    migrated.photoThumbnailId = await savePhotoFromDataUrl(
      photoThumbnailDataUrl,
      `legacy-${observation.id}-thumbnail`,
    ).catch(() => undefined);
  }

  return migrated;
}

async function ensureLegacyObservationsMigrated(): Promise<void> {
  if (!canUseStorage() || window.localStorage.getItem(OBSERVATIONS_KEY) === null) return;
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = Promise.all(
      readValidObservations().map(migrateLegacyObservation),
    ).then(async (observations) => {
      await importStoredObservations(observations);
      if (!removeStoredValue(OBSERVATIONS_KEY)) {
        throw new Error("Impossible de terminer la migration du journal.");
      }
      memoryObservations = sortMemoryObservations(observations);
      return memoryObservations;
    });
  }
  try {
    await legacyMigrationPromise;
  } finally {
    legacyMigrationPromise = null;
  }
}

function sortMemoryObservations(observations: Observation[]): Observation[] {
  return [...observations]
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
    )
    .slice(0, MAX_STORED_OBSERVATIONS);
}

export async function getObservationPage(options: ObservationPageOptions): Promise<Observation[]> {
  try {
    await ensureLegacyObservationsMigrated();
    const observations = (await getDatabaseObservationPage(options))
      .map(normalizeObservation)
      .filter((item): item is Observation => Boolean(item));
    memoryObservations = sortMemoryObservations([
      ...memoryObservations.filter((item) => !observations.some((stored) => stored.id === item.id)),
      ...observations,
    ]);
    return observations;
  } catch {
    const sorted = sortMemoryObservations(memoryObservations);
    const start = options.before
      ? sorted.findIndex(
          (item) =>
            item.createdAt < options.before!.createdAt ||
            (item.createdAt === options.before!.createdAt && item.id < options.before!.id),
        )
      : 0;
    const safeStart = start < 0 ? sorted.length : start;
    return sorted.slice(safeStart, safeStart + options.limit);
  }
}

export async function getObservations(): Promise<Observation[]> {
  return getObservationPage({ limit: MAX_STORED_OBSERVATIONS });
}

export async function countObservations(): Promise<number> {
  try {
    await ensureLegacyObservationsMigrated();
    return await countDatabaseObservations();
  } catch {
    return memoryObservations.length;
  }
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
    ) ||
    typeof value.weeklyStreak !== "number" ||
    typeof value.longestWeeklyStreak !== "number" ||
    !value.currentWeek ||
    !(value.lastCompletedWeekKey === null || typeof value.lastCompletedWeekKey === "string");

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
): Promise<
  | {
      persisted: true;
      observation: Observation;
      profile: ProgressProfile;
      reward: ProgressReward;
    }
  | { persisted: false; reason: "observation_persistence_failed" }
> {
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
  const observationDraft: Observation = {
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
    questKind: rewardQuest.questKind,
    eveningQuestBonusXp: reward.eveningQuestBonusXp,
  };

  let observation: Observation;
  try {
    const photoBlob = photo?.photoDataUrl ? photoDataUrlToBlob(photo.photoDataUrl) : undefined;
    const thumbnailBlob = photo?.photoThumbnailDataUrl
      ? photoDataUrlToBlob(photo.photoThumbnailDataUrl)
      : undefined;
    await ensureLegacyObservationsMigrated();
    observation = await addStoredObservationWithPhotos(observationDraft, {
      photo: photoBlob,
      thumbnail: thumbnailBlob,
    });
  } catch {
    return { persisted: false, reason: "observation_persistence_failed" };
  }

  // La progression ne peut avancer qu'après le commit atomique de l'observation et des photos.
  saveProgressProfile(profile);
  if (reward.isEveningQuestCompleted) {
    completeEveningQuestAssignment(nightKey, rewardQuest.target, now);
  }
  memoryObservations = sortMemoryObservations([
    observation,
    ...memoryObservations.filter((item) => item.id !== observation.id),
  ]);
  return { observation, profile, reward, persisted: true };
}

export async function clearObservations(): Promise<
  { cleared: true } | { cleared: false; reason: "journal_clear_failed" }
> {
  try {
    await ensureLegacyObservationsMigrated();
    await clearStoredObservations();
    memoryObservations = [];
    return { cleared: true };
  } catch {
    return { cleared: false, reason: "journal_clear_failed" };
  }
}

export async function updateObservationReport(
  observationId: string,
  report: ObservationReport,
): Promise<Observation | null> {
  if (!observationId || !isObservationReport(report)) return null;
  let observation: Observation | null = null;
  try {
    await ensureLegacyObservationsMigrated();
    observation = await getDatabaseObservation(observationId);
  } catch {
    observation = memoryObservations.find((item) => item.id === observationId) ?? null;
  }
  const expectedKind = observation?.status === "seen" ? "seen_detail" : "missed_reason";
  if (!observation || report.kind !== expectedKind) return null;

  const updated = { ...observation, observationReport: report };
  memoryObservations = memoryObservations.map((item) =>
    item.id === observationId ? updated : item,
  );
  try {
    await updateStoredObservation(updated);
  } catch {
    // Memory fallback already contains the update for this session.
  }
  return updated;
}

export function saveActiveQuest(quest: SkyQuest): void {
  const parsed = parseSkyQuest(quest);
  if (!parsed) return;
  memoryActiveQuest = parsed;
  writeJson(ACTIVE_QUEST_KEY, parsed);
}

export function getActiveQuest(): SkyQuest | null {
  const value = readJson<unknown>(ACTIVE_QUEST_KEY, memoryActiveQuest);
  const quest = parseSkyQuest(value);
  if (!quest) {
    memoryActiveQuest = null;
    if (value !== null) removeStoredValue(ACTIVE_QUEST_KEY);
    return null;
  }
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
  const roundedLocation = parseStoredLocation({
    latitude: roundCoordinate(location.latitude),
    longitude: roundCoordinate(location.longitude),
    ...(typeof location.altitudeMeters === "number"
      ? { altitudeMeters: Math.round(location.altitudeMeters / 10) * 10 }
      : {}),
  });
  if (!roundedLocation) return;
  memoryLastLocation = roundedLocation;
  writeJson(LAST_LOCATION_KEY, roundedLocation);
}

export function getLastLocation(): StoredLocation | null {
  const value = readJson<unknown>(LAST_LOCATION_KEY, memoryLastLocation);
  const location = parseStoredLocation(value);
  if (!location) {
    memoryLastLocation = null;
    if (value !== null) removeStoredValue(LAST_LOCATION_KEY);
    return null;
  }
  memoryLastLocation = location;
  return location;
}

export function saveBestSkyWindow(window: BestSkyWindow): void {
  const parsed = parseBestSkyWindow(window);
  if (!parsed) return;
  memoryBestSkyWindow = parsed;
  writeJson(BEST_SKY_WINDOW_KEY, parsed);
}

export type BestSkyWindowReadResult = {
  window: BestSkyWindow | null;
  reason: BestSkyWindowValidityReason | "missing" | "invalid_structure";
};

export function getBestSkyWindowStatus(now = new Date()): BestSkyWindowReadResult {
  const value = readJson<unknown>(BEST_SKY_WINDOW_KEY, memoryBestSkyWindow);
  if (!value) {
    memoryBestSkyWindow = null;
    return { window: null, reason: "missing" };
  }

  const parsed = parseBestSkyWindow(value);
  if (!parsed) {
    memoryBestSkyWindow = null;
    removeStoredValue(BEST_SKY_WINDOW_KEY);
    return { window: null, reason: "invalid_structure" };
  }

  const validity = getBestSkyWindowValidity(parsed, now);
  if (!validity.valid) {
    memoryBestSkyWindow = null;
    removeStoredValue(BEST_SKY_WINDOW_KEY);
    return { window: null, reason: validity.reason };
  }

  memoryBestSkyWindow = parsed;
  return { window: parsed, reason: "valid" };
}

export function getBestSkyWindow(now = new Date()): BestSkyWindow | null {
  return getBestSkyWindowStatus(now).window;
}
