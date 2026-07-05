import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const startedAt = Date.now();

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=47.6&longitude=2.4&current=cloud_cover,is_day,temperature_2m&timezone=auto";

    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      preview: text.slice(0, 300),
    });
  } catch (error) {
    const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;

    return NextResponse.json(
      {
        ok: false,
        durationMs: Date.now() - startedAt,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                cause:
                  cause instanceof Error
                    ? {
                        name: cause.name,
                        message: cause.message,
                        code: (cause as Error & { code?: string }).code,
                      }
                    : cause,
              }
            : String(error),
      },
      { status: 500 },
    );
  }
}
