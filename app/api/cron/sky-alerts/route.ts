import { NextResponse } from "next/server";
import { equatorialJ2000ToHorizontal, getSkyObjects, getSunAltitude } from "@/lib/astro";
import { getUpcomingCelestialEvents } from "@/lib/celestial-events";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { sendPushToMany, type SkyQuestPushPayload } from "@/lib/push-server";
import {
  claimDueSkyWindowReminder,
  claimPushOpportunity,
  cleanupExpiredSkyWindowReminders,
  cleanupExpiredTargetWatches,
  claimTargetWatch,
  listActiveTargetWatches,
  listPushSubscriptions,
  type StoredPushSubscription,
} from "@/lib/push-store";
import { getCatalogSkyObject } from "@/lib/sky-catalog";
import {
  calculateCatalogVisibilityScore,
  calculateMeteorShowerVisibilityScore,
  calculateVisibilityScore,
} from "@/lib/visibility";
import { fetchIssOrbitalElements } from "@/lib/celestrak";
import { calculateNextSatelliteVisiblePass } from "@/lib/satellite-pass";
import { isMeteorShowerActive, isNearMeteorShowerPeak, meteorShowers } from "@/lib/meteor-showers";
import { getWatchableTargetLabel } from "@/lib/target-watch";
import {
  isExceptionalClearSky,
  getPushLocalNightKey,
  isInterestingApproachingSkyWindow,
  isInterestingBrightTarget,
} from "@/lib/push-opportunity";
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

type PushOpportunity = {
  payload: SkyQuestPushPayload;
  dedupeKey: string;
  intentionalReminder: boolean;
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

function analysisUrl(intent: string, target?: string): string {
  const params = new URLSearchParams({ app: "1", intent });
  if (target) params.set("target", target);
  return `/?${params.toString()}`;
}

async function getTargetWatchScore(
  target: string,
  latitude: number,
  longitude: number,
  now: Date,
): Promise<number> {
  const [weather, sunAltitude] = await Promise.all([
    fetchWeatherNow(latitude, longitude),
    Promise.resolve(getSunAltitude(latitude, longitude, now)),
  ]);
  if (sunAltitude > -3) return 0;
  if (target.toLocaleLowerCase("fr-FR") === "iss") {
    const orbitalElements = await fetchIssOrbitalElements();
    const pass = calculateNextSatelliteVisiblePass({
      orbitalElements,
      latitude,
      longitude,
      now,
      horizonMinutes: 30,
    });
    if (!pass || new Date(pass.startTime).getTime() - now.getTime() > 20 * 60_000) return 0;
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(65 + Math.min(15, (pass.maxElevation - 15) / 2) - weather.cloudCover / 2),
      ),
    );
  }
  const normalizedTarget = target.toLocaleLowerCase("fr-FR");
  const shower = meteorShowers.find(
    (candidate) =>
      normalizedTarget === `meteor-${candidate.name.toLocaleLowerCase("fr-FR")}` ||
      normalizedTarget === `meteor-${candidate.id}`,
  );
  if (shower) {
    if (!isMeteorShowerActive(shower, now)) return 0;
    return calculateMeteorShowerVisibilityScore({
      weather,
      sunAltitude,
      nearPeak: isNearMeteorShowerPeak(shower, now),
    });
  }
  const skyObject = getSkyObjects(latitude, longitude, now).find(
    (object) => object.name.toLocaleLowerCase("fr-FR") === target.toLocaleLowerCase("fr-FR"),
  );
  if (skyObject) return calculateVisibilityScore({ object: skyObject, weather, sunAltitude });

  const catalogObject = getCatalogSkyObject(target);
  if (
    !catalogObject ||
    catalogObject.rightAscensionHours === undefined ||
    catalogObject.declinationDegrees === undefined
  ) {
    return 0;
  }
  const position = equatorialJ2000ToHorizontal({
    rightAscensionHours: catalogObject.rightAscensionHours,
    declinationDegrees: catalogObject.declinationDegrees,
    latitude,
    longitude,
    date: now,
  });
  return calculateCatalogVisibilityScore({
    object: catalogObject,
    altitude: position.altitude,
    weather,
    sunAltitude,
    now,
  });
}

async function createOpportunity(
  subscription: StoredPushSubscription,
  now: Date,
  diagnostics: OpportunityDiagnostics,
): Promise<PushOpportunity | null> {
  const reminderAt = subscription.reminderAt
    ? new Date(subscription.reminderAt).getTime()
    : Number.NaN;
  const reminderEndsAt = subscription.reminderWindowEndsAt
    ? new Date(subscription.reminderWindowEndsAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (reminderAt <= now.getTime() && reminderEndsAt >= now.getTime()) {
    const targetText = subscription.reminderTarget
      ? ` Commence par ${subscription.reminderTarget}.`
      : "";
    const reminderWindowStartsAt =
      subscription.reminderWindowStartsAt ?? subscription.reminderAt ?? "unknown";
    return {
      dedupeKey: `reminder:${reminderWindowStartsAt}`,
      intentionalReminder: true,
      payload: {
        title: "Ton meilleur créneau commence",
        body: `Les conditions peuvent avoir changé : ouvre SkyQuest pour les recalculer.${targetText}`,
        url: analysisUrl("sky_window_reminder", subscription.reminderTarget),
        tag: `sky-window-reminder-${reminderWindowStartsAt}`,
        data: {
          type: "sky_window_reminder",
          target: subscription.reminderTarget,
          score: subscription.reminderScore,
        },
      },
    };
  }

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
  const localNight = getPushLocalNightKey(now, subscription.timezone ?? "UTC");
  if (!localNight) {
    diagnostics.reason = "invalid_timezone";
    return null;
  }

  diagnostics.calculations.push("celestial_events");
  const rareEvent = subscription.topics.includes("celestial_event")
    ? getUpcomingCelestialEvents(now, 1)[0]
    : undefined;
  if (rareEvent) {
    return {
      dedupeKey: `celestial_event:${rareEvent.id}`,
      intentionalReminder: false,
      payload: {
        title: `${rareEvent.title} approche`,
        body: "Ouvre SkyQuest pour vérifier l’horaire et les conditions près de chez toi.",
        url: "/tonight#upcoming-sky-events-title",
        tag: `celestial-event-${rareEvent.id}`,
        data: { type: "celestial_event", eventId: rareEvent.id },
      },
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
    if (isInterestingApproachingSkyWindow({ score: skyWindow.score, minutesUntilWindow })) {
      const targetText = skyWindow.bestTargets.length
        ? ` À tenter : ${skyWindow.bestTargets.join(", ")}.`
        : "";
      return {
        dedupeKey: `sky_window:${skyWindow.startsAt}`,
        intentionalReminder: false,
        payload: {
          title:
            minutesUntilWindow <= 5
              ? "Très bon ciel maintenant"
              : `Très bon ciel dans ${minutesUntilWindow} min`,
          body: `Le meilleur créneau approche (indice ${skyWindow.score}/100).${targetText}`,
          url: analysisUrl("approaching_sky_window", skyWindow.bestTargets[0]),
          tag: `best-sky-window-${skyWindow.startsAt}`,
          data: { type: "clear_sky_evening" },
        },
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
      dedupeKey: `planet_visible:${planet.name}:${localNight}`,
      intentionalReminder: false,
      payload: {
        title: `${PLANET_NAMES[planet.name] ?? planet.name} est tentable ce soir`,
        body: "Une mission simple est disponible. La visibilité reste à confirmer sur place.",
        url: analysisUrl("planet_visible", planet.name),
        tag: `planet-visible-${planet.name.toLowerCase()}-${localNight}`,
        data: { type: "planet_visible", target: planet.name },
      },
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
      dedupeKey: `moon_visible:${localNight}`,
      intentionalReminder: false,
      payload: {
        title: "La Lune est bien placée ce soir",
        body: "Les conditions semblent favorables. Ouvre SkyQuest pour préparer ton observation.",
        url: analysisUrl("moon_visible", "Moon"),
        tag: `moon-visible-${localNight}`,
        data: { type: "moon_visible" },
      },
    };
  }

  if (
    isExceptionalClearSky(weather.cloudCover) &&
    subscription.topics.includes("clear_sky_evening")
  ) {
    const brightTarget = skyObjects
      .filter((object) => object.altitude >= 10)
      .sort((left, right) => right.altitude - left.altitude)[0];
    const targetName = brightTarget
      ? (PLANET_NAMES[brightTarget.name] ??
        (brightTarget.name === "Moon" ? "la Lune" : brightTarget.name))
      : undefined;
    return {
      dedupeKey: `clear_sky:${localNight}`,
      intentionalReminder: false,
      payload: {
        title: targetName
          ? `Ciel très clair : ${targetName} à tenter`
          : "Le ciel est très clair maintenant",
        body: targetName
          ? `${Math.round(weather.cloudCover)} % de nuages estimés. Ouvre SkyQuest pour confirmer la mission.`
          : `${Math.round(weather.cloudCover)} % de nuages estimés. Relance l’analyse avant de sortir.`,
        url: analysisUrl("clear_sky_evening", brightTarget?.name),
        tag: `clear-sky-evening-${localNight}`,
        data: { type: "clear_sky_evening", target: brightTarget?.name },
      },
    };
  }

  if (weather.cloudCover <= 25 && subscription.topics.includes("daily_mission")) {
    return {
      dedupeKey: `daily_mission:${localNight}`,
      intentionalReminder: false,
      payload: {
        title: "Mission du soir disponible",
        body: "Ouvre SkyQuest et tente de trouver un astre visible maintenant.",
        url: analysisUrl("daily_mission"),
        tag: `daily-mission-${localNight}`,
        data: { type: "daily_mission" },
      },
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
  let expiredRemindersCleaned = 0;
  let expiredTargetWatchesCleaned = 0;
  let targetWatches = [] as Awaited<ReturnType<typeof listActiveTargetWatches>>;
  try {
    expiredRemindersCleaned = await cleanupExpiredSkyWindowReminders(now);
    expiredTargetWatchesCleaned = await cleanupExpiredTargetWatches(now);
    targetWatches = await listActiveTargetWatches(now);
    subscriptions = await listPushSubscriptions();
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
  const totals = {
    checked: subscriptions.length,
    opportunities: 0,
    sent: 0,
    failed: 0,
    expired: 0,
    expiredRemindersCleaned,
    expiredTargetWatchesCleaned,
    targetWatchesChecked: targetWatches.length,
    targetWatchesSent: 0,
    calculations: {} as Partial<Record<CalculationName, number>>,
    reasons: {} as Record<string, number>,
  };

  const increment = (counters: Record<string, number>, name: string, amount = 1) => {
    counters[name] = (counters[name] ?? 0) + amount;
  };

  const targetWatchSentEndpoints = new Set<string>();
  for (const watch of targetWatches) {
    const { subscription } = watch;
    const latitude = subscription.latitudeRounded;
    const longitude = subscription.longitudeRounded;
    const localHour = getLocalHour(now, subscription.timezone);
    if (
      latitude === undefined ||
      longitude === undefined ||
      localHour === null ||
      (localHour < 19 && localHour >= 4)
    ) {
      continue;
    }
    try {
      const score = await getTargetWatchScore(watch.target, latitude, longitude, now);
      if (score < watch.minimumScore || !(await claimTargetWatch(watch.id, now))) continue;
      const targetLabel = getWatchableTargetLabel(watch.target);
      const result = await sendPushToMany([subscription], {
        title: `Une meilleure occasion pour ${targetLabel}`,
        body: "Les conditions semblent plus favorables. Ouvre SkyQuest pour les recalculer avant de sortir.",
        url: analysisUrl("target_watch", watch.target),
        tag: `target-watch-${watch.id}`,
        data: { type: "target_watch", target: watch.target, score },
      });
      totals.sent += result.sent;
      totals.failed += result.failed;
      totals.expired += result.expired;
      if (result.sent > 0) {
        totals.targetWatchesSent += 1;
        targetWatchSentEndpoints.add(subscription.endpoint);
      }
    } catch {
      totals.failed += 1;
      increment(totals.reasons, "target_watch_error");
    }
  }

  for (const subscription of subscriptions) {
    if (targetWatchSentEndpoints.has(subscription.endpoint)) continue;
    const diagnostics: OpportunityDiagnostics = { calculations: [] };
    let calculationsRecorded = false;
    let phase: "evaluation" | "opportunity_claim" | "reminder_claim" | "delivery" = "evaluation";
    const recordCalculations = () => {
      if (calculationsRecorded) return;
      for (const calculation of diagnostics.calculations) {
        increment(totals.calculations, calculation);
      }
      calculationsRecorded = true;
    };
    try {
      const opportunity = await createOpportunity(subscription, now, diagnostics);
      recordCalculations();
      if (!opportunity) {
        increment(totals.reasons, diagnostics.reason ?? "unknown");
        continue;
      }
      if (opportunity.intentionalReminder) {
        phase = "reminder_claim";
        if (!(await claimDueSkyWindowReminder(subscription.endpoint, now))) {
          increment(totals.reasons, "reminder_already_claimed");
          continue;
        }
      } else {
        phase = "opportunity_claim";
        const claimResult = await claimPushOpportunity({
          endpoint: subscription.endpoint,
          dedupeKey: opportunity.dedupeKey,
          now,
        });
        if (claimResult !== "claimed") {
          increment(totals.reasons, claimResult);
          continue;
        }
      }
      totals.opportunities += 1;
      phase = "delivery";
      const result = await sendPushToMany([subscription], opportunity.payload);
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
