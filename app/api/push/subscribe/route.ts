import { NextResponse } from "next/server";
import { NOTIFICATION_TOPICS, type NotificationTopic } from "@/lib/push-types";
import { upsertPushSubscription } from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeBody = {
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  topics?: unknown;
  timezone?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
};

const VALID_TOPICS = new Set<string>(NOTIFICATION_TOPICS);

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function roundApproximateCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return undefined;
  }
  return Math.round(value * 10) / 10;
}

export async function POST(request: Request) {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2_048 ||
    !isHttpsUrl(endpoint) ||
    typeof p256dh !== "string" ||
    p256dh.length < 16 ||
    p256dh.length > 512 ||
    typeof auth !== "string" ||
    auth.length < 8 ||
    auth.length > 256
  ) {
    return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  const topics = Array.isArray(body.topics)
    ? ([
        ...new Set(
          body.topics.filter(
            (topic): topic is NotificationTopic =>
              typeof topic === "string" && VALID_TOPICS.has(topic),
          ),
        ),
      ] as NotificationTopic[])
    : [];
  const timezone =
    typeof body.timezone === "string" && body.timezone.length <= 100 ? body.timezone : undefined;
  const latitudeRounded = roundApproximateCoordinate(body.location?.latitude, -90, 90);
  const longitudeRounded = roundApproximateCoordinate(body.location?.longitude, -180, 180);

  try {
    const stored = await upsertPushSubscription({
      endpoint,
      p256dh,
      auth,
      topics,
      timezone,
      latitudeRounded,
      longitudeRounded,
      enabled: true,
    });

    return NextResponse.json({
      ok: true,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
}
