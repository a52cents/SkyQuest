import { NextResponse } from "next/server";
import { getSkyObjects } from "@/lib/astro";
import { getUpcomingCelestialEvents } from "@/lib/celestial-events";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { sendPushToMany, type SkyQuestPushPayload } from "@/lib/push-server";
import {
  claimHourlyPushSlot,
  listPushSubscriptions,
  isEligibleForHourlyPush,
  type StoredPushSubscription,
} from "@/lib/push-store";
import { fetchWeatherForecast, fetchWeatherNow } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PLANET_NAMES: Record<string, string> = {
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

type CalculationName =
  "celestial_events" | "weather" | "forecast_requested" | "forecast_available" | "astronomy";

type NoOpportunityReason =
  | "missing_location"
  | "invalid_timezone"
  | "outside_notification_window"
  | "daylight"
  | "cloud_cover_too_high"
  | "no_enabled_topics"
  | "no_matching_opportunity";

type OpportunityDiagnostics = {
  calculations: CalculationName[];
  reason?: NoOpportunityReason;
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
  diagnostics: OpportunityDiagnostics,
): Promise<SkyQuestPushPayload | null> {
  const latitude = subscription.latitudeRounded;
  const longitude = subscription.longitudeRounded;
  if (latitude === undefined || longitude === undefined) {
    diagnostics.reason = "missing_location";
    return null;
  }

  const localHour = getLocalHour(now, subscription.timezone);
  if (localHour === null) {
    diagnostics.reason = "invalid_timezone";
    return null;
  }
  const isNotificationWindow = localHour !== null && (localHour >= 19 || localHour < 4);
  if (!isNotificationWindow) {
    diagnostics.reason = "outside_notification_window";
    return null;
  }

  diagnostics.calculations.push("celestial_events");
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

  diagnostics.calculations.push("weather");
  if (subscription.topics.includes("clear_sky_evening")) {
    diagnostics.calculations.push("forecast_requested");
  }
  const [weather, forecast] = await Promise.all([
    fetchWeatherNow(latitude, longitude),
    subscription.topics.includes("clear_sky_evening")
      ? fetchWeatherForecast(latitude, longitude, 24).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (forecast) {
    diagnostics.calculations.push("forecast_available");
    const skyWindow = calculateBestSkyWindow({ latitude, longitude, forecast, now });
    const minutesUntilWindow = Math.round(
      (new Date(skyWindow.startsAt).getTime() - now.getTime()) / 60_000,
    );
    if (skyWindow.score >= 60 && minutesUntilWindow >= 15 && minutesUntilWindow <= 75) {
      const targetText = skyWindow.bestTargets.length
        ? ` À tenter : ${skyWindow.bestTargets.join(", ")}.`
        : "";
      return {
        title: `Ciel plus favorable dans ${minutesUntilWindow} min`,
        body: `Le meilleur créneau approche (indice ${skyWindow.score}/100).${targetText}`,
        url: "/tonight",
        tag: `best-sky-window-${skyWindow.startsAt.slice(0, 13)}`,
        data: { type: "clear_sky_evening" },
      };
    }
  }

  if (weather.isDay) {
    diagnostics.reason = "daylight";
    return null;
  }
  if (weather.cloudCover > 65) {
    diagnostics.reason = "cloud_cover_too_high";
    return null;
  }

  diagnostics.calculations.push("astronomy");
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
  diagnostics.reason =
    subscription.topics.length === 0 ? "no_enabled_topics" : "no_matching_opportunity";
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
  const totals = {
    checked: eligible.length,
    opportunities: 0,
    sent: 0,
    failed: 0,
    expired: 0,
    calculations: {} as Partial<Record<CalculationName, number>>,
    reasons: {} as Record<string, number>,
  };

  const increment = (counters: Record<string, number>, name: string, amount = 1) => {
    counters[name] = (counters[name] ?? 0) + amount;
  };

  for (const subscription of eligible) {
    const diagnostics: OpportunityDiagnostics = { calculations: [] };
    let calculationsRecorded = false;
    let phase: "evaluation" | "hourly_claim" | "delivery" = "evaluation";
    const recordCalculations = () => {
      if (calculationsRecorded) return;
      for (const calculation of diagnostics.calculations) {
        increment(totals.calculations, calculation);
      }
      calculationsRecorded = true;
    };
    try {
      const payload = await createOpportunity(subscription, now, diagnostics);
      recordCalculations();
      if (!payload) {
        increment(totals.reasons, diagnostics.reason ?? "unknown");
        continue;
      }
      // This atomic database claim prevents overlapping cron runs from sending twice this hour.
      phase = "hourly_claim";
      if (!(await claimHourlyPushSlot(subscription.endpoint, now))) {
        increment(totals.reasons, "hourly_slot_already_claimed");
        continue;
      }
      totals.opportunities += 1;
      phase = "delivery";
      const result = await sendPushToMany([subscription], payload);
      totals.sent += result.sent;
      totals.failed += result.failed;
      totals.expired += result.expired;
      if (result.failed > 0) increment(totals.reasons, "delivery_failed", result.failed);
      if (result.expired > 0) increment(totals.reasons, "subscription_expired", result.expired);
    } catch {
      recordCalculations();
      totals.failed += 1;
      increment(totals.reasons, `${phase}_error`);
    }
  }

  return NextResponse.json(totals);
}
