import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getPushLocalNightKey,
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
const notificationSettingsSource = readFileSync(
  new URL("../components/NotificationSettings.tsx", import.meta.url),
  "utf8",
);
const cronRouteSource = readFileSync(
  new URL("../app/api/cron/sky-alerts/route.ts", import.meta.url),
  "utf8",
);
const pushServerSource = readFileSync(new URL("../lib/push-server.ts", import.meta.url), "utf8");
const workerSource = readFileSync(
  new URL("../workers/sky-alerts-cron/src/index.js", import.meta.url),
  "utf8",
);
const workerConfigSource = readFileSync(
  new URL("../workers/sky-alerts-cron/wrangler.toml", import.meta.url),
  "utf8",
);
const editorialClaimSql = migrationSource.slice(
  migrationSource.indexOf("create or replace function public.claim_push_notification_slot"),
  migrationSource.indexOf("create or replace function public.claim_push_test_slot"),
);
const reminderClaimSql = migrationSource.slice(
  migrationSource.indexOf("create or replace function public.claim_due_sky_window_reminder"),
  migrationSource.indexOf("create or replace function public.mark_sky_window_reminder_sent"),
);
const reminderSentSql = migrationSource.slice(
  migrationSource.indexOf("create or replace function public.mark_sky_window_reminder_sent"),
  migrationSource.indexOf("create or replace function public.cleanup_expired_sky_window_reminders"),
);

test("push persistence is server-only and no longer uses process memory", () => {
  assert.match(storeSource, /import "server-only"/);
  assert.match(storeSource, /createSupabaseAdminClient/);
  assert.doesNotMatch(storeSource, /new Map|globalThis|__skyQuestPushSubscriptions/);
  assert.match(supabaseSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(supabaseSource, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("Supabase migration enforces an atomic 12-hour editorial claim", () => {
  assert.match(migrationSource, /endpoint text not null unique/i);
  assert.match(migrationSource, /create table if not exists public\.push_notification_claims/i);
  assert.match(migrationSource, /primary key \(subscription_id, dedupe_key\)/i);
  assert.match(migrationSource, /char_length\(dedupe_key\) between 1 and 200/i);
  assert.match(migrationSource, /enable row level security/i);
  assert.match(
    migrationSource,
    /drop function if exists public\.claim_push_notification_slot\(text, timestamptz\)/i,
  );
  assert.match(
    migrationSource,
    /claim_push_notification_slot\([\s\S]+p_dedupe_key text[\s\S]+returns text/i,
  );
  assert.match(migrationSource, /for update/i);
  assert.match(migrationSource, /p_now - interval '12 hours'/i);
  assert.match(migrationSource, /return 'claimed'/i);
  assert.match(migrationSource, /return 'cooldown'/i);
  assert.match(migrationSource, /return 'duplicate'/i);
  assert.match(migrationSource, /return 'disabled'/i);
  assert.match(migrationSource, /revoke all[\s\S]+anon, authenticated/i);
});

test("editorial claim ordering accepts the first key and rejects cooldowns before duplicates", () => {
  const cooldownCheck = editorialClaimSql.indexOf("return 'cooldown'");
  const duplicateCheck = editorialClaimSql.indexOf("return 'duplicate'");
  const claimInsert = editorialClaimSql.indexOf("insert into public.push_notification_claims");
  const acceptedResult = editorialClaimSql.indexOf("return 'claimed'");

  assert.ok(cooldownCheck > 0);
  assert.ok(duplicateCheck > cooldownCheck);
  assert.ok(claimInsert > duplicateCheck);
  assert.ok(acceptedResult > claimInsert);
  assert.match(editorialClaimSql, /> p_now - interval '12 hours'/i);
  assert.doesNotMatch(editorialClaimSql, />= p_now - interval '12 hours'/i);
});

test("the subscription lock and composite primary key allow only one concurrent claim", () => {
  assert.match(editorialClaimSql, /where endpoint = p_endpoint[\s\S]+for update/i);
  assert.match(migrationSource, /primary key \(subscription_id, dedupe_key\)/i);
});

test("the claims migration is replay-safe and restricted to the service role", () => {
  assert.match(migrationSource, /create table if not exists public\.push_notification_claims/i);
  assert.match(
    migrationSource,
    /create index if not exists push_notification_claims_claimed_at_idx/i,
  );
  assert.match(
    migrationSource,
    /alter table public\.push_notification_claims enable row level security/i,
  );
  assert.match(
    migrationSource,
    /revoke all on table public\.push_notification_claims from public, anon, authenticated/i,
  );
  assert.match(
    migrationSource,
    /grant select, insert, update, delete on table public\.push_notification_claims to service_role/i,
  );
});

test("coordinates are normalized to one decimal in the server store", () => {
  assert.match(storeSource, /Math\.round\(value \* 10\) \/ 10/);
  assert.match(storeSource, /latitude_rounded: hasLocation \? latitudeRounded : null/);
  assert.match(storeSource, /longitude_rounded: hasLocation \? longitudeRounded : null/);
});

test("test pushes use a separate one-hour limit without consuming editorial cooldown", () => {
  assert.match(testRouteSource, /await claimTestPushSlot\(subscription\.endpoint\)/);
  assert.match(testRouteSource, /status: 429/);
  assert.match(testRouteSource, /markEditorialSent: false/);
  assert.match(migrationSource, /last_test_notification_sent_at <= p_now - interval '1 hour'/i);
});

test("scheduled opportunities are restricted to 19:00 through 03:59 local time", () => {
  assert.match(cronRouteSource, /localHour >= 19 \|\| localHour < 4/);
  assert.match(cronRouteSource, /diagnostics\.reason = "outside_notification_window"/);
});

test("the UI states the editorial cadence and the independent reminder exception", () => {
  assert.match(notificationSettingsSource, /De 19 h à 3 h · 12 h minimum entre deux alertes/);
  assert.match(notificationSettingsSource, /rappels « Me prévenir »[\s\S]+indépendamment/);
});

test("scheduled alerts reserve editorial opportunities before delivery", () => {
  assert.match(cronRouteSource, /subscriptions = await listPushSubscriptions\(\)/);
  assert.match(cronRouteSource, /await claimPushOpportunity\(\{/);
  assert.match(cronRouteSource, /dedupeKey: opportunity\.dedupeKey/);
  assert.match(cronRouteSource, /claimResult !== "claimed"/);
});

test("scheduled alerts share rounded-area calculations with bounded concurrency", () => {
  assert.match(cronRouteSource, /const CRON_WORKER_CONCURRENCY = 8/);
  assert.match(cronRouteSource, /function buildAreaWorkGroups/);
  assert.match(cronRouteSource, /function createAreaContext/);
  assert.match(cronRouteSource, /weather: fetchWeatherNow\(group\.latitude, group\.longitude\)/);
  assert.match(cronRouteSource, /forecast: group\.needsForecast/);
  assert.match(cronRouteSource, /skyObjects \?\?= getSkyObjects\(group\.latitude/);
  assert.match(cronRouteSource, /targetWatchScores: new Map\(\)/);
  assert.match(cronRouteSource, /roundedAreas: areaGroups\.size/);
  assert.match(cronRouteSource, /await runWithBoundedConcurrency\(targetWatches/);
  assert.match(cronRouteSource, /await runWithBoundedConcurrency\(subscriptions/);
});

test("scheduled push logs explain skipped notifications and executed calculations", () => {
  assert.match(cronRouteSource, /calculations: \{\} as Partial<Record<CalculationName, number>>/);
  assert.match(cronRouteSource, /reasons: \{\} as Record<string, number>/);
  assert.match(cronRouteSource, /diagnostics\.reason = "missing_location"/);
  assert.match(cronRouteSource, /diagnostics\.reason = "daylight"/);
  assert.match(cronRouteSource, /diagnostics\.reason = "cloud_cover_too_high"/);
  assert.match(cronRouteSource, /increment\(totals\.reasons, claimResult\)/);
  assert.match(cronRouteSource, /"reminder_already_claimed"/);
  assert.match(cronRouteSource, /"reminder_confirm_failed"/);
  assert.match(cronRouteSource, /"delivery_failed"/);
  assert.match(cronRouteSource, /"subscription_expired"/);
});

test("scheduled alerts use stable opportunity keys", () => {
  assert.match(cronRouteSource, /`celestial_event:\$\{rareEvent\.id\}`/);
  assert.match(cronRouteSource, /`sky_window:\$\{skyWindow\.startsAt\}`/);
  assert.match(cronRouteSource, /`planet_visible:\$\{planet\.name\}:\$\{localNight\}`/);
  assert.match(cronRouteSource, /`moon_visible:\$\{localNight\}`/);
  assert.match(cronRouteSource, /`clear_sky:\$\{localNight\}`/);
  assert.match(cronRouteSource, /`daily_mission:\$\{localNight\}`/);
  assert.match(cronRouteSource, /`reminder:\$\{reminderWindowStartsAt\}`/);
  assert.match(cronRouteSource, /url: "\/tonight#upcoming-sky-events-title"/);
});

test("local night keys keep after-midnight alerts on the preceding observing night", () => {
  assert.equal(
    getPushLocalNightKey(new Date("2026-07-06T21:00:00Z"), "Europe/Paris"),
    "2026-07-06",
  );
  assert.equal(
    getPushLocalNightKey(new Date("2026-07-07T01:00:00Z"), "Europe/Paris"),
    "2026-07-06",
  );
  assert.equal(
    getPushLocalNightKey(new Date("2026-07-07T19:00:00Z"), "Europe/Paris"),
    "2026-07-07",
  );
  assert.equal(getPushLocalNightKey(new Date("2026-07-07T19:00:00Z"), "Invalid/Timezone"), null);
});

test("scheduled clear-sky alerts only announce an imminent strong window", () => {
  assert.match(cronRouteSource, /fetchWeatherForecast/);
  assert.match(cronRouteSource, /isInterestingApproachingSkyWindow/);
  assert.match(cronRouteSource, /analysisUrl\("approaching_sky_window"/);
});

test("intentional sky-window reminders move pending to sent and retry stale claims", () => {
  assert.match(migrationSource, /claim_due_sky_window_reminder/i);
  assert.match(migrationSource, /mark_sky_window_reminder_sent/i);
  assert.match(migrationSource, /reminder_delivery_status/i);
  assert.match(migrationSource, /on conflict do nothing/i);
  assert.match(migrationSource, /reminder_window_ends_at >= p_now/i);
  assert.match(migrationSource, /reminder_delivery_status = 'pending'/i);
  assert.match(migrationSource, /reminder_delivery_status = 'sent'/i);
  assert.match(migrationSource, /p_now - interval '10 minutes'/i);
  assert.match(migrationSource, /cleanup_expired_sky_window_reminders/i);
  assert.match(migrationSource, /reminder_window_ends_at < p_now/i);
  assert.match(migrationSource, /reminder_at is not null and reminder_window_ends_at is null/i);
  assert.match(storeSource, /reminder_window_starts_at/);
  assert.match(storeSource, /markSkyWindowReminderSent/);
  assert.match(cronRouteSource, /type: "sky_window_reminder"/);
  assert.match(cronRouteSource, /analysisUrl\("sky_window_reminder"/);
  assert.match(cronRouteSource, /opportunity\.intentionalReminder/);
  assert.match(cronRouteSource, /markSkyWindowReminderSent\(\{/);
  assert.match(cronRouteSource, /markEditorialSent: false/);
  assert.doesNotMatch(reminderClaimSql, /interval '12 hours'/i);
  assert.doesNotMatch(reminderClaimSql, /reminder_at = null/i);
  assert.match(reminderSentSql, /last_notification_sent_at = p_now/i);
  assert.ok(
    cronRouteSource.indexOf(
      "expiredRemindersCleaned = await cleanupExpiredSkyWindowReminders(now)",
    ) < cronRouteSource.indexOf("subscriptions = await listPushSubscriptions()"),
  );
  assert.ok(
    cronRouteSource.indexOf("const reminderAt = subscription.reminderAt") <
      cronRouteSource.indexOf('diagnostics.reason = "missing_location"'),
  );
});

test("expired subscriptions are disabled after push delivery reports 404 or 410", () => {
  assert.match(pushServerSource, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(pushServerSource, /deletePushSubscription\(subscription\.endpoint\)/);
  assert.match(
    storeSource,
    /deletePushSubscription[\s\S]+return disablePushSubscription\(endpoint\)/,
  );
});

test("Cloudflare invokes the authenticated cron every five minutes", () => {
  assert.match(workerConfigSource, /crons = \["\*\/5 \* \* \* \*"\]/);
  assert.match(workerSource, /\/api\/cron\/sky-alerts/);
  assert.match(workerSource, /Authorization: `Bearer \$\{env\.CRON_SECRET\}`/);
  assert.match(workerSource, /context\.waitUntil/);
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
