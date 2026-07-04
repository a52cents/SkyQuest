import { createNetworkTimeoutSignal } from "./network.ts";
import type { IssVisiblePass, IssVisiblePassPayload } from "./iss.ts";
import type { OMMJsonObject } from "satellite.js";

export type TrackedSatelliteKind = "bright_satellite" | "starlink_train";

export type TrackedSatellitePass = IssVisiblePass & {
  target: string;
  name: string;
  kind: TrackedSatelliteKind;
  memberCount?: number;
};

export type TrackedSatellitePassPayload = IssVisiblePassPayload & {
  target: string;
  name: string;
  kind: TrackedSatelliteKind;
  memberCount?: number;
};

const RECENT_STARLINK_LAUNCH_LIMIT = 2;
const STARLINK_ELEMENTS_PER_LAUNCH = 30;

function launchKey(element: OMMJsonObject): string | null {
  return element.OBJECT_ID.match(/^\d{4}-\d{3}/)?.[0] ?? null;
}

/** Limite volontairement les calculs Starlink aux deux lancements les plus récents. */
export function selectRecentStarlinkLaunches(elements: OMMJsonObject[]): OMMJsonObject[][] {
  const launches = new Map<string, OMMJsonObject[]>();

  for (const element of elements) {
    const key = launchKey(element);
    if (!key) continue;
    const launch = launches.get(key) ?? [];
    launch.push(element);
    launches.set(key, launch);
  }

  return [...launches.values()]
    .sort((left, right) => {
      const leftEpoch = Math.max(...left.map((element) => new Date(element.EPOCH).getTime()));
      const rightEpoch = Math.max(...right.map((element) => new Date(element.EPOCH).getTime()));
      return rightEpoch - leftEpoch;
    })
    .slice(0, RECENT_STARLINK_LAUNCH_LIMIT)
    .map((launch) =>
      launch
        .sort((left, right) => Number(left.NORAD_CAT_ID) - Number(right.NORAD_CAT_ID))
        .slice(0, STARLINK_ELEMENTS_PER_LAUNCH),
    );
}

export async function fetchTrackedSatellitePasses({
  latitude,
  longitude,
  now,
  horizonMinutes = 90,
}: {
  latitude: number;
  longitude: number;
  now: Date;
  horizonMinutes?: number;
}): Promise<TrackedSatellitePass[]> {
  const url = new URL("/api/satellite-passes", window.location.origin);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("now", now.toISOString());
  url.searchParams.set("horizonMinutes", horizonMinutes.toString());

  const response = await fetch(url, {
    cache: "no-store",
    signal: createNetworkTimeoutSignal(),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as { passes?: TrackedSatellitePassPayload[] };
  return (data.passes ?? []).map((pass) => ({
    ...pass,
    startTime: new Date(pass.startTime),
    maxTime: new Date(pass.maxTime),
  }));
}
