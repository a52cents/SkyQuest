import { NextResponse } from "next/server";
import { getSkyObjects } from "@/lib/astro";
import { getUpcomingCelestialEvents } from "@/lib/celestial-events";
import { sendPushToMany, type SkyQuestPushPayload } from "@/lib/push-server";
import {
  claimHourlyPushSlot,
  listPushSubscriptions,
  isEligibleForHourlyPush,
  type StoredPushSubscription,
} from "@/lib/push-store";
import { fetchWeatherNow } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PLANET_NAMES: Record<string, string> = {
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function getLocalHour(date: Date, timezone?: string): number | null {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(date);
    return Number(hour);
  } catch {
    return null;
  }
}

async function createOpportunity(
  subscription: StoredPushSubscription,
  now: Date,
): Promise<SkyQuestPushPayload | null> {
  const latitude = subscription.latitudeRounded;
  const longitude = subscription.longitudeRounded;
  if (latitude === undefined || longitude === undefined) return null;

  const localHour = getLocalHour(now, subscription.timezone);
  const isNotificationWindow = localHour !== null && (localHour >= 19 || localHour < 4);
  if (!isNotificationWindow) return null;

  const rareEvent = subscription.topics.includes("celestial_event")
    ? getUpcomingCelestialEvents(now, 1)[0]
    : undefined;
  if (rareEvent) {
    return {
      title: `${rareEvent.title} approche`,
      body: "Ouvre SkyQuest pour vérifier l’horaire et les conditions près de chez toi.",
      url: "/#upcoming",
      tag: `celestial-event-${rareEvent.id}`,
      data: { type: "celestial_event" },
    };
  }

  const weather = await fetchWeatherNow(latitude, longitude);
  if (weather.isDay || weather.cloudCover > 65) return null;

  const skyObjects = getSkyObjects(latitude, longitude, now);
  const planet = skyObjects
    .filter((object) => object.name !== "Moon" && object.altitude >= 15)
    .sort((left, right) => right.altitude - left.altitude)[0];
  if (planet && subscription.topics.includes("planet_visible")) {
    return {
      title: `${PLANET_NAMES[planet.name] ?? planet.name} est tentable ce soir`,
      body: "Une mission simple est disponible. La visibilité reste à confirmer sur place.",
      url: "/",
      tag: `planet-visible-${planet.name.toLowerCase()}`,
      data: { type: "planet_visible", target: planet.name },
    };
  }

  const moon = skyObjects.find((object) => object.name === "Moon" && object.altitude >= 15);
  if (moon && subscription.topics.includes("moon_visible")) {
    return {
      title: "La Lune est bien placée ce soir",
      body: "Les conditions semblent favorables. Ouvre SkyQuest pour préparer ton observation.",
      url: "/",
      tag: "moon-visible",
      data: { type: "moon_visible" },
    };
  }

  if (weather.cloudCover <= 35 && subscription.topics.includes("clear_sky_evening")) {
    return {
      title: "Ciel plutôt clair prévu ce soir",
      body: "C’est peut-être un bon moment pour observer quelques astres brillants.",
      url: "/",
      tag: "clear-sky-evening",
      data: { type: "clear_sky_evening" },
    };
  }

  if (subscription.topics.includes("daily_mission")) {
    return {
      title: "Mission du soir disponible",
      body: "Ouvre SkyQuest et tente de trouver un astre visible maintenant.",
      url: "/",
      tag: "daily-mission",
      data: { type: "daily_mission" },
    };
  }
  return null;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const now = new Date();
  let eligible: StoredPushSubscription[];
  try {
    eligible = (await listPushSubscriptions()).filter((subscription) =>
      isEligibleForHourlyPush(subscription, now),
    );
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
  const totals = { checked: eligible.length, opportunities: 0, sent: 0, failed: 0, expired: 0 };

  for (const subscription of eligible) {
    try {
      const payload = await createOpportunity(subscription, now);
      if (!payload) continue;
      // This atomic database claim prevents overlapping cron runs from sending twice this hour.
      if (!(await claimHourlyPushSlot(subscription.endpoint, now))) continue;
      totals.opportunities += 1;
      const result = await sendPushToMany([subscription], payload);
      totals.sent += result.sent;
      totals.failed += result.failed;
      totals.expired += result.expired;
    } catch {
      totals.failed += 1;
    }
  }

  return NextResponse.json(totals);
}
