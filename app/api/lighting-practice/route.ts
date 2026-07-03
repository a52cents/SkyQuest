import { NextResponse } from "next/server";
import { getLightingPracticeEstimate } from "@/lib/lighting-practices-server";

type MunicipalityResponse = Array<{ code?: unknown; nom?: unknown }>;

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
      { estimate: null, error: "Coordonnées invalides." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL("https://geo.api.gouv.fr/communes");
  url.searchParams.set("lat", latitude.toFixed(2));
  url.searchParams.set("lon", longitude.toFixed(2));
  url.searchParams.set("fields", "nom,code");
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!response.ok) throw new Error("Municipality lookup unavailable");
    const data = (await response.json()) as MunicipalityResponse;
    const municipality = data[0];
    if (typeof municipality?.code !== "string" || typeof municipality.nom !== "string") {
      return NextResponse.json(
        { estimate: null },
        { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
      );
    }

    return NextResponse.json(
      { estimate: getLightingPracticeEstimate(municipality.code, municipality.nom) },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { estimate: null },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  }
}
