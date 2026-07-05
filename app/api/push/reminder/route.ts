import { NextResponse } from "next/server";
import { scheduleSkyWindowReminder } from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderBody = {
  endpoint?: unknown;
  reminderAt?: unknown;
  windowStartsAt?: unknown;
  windowEndsAt?: unknown;
  target?: unknown;
  score?: unknown;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function POST(request: Request) {
  let body: ReminderBody;
  try {
    body = (await request.json()) as ReminderBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const reminderAt = parseDate(body.reminderAt);
  const windowStartsAt = parseDate(body.windowStartsAt);
  const windowEndsAt = parseDate(body.windowEndsAt);
  const now = Date.now();
  const latestAllowed = now + 26 * 60 * 60 * 1_000;
  if (
    typeof body.endpoint !== "string" ||
    body.endpoint.length > 2_048 ||
    !reminderAt ||
    !windowStartsAt ||
    !windowEndsAt ||
    reminderAt.getTime() < now - 5 * 60 * 1_000 ||
    reminderAt.getTime() > latestAllowed ||
    windowEndsAt.getTime() > latestAllowed ||
    typeof body.score !== "number" ||
    !Number.isFinite(body.score) ||
    body.score < 0 ||
    body.score > 100 ||
    (body.target !== undefined && (typeof body.target !== "string" || body.target.length > 100))
  ) {
    return NextResponse.json({ error: "Rappel invalide." }, { status: 400 });
  }

  if (windowStartsAt.getTime() >= windowEndsAt.getTime()) {
    return NextResponse.json({ error: "Fenêtre d’observation incohérente." }, { status: 400 });
  }

  if (windowEndsAt.getTime() <= now) {
    return NextResponse.json(
      { error: "Cette fenêtre d’observation est terminée." },
      { status: 400 },
    );
  }

  if (reminderAt.getTime() > windowEndsAt.getTime()) {
    return NextResponse.json(
      { error: "Le rappel doit précéder la fin de la fenêtre d’observation." },
      { status: 400 },
    );
  }

  try {
    const scheduled = await scheduleSkyWindowReminder({
      endpoint: body.endpoint,
      reminderAt,
      windowStartsAt,
      windowEndsAt,
      target: typeof body.target === "string" ? body.target : undefined,
      score: body.score,
    });
    if (!scheduled) {
      return NextResponse.json({ error: "Abonnement push introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, reminderAt: reminderAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Rappel indisponible pour le moment." }, { status: 503 });
  }
}
