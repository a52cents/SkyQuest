import { NextResponse } from "next/server";
import { sendPushToMany } from "@/lib/push-server";
import { claimHourlyPushSlot, getPushSubscription } from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.PUSH_TEST_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Endpoint de test désactivé." }, { status: 403 });
  }

  let endpoint: unknown;
  try {
    endpoint = ((await request.json()) as { endpoint?: unknown }).endpoint;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Endpoint requis." }, { status: 400 });
  }

  let subscription;
  try {
    subscription = await getPushSubscription(endpoint);
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
  if (!subscription?.enabled) {
    return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
  }

  try {
    if (!(await claimHourlyPushSlot(subscription.endpoint))) {
      return NextResponse.json(
        { error: "Une notification a déjà été envoyée à cet abonnement pendant cette heure." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }

  const result = await sendPushToMany([subscription], {
    title: "SkyQuest est prêt ✨",
    body: "Les alertes du ciel sont bien activées sur cet appareil.",
    url: "/",
    tag: "skyquest-test",
    data: { type: "test" },
  });

  if (result.sent !== 1) {
    return NextResponse.json(
      { error: result.expired ? "Abonnement expiré." : "Envoi impossible.", ...result },
      { status: result.expired ? 410 : 502 },
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
