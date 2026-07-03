import { getDefaultLightPollutionEstimate, type LightPollutionEstimate } from "./light-pollution";
import { createNetworkTimeoutSignal } from "./network.ts";

const CACHE_PREFIX = "skyquest.light-pollution.v1";
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function cacheKey(latitude: number, longitude: number): string {
  return `${CACHE_PREFIX}:${roundCoordinate(latitude).toFixed(2)}:${roundCoordinate(longitude).toFixed(2)}`;
}

function readCache(latitude: number, longitude: number): LightPollutionEstimate | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;
    const value = JSON.parse(raw) as { savedAt?: number; estimate?: LightPollutionEstimate };
    if (
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > CACHE_MAX_AGE_MS ||
      !value.estimate ||
      typeof value.estimate.score !== "number"
    ) {
      return null;
    }
    return value.estimate;
  } catch {
    return null;
  }
}

function writeCache(latitude: number, longitude: number, estimate: LightPollutionEstimate): void {
  try {
    window.localStorage.setItem(
      cacheKey(latitude, longitude),
      JSON.stringify({ savedAt: Date.now(), estimate }),
    );
  } catch {
    // A storage failure must not block quest generation.
  }
}

export async function fetchLightPollutionEstimate(
  latitude: number,
  longitude: number,
): Promise<LightPollutionEstimate> {
  const cached = readCache(latitude, longitude);
  if (cached) return cached;

  try {
    const query = new URLSearchParams({
      lat: roundCoordinate(latitude).toFixed(2),
      lon: roundCoordinate(longitude).toFixed(2),
    });
    const response = await fetch(`/api/light-pollution?${query.toString()}`, {
      signal: createNetworkTimeoutSignal(),
    });
    if (!response.ok) throw new Error("Light pollution estimate unavailable");
    const estimate = (await response.json()) as LightPollutionEstimate;
    if (typeof estimate.score !== "number" || typeof estimate.label !== "string") {
      throw new Error("Invalid light pollution estimate");
    }
    if (estimate.source !== "fallback") writeCache(latitude, longitude, estimate);
    return estimate;
  } catch {
    return getDefaultLightPollutionEstimate();
  }
}
