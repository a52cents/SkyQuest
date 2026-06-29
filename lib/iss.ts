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

export async function fetchNextIssVisiblePass({
  latitude,
  longitude,
  now,
}: {
  latitude: number;
  longitude: number;
  now: Date;
}): Promise<IssVisiblePass | null> {
  const url = new URL("/api/iss-pass", window.location.origin);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("now", now.toISOString());

  const response = await fetch(url.toString(), { cache: "no-store" });

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

export function findNextIssVisiblePass(data: N2yoVisualPassResponse, now: Date): IssVisiblePassPayload | null {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const maxStartSeconds = nowSeconds + MAX_MINUTES_UNTIL_PASS * 60;
  const pass = data.passes
    ?.filter((candidate) => typeof candidate.startUTC === "number" && candidate.startUTC <= maxStartSeconds)
    .find((candidate) => typeof candidate.maxEl === "number" && candidate.maxEl >= 15);

  if (!pass || typeof pass.startAz !== "number" || typeof pass.maxAz !== "number" || typeof pass.maxEl !== "number" || typeof pass.startUTC !== "number") {
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
