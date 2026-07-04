import { NextResponse } from "next/server";
import { fetchIssOrbitalElements } from "@/lib/celestrak";
import { calculateNextSatelliteVisiblePass } from "@/lib/satellite-pass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function readInteger(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = readCoordinate(searchParams.get("latitude"), -90, 90);
  const longitude = readCoordinate(searchParams.get("longitude"), -180, 180);
  const now = new Date(searchParams.get("now") ?? Date.now());
  const horizonMinutes = readInteger(searchParams.get("horizonMinutes"), 90, 30, 24 * 60);

  if (latitude === null || longitude === null || Number.isNaN(now.getTime())) {
    return NextResponse.json({ pass: null }, { status: 400 });
  }

  try {
    const orbitalElements = await fetchIssOrbitalElements();
    const pass = calculateNextSatelliteVisiblePass({
      orbitalElements,
      latitude,
      longitude,
      now,
      horizonMinutes,
    });

    return NextResponse.json({ pass }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ pass: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
