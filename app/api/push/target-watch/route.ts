import { NextResponse } from "next/server";
import {
  createTargetWatch,
  disableTargetWatch,
  getPushSubscription,
  listTargetWatches,
} from "@/lib/push-store";
import { TARGET_WATCH_REASONS, type TargetWatchReason } from "@/lib/push-types";
import { resolveWatchableTarget } from "@/lib/target-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WatchBody = {
  endpoint?: unknown;
  target?: unknown;
  reason?: unknown;
  watchId?: unknown;
  all?: unknown;
};

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!validEndpoint(endpoint)) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }
  try {
    return NextResponse.json({ watches: await listTargetWatches(endpoint) });
  } catch {
    return NextResponse.json({ error: "Rappels indisponibles." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: WatchBody;
  try {
    body = (await request.json()) as WatchBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (!validEndpoint(body.endpoint) || typeof body.target !== "string") {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }
  const target = resolveWatchableTarget(body.target);
  const reason = TARGET_WATCH_REASONS.includes(body.reason as TargetWatchReason)
    ? (body.reason as TargetWatchReason)
    : null;
  if (!target || !reason) {
    return NextResponse.json({ error: "Cible ou motif inconnu." }, { status: 400 });
  }
  try {
    const subscription = await getPushSubscription(body.endpoint);
    if (!subscription?.enabled) {
      return NextResponse.json({ error: "Alertes non activées." }, { status: 409 });
    }
    const watch = await createTargetWatch({
      endpoint: body.endpoint,
      target: target.target,
      targetType: target.targetType,
      reason,
    });
    return NextResponse.json({ watch }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error: message.includes("limit")
          ? "Trois cibles sont déjà surveillées."
          : "Rappel indisponible.",
      },
      { status: message.includes("limit") ? 409 : 503 },
    );
  }
}

export async function DELETE(request: Request) {
  let body: WatchBody;
  try {
    body = (await request.json()) as WatchBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (
    !validEndpoint(body.endpoint) ||
    (body.all !== true && (typeof body.watchId !== "string" || body.watchId.length > 100))
  ) {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }
  try {
    await disableTargetWatch(
      body.endpoint,
      body.all === true ? undefined : (body.watchId as string),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Annulation indisponible." }, { status: 503 });
  }
}
