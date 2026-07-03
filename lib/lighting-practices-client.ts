import { isLightingPracticeEstimate, type LightingPracticeEstimate } from "./lighting-practices";
import { createNetworkTimeoutSignal } from "./network.ts";

const CACHE_PREFIX = "skyquest.lighting-practice.v1";
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function rounded(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function cacheKey(latitude: number, longitude: number): string {
  return `${CACHE_PREFIX}:${rounded(latitude)}:${rounded(longitude)}`;
}

function readCache(latitude: number, longitude: number): LightingPracticeEstimate | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;
    const value = JSON.parse(raw) as { savedAt?: number; estimate?: LightingPracticeEstimate };
    if (
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > CACHE_MAX_AGE_MS ||
      !isLightingPracticeEstimate(value.estimate)
    ) {
      return null;
    }
    return value.estimate;
  } catch {
    return null;
  }
}

function writeCache(latitude: number, longitude: number, estimate: LightingPracticeEstimate): void {
  try {
    window.localStorage.setItem(
      cacheKey(latitude, longitude),
      JSON.stringify({ savedAt: Date.now(), estimate }),
    );
  } catch {
    // The analysis remains usable without browser storage.
  }
}

export async function fetchLightingPracticeEstimate(
  latitude: number,
  longitude: number,
): Promise<LightingPracticeEstimate | null> {
  const cached = readCache(latitude, longitude);
  if (cached) return cached;

  try {
    const query = new URLSearchParams({ lat: rounded(latitude), lon: rounded(longitude) });
    const response = await fetch(`/api/lighting-practice?${query.toString()}`, {
      signal: createNetworkTimeoutSignal(),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { estimate?: LightingPracticeEstimate | null };
    if (!isLightingPracticeEstimate(payload.estimate)) return null;
    writeCache(latitude, longitude, payload.estimate);
    return payload.estimate;
  } catch {
    return null;
  }
}
