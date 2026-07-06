import { NextResponse } from "next/server";
import { sendPushToMany } from "@/lib/push-server";
import {
  claimTestPushSlot,
  getPushSubscriptionByEndpoint,
  getPushSubscriptionByManagementTokenHash,
} from "@/lib/push-store";
import { getPushManagementTokenHash } from "@/lib/push-management-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.PUSH_TEST_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  let endpoint: unknown = undefined;
  try {
    endpoint = ((await request.json()) as { endpoint?: unknown }).endpoint;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  let subscription;
  try {
    const managementTokenHash = getPushManagementTokenHash(request);
    if (isAuthorized(request) && typeof endpoint === "string") {
      subscription = await getPushSubscriptionByEndpoint(endpoint);
    } else if (managementTokenHash) {
      subscription = await getPushSubscriptionByManagementTokenHash(managementTokenHash);
    } else {
      return NextResponse.json({ error: "Jeton de gestion requis." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
  if (!subscription?.enabled) {
    return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
  }

  try {
    if (!(await claimTestPushSlot(subscription.endpoint))) {
      return NextResponse.json(
        { error: "Une notification a déjà été envoyée à cet abonnement pendant cette heure." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }

  const result = await sendPushToMany(
    [subscription],
    {
      title: "SkyQuest est prêt ✨",
      body: "Les alertes du ciel sont bien activées sur cet appareil.",
      url: "/",
      tag: "skyquest-test",
      data: { type: "test" },
    },
    { markEditorialSent: false },
  );

  if (result.sent !== 1) {
    return NextResponse.json(
      { error: result.expired ? "Abonnement expiré." : "Envoi impossible.", ...result },
      { status: result.expired ? 410 : 502 },
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
