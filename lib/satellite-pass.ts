import { getSunAltitude } from "./astro.ts";
import type { IssVisiblePassPayload } from "./iss.ts";
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  jday,
  json2satrec,
  propagate,
  radiansToDegrees,
  shadowFraction,
  sunPos,
  type OMMJsonObject,
  type SatRec,
} from "satellite.js";

const SAMPLE_INTERVAL_MS = 20_000;
const PASS_LOOKBACK_MS = 15 * 60 * 1000;
const MIN_VISIBLE_ALTITUDE = 10;
const MIN_PASS_MAX_ALTITUDE = 15;
const MAX_SUN_ALTITUDE = -4;
const MAX_SHADOW_FRACTION = 0.95;

type VisibleSample = {
  date: Date;
  azimuth: number;
  altitude: number;
};

function normalizeAzimuth(azimuth: number): number {
  return ((azimuth % 360) + 360) % 360;
}

function getVisibleSample({
  satrec,
  latitude,
  longitude,
  date,
}: {
  satrec: SatRec;
  latitude: number;
  longitude: number;
  date: Date;
}): VisibleSample | null {
  const propagated = propagate(satrec, date);
  if (!propagated) return null;

  const lookAngles = ecfToLookAngles(
    {
      latitude: degreesToRadians(latitude),
      longitude: degreesToRadians(longitude),
      height: 0,
    },
    eciToEcf(propagated.position, gstime(date)),
  );
  const altitude = radiansToDegrees(lookAngles.elevation);

  if (
    altitude < MIN_VISIBLE_ALTITUDE ||
    getSunAltitude(latitude, longitude, date) > MAX_SUN_ALTITUDE ||
    shadowFraction(sunPos(jday(date)).rsun, propagated.position) >= MAX_SHADOW_FRACTION
  ) {
    return null;
  }

  return {
    date,
    azimuth: normalizeAzimuth(radiansToDegrees(lookAngles.azimuth)),
    altitude,
  };
}

function toPayload(samples: VisibleSample[]): IssVisiblePassPayload | null {
  if (samples.length < 2) return null;

  const maximum = samples.reduce((best, sample) =>
    sample.altitude > best.altitude ? sample : best,
  );
  if (maximum.altitude < MIN_PASS_MAX_ALTITUDE) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];

  return {
    startAzimuth: first.azimuth,
    maxAzimuth: maximum.azimuth,
    maxElevation: maximum.altitude,
    startTime: first.date.toISOString(),
    maxTime: maximum.date.toISOString(),
    durationSeconds: Math.max(0, Math.round((last.date.getTime() - first.date.getTime()) / 1000)),
    trajectory: samples.map((sample) => ({
      at: sample.date.toISOString(),
      azimuth: sample.azimuth,
      altitude: sample.altitude,
    })),
  };
}

/**
 * Estime le prochain segment observable d'un passage avec SGP4. Un segment n'est retenu que
 * lorsque le satellite est assez haut, éclairé par le Soleil et vu depuis un ciel au moins sombre.
 */
export function calculateNextSatelliteVisiblePass({
  orbitalElements,
  latitude,
  longitude,
  now,
  horizonMinutes,
}: {
  orbitalElements: OMMJsonObject;
  latitude: number;
  longitude: number;
  now: Date;
  horizonMinutes: number;
}): IssVisiblePassPayload | null {
  const satrec = json2satrec(orbitalElements);
  const nowMs = now.getTime();
  const searchStartMs = nowMs - PASS_LOOKBACK_MS;
  const searchEndMs = nowMs + horizonMinutes * 60_000;
  let currentPass: VisibleSample[] = [];

  for (let timeMs = searchStartMs; timeMs <= searchEndMs; timeMs += SAMPLE_INTERVAL_MS) {
    const sample = getVisibleSample({
      satrec,
      latitude,
      longitude,
      date: new Date(timeMs),
    });

    if (sample) {
      currentPass.push(sample);
      continue;
    }

    if (currentPass.length > 0) {
      const payload = toPayload(currentPass);
      const endsAt = payload
        ? new Date(payload.startTime).getTime() + payload.durationSeconds * 1000
        : 0;
      if (payload && endsAt >= nowMs) return payload;
      currentPass = [];
    }
  }

  const payload = toPayload(currentPass);
  const endsAt = payload
    ? new Date(payload.startTime).getTime() + payload.durationSeconds * 1000
    : 0;
  return payload && endsAt >= nowMs ? payload : null;
}
