import { NextResponse } from "next/server";
import { fetchConfiguredLightPollutionEstimate } from "@/lib/light-pollution-provider";

function readCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return Math.round(parsed * 100) / 100;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = readCoordinate(searchParams.get("lat"), -90, 90);
  const longitude = readCoordinate(searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "Coordonnées invalides." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const estimate = await fetchConfiguredLightPollutionEstimate({ latitude, longitude });
  return NextResponse.json(estimate, {
    headers: {
      "Cache-Control":
        estimate.source === "fallback"
          ? "public, max-age=3600, s-maxage=86400"
          : "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
    },
  });
}
