import { NextResponse } from "next/server";
import { fetchBrightSatelliteElements, fetchRecentStarlinkElements } from "@/lib/celestrak";
import { calculateNextSatelliteVisiblePass } from "@/lib/satellite-pass";
import { selectRecentStarlinkLaunches, type TrackedSatellitePassPayload } from "@/lib/satellites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const ISS_NORAD_ID = 25544;
const STARLINK_CLUSTER_WINDOW_MS = 8 * 60_000;

function readCoordinate(value: string | null, min: number, max: number): number | null {
  const parsed = Number(value);
  return value !== null && Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function readHorizon(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 30 && parsed <= 180 ? parsed : 90;
}

function endTime(pass: TrackedSatellitePassPayload): number {
  return new Date(pass.startTime).getTime() + pass.durationSeconds * 1000;
}

function azimuthDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function findStarlinkTrain(
  passes: TrackedSatellitePassPayload[],
): TrackedSatellitePassPayload | null {
  const sorted = [...passes].sort(
    (left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );

  for (const first of sorted) {
    const startsAt = new Date(first.startTime).getTime();
    const cluster = sorted.filter(
      (pass) =>
        pass.target === first.target &&
        Math.abs(new Date(pass.startTime).getTime() - startsAt) <= STARLINK_CLUSTER_WINDOW_MS &&
        azimuthDistance(pass.maxAzimuth, first.maxAzimuth) <= 40,
    );
    if (cluster.length < 3) continue;

    const maximum = cluster.reduce((best, pass) =>
      pass.maxElevation > best.maxElevation ? pass : best,
    );
    const firstPass = cluster.reduce((earliest, pass) =>
      new Date(pass.startTime).getTime() < new Date(earliest.startTime).getTime() ? pass : earliest,
    );
    const lastEndsAt = Math.max(...cluster.map(endTime));

    return {
      ...maximum,
      target: `starlink-train-${first.target}`,
      name: "Train Starlink",
      kind: "starlink_train",
      memberCount: cluster.length,
      startAzimuth: firstPass.startAzimuth,
      startTime: firstPass.startTime,
      durationSeconds: Math.round((lastEndsAt - new Date(firstPass.startTime).getTime()) / 1000),
    };
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = readCoordinate(searchParams.get("latitude"), -90, 90);
  const longitude = readCoordinate(searchParams.get("longitude"), -180, 180);
  const now = new Date(searchParams.get("now") ?? Date.now());
  const horizonMinutes = readHorizon(searchParams.get("horizonMinutes"));

  if (latitude === null || longitude === null || Number.isNaN(now.getTime())) {
    return NextResponse.json({ passes: [] }, { status: 400 });
  }

  try {
    const [brightElements, recentStarlinkElements] = await Promise.all([
      fetchBrightSatelliteElements(),
      fetchRecentStarlinkElements(),
    ]);

    const brightPasses = brightElements
      .filter(
        (element) =>
          Number(element.NORAD_CAT_ID) !== ISS_NORAD_ID &&
          !element.OBJECT_NAME.toUpperCase().startsWith("STARLINK-"),
      )
      .flatMap<TrackedSatellitePassPayload>((element) => {
        const pass = calculateNextSatelliteVisiblePass({
          orbitalElements: element,
          latitude,
          longitude,
          now,
          horizonMinutes,
        });
        return pass
          ? [
              {
                ...pass,
                target: `satellite-${element.NORAD_CAT_ID}`,
                name: element.OBJECT_NAME,
                kind: "bright_satellite",
              },
            ]
          : [];
      })
      .sort(
        (left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
      )
      .slice(0, 3);

    const starlinkPasses = selectRecentStarlinkLaunches(recentStarlinkElements).flatMap(
      (launch) => {
        const key = launch[0]?.OBJECT_ID.match(/^\d{4}-\d{3}/)?.[0];
        if (!key) return [];
        return launch.flatMap<TrackedSatellitePassPayload>((element) => {
          const pass = calculateNextSatelliteVisiblePass({
            orbitalElements: element,
            latitude,
            longitude,
            now,
            horizonMinutes,
          });
          return pass
            ? [
                {
                  ...pass,
                  target: key,
                  name: element.OBJECT_NAME,
                  kind: "starlink_train",
                },
              ]
            : [];
        });
      },
    );
    const train = findStarlinkTrain(starlinkPasses);
    const passes = train ? [...brightPasses, train] : brightPasses;

    return NextResponse.json({ passes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ passes: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
