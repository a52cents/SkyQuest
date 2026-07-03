import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isExceptionalClearSky,
  isInterestingApproachingSkyWindow,
  isInterestingBrightTarget,
} from "../lib/push-opportunity.ts";

const storeSource = readFileSync(new URL("../lib/push-store.ts", import.meta.url), "utf8");
const supabaseSource = readFileSync(new URL("../lib/supabase-server.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../docs/supabase-push-subscriptions.sql", import.meta.url),
  "utf8",
);
const testRouteSource = readFileSync(
  new URL("../app/api/push/test/route.ts", import.meta.url),
  "utf8",
);
const cronRouteSource = readFileSync(
  new URL("../app/api/cron/sky-alerts/route.ts", import.meta.url),
  "utf8",
);

test("push persistence is server-only and no longer uses process memory", () => {
  assert.match(storeSource, /import "server-only"/);
  assert.match(storeSource, /createSupabaseAdminClient/);
  assert.doesNotMatch(storeSource, /new Map|globalThis|__skyQuestPushSubscriptions/);
  assert.match(supabaseSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(supabaseSource, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("Supabase migration enforces unique endpoints, RLS, and an atomic hourly claim", () => {
  assert.match(migrationSource, /endpoint text not null unique/i);
  assert.match(migrationSource, /enable row level security/i);
  assert.match(migrationSource, /claim_push_notification_slot/i);
  assert.match(migrationSource, /date_trunc\('hour', p_now\)/i);
  assert.match(migrationSource, /revoke all[\s\S]+anon, authenticated/i);
});

test("coordinates are normalized to one decimal in the server store", () => {
  assert.match(storeSource, /Math\.round\(value \* 10\) \/ 10/);
  assert.match(storeSource, /latitude_rounded: hasLocation \? latitudeRounded : null/);
  assert.match(storeSource, /longitude_rounded: hasLocation \? longitudeRounded : null/);
});

test("test pushes use the same atomic hourly limit as scheduled pushes", () => {
  assert.match(testRouteSource, /await claimHourlyPushSlot\(subscription\.endpoint\)/);
  assert.match(testRouteSource, /status: 429/);
});

test("scheduled opportunities are restricted to 19:00 through 03:59 local time", () => {
  assert.match(cronRouteSource, /localHour >= 19 \|\| localHour < 4/);
  assert.match(cronRouteSource, /diagnostics\.reason = "outside_notification_window"/);
});

test("scheduled alerts evaluate every active subscription without a cooldown", () => {
  assert.match(cronRouteSource, /subscriptions = await listPushSubscriptions\(\)/);
  assert.doesNotMatch(cronRouteSource, /lastNotificationSentAt|cooldown/i);
});

test("scheduled push logs explain skipped notifications and executed calculations", () => {
  assert.match(cronRouteSource, /calculations: \{\} as Partial<Record<CalculationName, number>>/);
  assert.match(cronRouteSource, /reasons: \{\} as Record<string, number>/);
  assert.match(cronRouteSource, /diagnostics\.reason = "missing_location"/);
  assert.match(cronRouteSource, /diagnostics\.reason = "daylight"/);
  assert.match(cronRouteSource, /diagnostics\.reason = "cloud_cover_too_high"/);
  assert.match(cronRouteSource, /"hourly_slot_already_claimed"/);
});

test("scheduled clear-sky alerts only announce an imminent strong window", () => {
  assert.match(cronRouteSource, /fetchWeatherForecast/);
  assert.match(cronRouteSource, /isInterestingApproachingSkyWindow/);
  assert.match(cronRouteSource, /url: "\/tonight"/);
});

test("a sky window 59 minutes away is not worth a notification", () => {
  assert.equal(isInterestingApproachingSkyWindow({ score: 90, minutesUntilWindow: 59 }), false);
  assert.equal(isInterestingApproachingSkyWindow({ score: 74, minutesUntilWindow: 5 }), false);
  assert.equal(isInterestingApproachingSkyWindow({ score: 80, minutesUntilWindow: 10 }), true);
});

test("generic and bright-target alerts require unusually good current conditions", () => {
  assert.equal(isExceptionalClearSky(15), true);
  assert.equal(isExceptionalClearSky(16), false);
  assert.equal(isInterestingBrightTarget({ cloudCover: 25, altitude: 25 }), true);
  assert.equal(isInterestingBrightTarget({ cloudCover: 30, altitude: 45 }), false);
});
