import { createNetworkTimeoutSignal } from "./network.ts";

export type IssVisiblePass = {
  startAzimuth: number;
  maxAzimuth: number;
  maxElevation: number;
  startTime: Date;
  maxTime: Date;
  durationSeconds: number;
  magnitude?: number;
};

type N2yoVisualPass = {
  startAz?: number;
  maxAz?: number;
  maxEl?: number;
  startUTC?: number;
  maxUTC?: number;
  duration?: number;
  mag?: number;
};

export type N2yoVisualPassResponse = {
  passes?: N2yoVisualPass[];
};

const MAX_MINUTES_UNTIL_PASS = 90;
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
};

export function parseIssVisiblePass(payload: IssVisiblePassPayload): IssVisiblePass {
  return {
    ...payload,
    startTime: new Date(payload.startTime),
    maxTime: new Date(payload.maxTime),
  };
}

export function findNextIssVisiblePass(
  data: N2yoVisualPassResponse,
  now: Date,
  horizonMinutes = MAX_MINUTES_UNTIL_PASS,
): IssVisiblePassPayload | null {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const maxStartSeconds = nowSeconds + horizonMinutes * 60;
  const pass = data.passes
    ?.filter(
      (candidate) =>
        typeof candidate.startUTC === "number" &&
        candidate.startUTC <= maxStartSeconds &&
        candidate.startUTC + Math.max(0, candidate.duration ?? 0) >= nowSeconds,
    )
    .find((candidate) => typeof candidate.maxEl === "number" && candidate.maxEl >= 15);

  if (
    !pass ||
    typeof pass.startAz !== "number" ||
    typeof pass.maxAz !== "number" ||
    typeof pass.maxEl !== "number" ||
    typeof pass.startUTC !== "number"
  ) {
    return null;
  }

  return {
    startAzimuth: pass.startAz,
    maxAzimuth: pass.maxAz,
    maxElevation: pass.maxEl,
    startTime: new Date(pass.startUTC * 1000).toISOString(),
    maxTime: new Date((pass.maxUTC ?? pass.startUTC) * 1000).toISOString(),
    durationSeconds: pass.duration ?? 0,
    magnitude: pass.mag,
  };
}
