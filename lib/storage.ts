import type { Observation, SkyQuest } from "@/lib/types";

const OBSERVATIONS_KEY = "skyquest.observations.v0";
const ACTIVE_QUEST_KEY = "skyquest.activeQuest.v0";
const LAST_LOCATION_KEY = "skyquest.lastLocation.v0";

type StoredLocation = {
  latitude: number;
  longitude: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can fail in private mode; the app remains usable.
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getObservations(): Observation[] {
  return readJson<Observation[]>(OBSERVATIONS_KEY, []);
}

export function addObservation(
  quest: SkyQuest,
  status: Observation["status"],
  location?: { latitude: number; longitude: number },
  photo?: Pick<Observation, "photoDataUrl" | "photoThumbnailDataUrl">,
): Observation {
  const observation: Observation = {
    id: `${quest.id}-${status}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    questTitle: quest.title,
    target: quest.target,
    status,
    visibilityScore: quest.visibilityScore,
    latitude: location ? roundCoordinate(location.latitude) : undefined,
    longitude: location ? roundCoordinate(location.longitude) : undefined,
    photoDataUrl: photo?.photoDataUrl,
    photoThumbnailDataUrl: photo?.photoThumbnailDataUrl,
  };

  const next = [observation, ...getObservations()].slice(0, 50);
  writeJson(OBSERVATIONS_KEY, next);
  return observation;
}

export function clearObservations(): void {
  writeJson(OBSERVATIONS_KEY, []);
}

export function saveActiveQuest(quest: SkyQuest): void {
  writeJson(ACTIVE_QUEST_KEY, quest);
}

export function getActiveQuest(): SkyQuest | null {
  return readJson<SkyQuest | null>(ACTIVE_QUEST_KEY, null);
}

export function saveLastLocation(location: StoredLocation): void {
  writeJson(LAST_LOCATION_KEY, {
    latitude: roundCoordinate(location.latitude),
    longitude: roundCoordinate(location.longitude),
  });
}

export function getLastLocation(): StoredLocation | null {
  return readJson<StoredLocation | null>(LAST_LOCATION_KEY, null);
}
