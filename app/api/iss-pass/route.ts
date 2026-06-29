import { NextResponse } from "next/server";
import { findNextIssVisiblePass, type N2yoVisualPassResponse } from "@/lib/iss";

const ISS_NORAD_ID = 25544;

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

export async function GET(request: Request) {
  const apiKey = process.env.N2YO_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ pass: null });
  }

  const { searchParams } = new URL(request.url);
  const latitude = readCoordinate(searchParams.get("latitude"), -90, 90);
  const longitude = readCoordinate(searchParams.get("longitude"), -180, 180);
  const now = new Date(searchParams.get("now") ?? Date.now());

  if (latitude === null || longitude === null || Number.isNaN(now.getTime())) {
    return NextResponse.json({ pass: null }, { status: 400 });
  }

  const url = new URL(`https://api.n2yo.com/rest/v1/satellite/visualpasses/${ISS_NORAD_ID}/${latitude}/${longitude}/0/1/120`);
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json({ pass: null });
    }

    const data = (await response.json()) as N2yoVisualPassResponse;
    return NextResponse.json({ pass: findNextIssVisiblePass(data, now) });
  } catch {
    return NextResponse.json({ pass: null });
  }
}
