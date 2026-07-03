import { NextResponse } from "next/server";
import { getNasaHighlights } from "@/lib/nasa";

export async function GET() {
  const highlights = await getNasaHighlights();

  return NextResponse.json(highlights, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
