import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveWatchableTarget } from "../lib/target-watch.ts";

const sql = readFileSync(
  new URL("../docs/supabase-push-subscriptions.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../app/api/push/target-watch/route.ts", import.meta.url),
  "utf8",
);
const cron = readFileSync(new URL("../app/api/cron/sky-alerts/route.ts", import.meta.url), "utf8");

test("only known atlas targets can be watched", () => {
  assert.deepEqual(resolveWatchableTarget("jupiter"), { target: "Jupiter", targetType: "planet" });
  assert.equal(resolveWatchableTarget("private-journal-target"), null);
  assert.equal(resolveWatchableTarget("FreeObservation"), null);
});

test("target watches are private, bounded, expiring, and atomically one-shot", () => {
  assert.match(sql, /expires_at[\s\S]+interval '14 days'/);
  assert.match(sql, /count\(\*\)[\s\S]+>= 3/);
  assert.match(sql, /create or replace function public\.claim_target_watch/);
  assert.match(sql, /create or replace function public\.mark_target_watch_sent/);
  assert.match(sql, /delivery_status = 'pending'/);
  assert.match(sql, /delivery_status = 'sent'/);
  assert.match(sql, /p_now - interval '10 minutes'/);
  assert.match(
    sql,
    /revoke all on table public\.push_target_watches from public, anon, authenticated/,
  );
});

test("watch API transmits one explicit target and cron requires a fresh score", () => {
  assert.doesNotMatch(route, /discoveredTargets|rewardHistory|journal/i);
  assert.match(route, /resolveWatchableTarget/);
  assert.match(cron, /score < watch\.minimumScore/);
  assert.match(cron, /analysisUrl\("target_watch", watch\.target\)/);
  assert.match(cron, /claimTargetWatch\(watch\.id, now\)/);
  assert.match(cron, /markTargetWatchSent\(watch\.id, now\)/);
});
