import { NextResponse } from "next/server";
import { getSkyObjects } from "@/lib/astro";
import { getUpcomingCelestialEvents } from "@/lib/celestial-events";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { sendPushToMany, type SkyQuestPushPayload } from "@/lib/push-server";
import {
  claimHourlyPushSlot,
  listPushSubscriptions,
  type StoredPushSubscription,
} from "@/lib/push-store";
import {
  isExceptionalClearSky,
  isInterestingApproachingSkyWindow,
  isInterestingBrightTarget,
} from "@/lib/push-opportunity";
import { fetchWeatherForecast, fetchWeatherNow } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_ROUTE_VERSION = "sky-alerts-hybrid-weather-v6";

const PLANET_NAMES: Record<string, string> = {
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

type CalculationName =
  | "celestial_events"
  | "weather"
  | "forecast_requested"
  | "forecast_available"
  | "astronomy";

type NoOpportunityReason =
  | "missing_location"
  | "invalid_timezone"
  | "outside_notification_window"
  | "daylight"
  | "cloud_cover_too_high"
  | "weather_unavailable"
  | "no_enabled_topics"
  | "no_matching_opportunity";

type OpportunityDiagnostics = {
  calculations: CalculationName[];
  reason?: NoOpportunityReason;
};
function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const cause = (error as Error & { cause?: unknown }).cause;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause:
      cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            stack: cause.stack,
            code: (cause as Error & { code?: string }).code,
          }
        : cause,
  };
}
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

  const isNotificationWindow = localHour >= 19 || localHour < 4;

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

  const wantsClearSkyForecast = subscription.topics.includes("clear_sky_evening");

  if (wantsClearSkyForecast) {
    diagnostics.calculations.push("forecast_requested");
  }

  const [weatherNow, forecast] = await Promise.all([
    fetchWeatherNow(latitude, longitude).catch((error) => {
      console.error("[sky-alerts] weather_now_failed", {
  latitude,
  longitude,
  timezone: subscription.timezone,
  error: serializeError(error),
});

      return null;
    }),

    wantsClearSkyForecast
      ? fetchWeatherForecast(latitude, longitude, 24).catch((error) => {
          console.error("[sky-alerts] forecast_failed", {
            latitude,
            longitude,
            timezone: subscription.timezone,
              error: serializeError(error),

          });

          return null;
        })
      : Promise.resolve(null),
  ]);

  if (forecast?.hours?.length) {
    diagnostics.calculations.push("forecast_available");
  }

  const forecastCurrentHour = forecast?.hours?.[0];

  const weather =
    weatherNow ??
    (forecastCurrentHour
      ? {
          cloudCover: forecastCurrentHour.cloudCover,
          isDay: localHour >= 7 && localHour < 20,
          temperature: forecastCurrentHour.temperature,
        }
      : null);

  if (!weather) {
    diagnostics.reason = "weather_unavailable";
    return null;
  }

  if (forecast?.hours?.length) {
    const skyWindow = calculateBestSkyWindow({
      latitude,
      longitude,
      forecast,
      now,
    });

    const minutesUntilWindow = Math.round(
      (new Date(skyWindow.startsAt).getTime() - now.getTime()) / 60_000,
    );

    if (
      isInterestingApproachingSkyWindow({
        score: skyWindow.score,
        minutesUntilWindow,
      })
    ) {
      const targetText = skyWindow.bestTargets.length
        ? ` À tenter : ${skyWindow.bestTargets.join(", ")}.`
        : "";

      return {
        title:
          minutesUntilWindow <= 5
            ? "Très bon ciel maintenant"
            : `Très bon ciel dans ${minutesUntilWindow} min`,
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
    .filter(
      (object) =>
        object.name !== "Moon" &&
        isInterestingBrightTarget({
          cloudCover: weather.cloudCover,
          altitude: object.altitude,
        }),
    )
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

  const moon = skyObjects.find(
    (object) =>
      object.name === "Moon" &&
      isInterestingBrightTarget({
        cloudCover: weather.cloudCover,
        altitude: object.altitude,
      }),
  );

  if (moon && subscription.topics.includes("moon_visible")) {
    return {
      title: "La Lune est bien placée ce soir",
      body: "Les conditions semblent favorables. Ouvre SkyQuest pour préparer ton observation.",
      url: "/",
      tag: "moon-visible",
      data: { type: "moon_visible" },
    };
  }

  if (
    isExceptionalClearSky(weather.cloudCover) &&
    subscription.topics.includes("clear_sky_evening")
  ) {
    return {
      title: "Ciel exceptionnellement clair maintenant",
      body: "Très peu de nuages sont estimés. C’est un bon moment pour vérifier le ciel.",
      url: "/",
      tag: "clear-sky-evening",
      data: { type: "clear_sky_evening" },
    };
  }

  if (weather.cloudCover <= 25 && subscription.topics.includes("daily_mission")) {
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

  let subscriptions: StoredPushSubscription[];

  try {
    subscriptions = await listPushSubscriptions();
  } catch (error) {
    console.error("[sky-alerts] push_storage_unavailable", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              message: String(error),
            },
    });

    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }

  const totals = {
    version: CRON_ROUTE_VERSION,
    checked: subscriptions.length,
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

  const incrementCalculation = (name: CalculationName) => {
    totals.calculations[name] = (totals.calculations[name] ?? 0) + 1;
  };

  for (const subscription of subscriptions) {
    const diagnostics: OpportunityDiagnostics = { calculations: [] };
    let calculationsRecorded = false;
    let phase: "evaluation" | "hourly_claim" | "delivery" = "evaluation";

    const recordCalculations = () => {
      if (calculationsRecorded) return;

      for (const calculation of diagnostics.calculations) {
        incrementCalculation(calculation);
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

      if (result.failed > 0) {
        increment(totals.reasons, "delivery_failed", result.failed);
      }

      if (result.expired > 0) {
        increment(totals.reasons, "subscription_expired", result.expired);
      }
    } catch (error) {
      recordCalculations();

      totals.failed += 1;
      increment(totals.reasons, `${phase}_error`);

      console.error("[sky-alerts] subscription_failed", {
        phase,
        reason: diagnostics.reason,
        calculations: diagnostics.calculations,
        timezone: subscription.timezone,
        latitude: subscription.latitudeRounded,
        longitude: subscription.longitudeRounded,
        topics: subscription.topics,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : {
                message: String(error),
              },
      });
    }
  }

  return NextResponse.json(totals);
}