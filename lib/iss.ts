import { createNetworkTimeoutSignal } from "./network.ts";
import type { SatelliteTrajectoryPoint } from "./types.ts";

export type IssVisiblePass = {
  startAzimuth: number;
  maxAzimuth: number;
  maxElevation: number;
  startTime: Date;
  maxTime: Date;
  durationSeconds: number;
  magnitude?: number;
  trajectory?: SatelliteTrajectoryPoint[];
};

const ISS_GUIDANCE_LEAD_MS = 5 * 60 * 1000;

export function getIssPassEndTime(pass: IssVisiblePass): Date {
  return new Date(
    Math.max(
      pass.maxTime.getTime(),
      pass.startTime.getTime() + Math.max(0, pass.durationSeconds) * 1000,
    ),
  );
}

export function isIssPassGuidable(pass: IssVisiblePass, now = new Date()): boolean {
  const startsAt = pass.startTime.getTime();
  const endsAt = getIssPassEndTime(pass).getTime();
  const currentTime = now.getTime();

  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    Number.isFinite(currentTime) &&
    currentTime >= startsAt - ISS_GUIDANCE_LEAD_MS &&
    currentTime <= endsAt
  );
}

export function isIssQuestGuidable(
  startsAt: string | undefined,
  endsAt: string | undefined,
  now = new Date(),
): boolean {
  if (!startsAt || !endsAt) return false;

  const startTime = new Date(startsAt).getTime();
  const endTime = new Date(endsAt).getTime();
  const currentTime = now.getTime();
  return (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    Number.isFinite(currentTime) &&
    currentTime >= startTime - ISS_GUIDANCE_LEAD_MS &&
    currentTime <= endTime
  );
}

export async function fetchNextIssVisiblePass({
  latitude,
  longitude,
  now,
  horizonMinutes = 90,
}: {
  latitude: number;
  longitude: number;
  now: Date;
  horizonMinutes?: number;
}): Promise<IssVisiblePass | null> {
  const url = new URL("/api/iss-pass", window.location.origin);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("now", now.toISOString());
  url.searchParams.set("horizonMinutes", horizonMinutes.toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: createNetworkTimeoutSignal(),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { pass?: IssVisiblePassPayload | null };

  return data.pass ? parseIssVisiblePass(data.pass) : null;
}

export type IssVisiblePassPayload = {
  startAzimuth: number;
  maxAzimuth: number;
  maxElevation: number;
  startTime: string;
  maxTime: string;
  durationSeconds: number;
  magnitude?: number;
  trajectory?: SatelliteTrajectoryPoint[];
};

export function parseIssVisiblePass(payload: IssVisiblePassPayload): IssVisiblePass {
  return {
    ...payload,
    startTime: new Date(payload.startTime),
    maxTime: new Date(payload.maxTime),
  };
}
