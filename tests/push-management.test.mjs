import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TRUSTED_WEB_PUSH_ENDPOINT_HOSTS,
  isTrustedWebPushEndpoint,
} from "../lib/push-endpoint.ts";
import { isValidPushManagementToken } from "../lib/push-management.ts";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const client = source("../lib/push-client.ts");
const server = source("../lib/push-management-server.ts");
const store = source("../lib/push-store.ts");
const sql = source("../docs/supabase-push-subscriptions.sql");
const subscribeRoute = source("../app/api/push/subscribe/route.ts");
const targetWatchRoute = source("../app/api/push/target-watch/route.ts");
const unsubscribeRoute = source("../app/api/push/unsubscribe/route.ts");
const reminderRoute = source("../app/api/push/reminder/route.ts");

test("management tokens use a bounded base64url format with 256 bits of randomness", () => {
  assert.equal(isValidPushManagementToken("a".repeat(43)), true);
  assert.equal(isValidPushManagementToken("a".repeat(42)), false);
  assert.equal(isValidPushManagementToken(`${"a".repeat(42)}+`), false);
  assert.match(client, /new Uint8Array\(32\)/);
  assert.match(client, /crypto\.getRandomValues/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
});

test("only the SHA-256 management token hash is persisted server-side", () => {
  assert.match(server, /createHash\("sha256"\)/);
  assert.match(sql, /management_token_hash text/);
  assert.match(sql, /management_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /push_subscriptions_management_token_hash_idx/);
  assert.doesNotMatch(sql, /\bmanagement_token\s+text\b/);
  assert.match(store, /p_management_token_hash: input\.managementTokenHash/);
});

test("an endpoint cannot authorize browser management routes or leak through target-watch URLs", () => {
  assert.doesNotMatch(targetWatchRoute, /searchParams|body\.endpoint/);
  assert.doesNotMatch(unsubscribeRoute, /endpoint/);
  assert.doesNotMatch(reminderRoute, /body\.endpoint/);
  assert.doesNotMatch(
    client,
    /target-watch\?endpoint|encodeURIComponent\(subscription\.endpoint\)/,
  );
  assert.match(targetWatchRoute, /getPushManagementTokenHash\(request\)/);
  assert.match(unsubscribeRoute, /getPushManagementTokenHash\(request\)/);
  assert.match(reminderRoute, /getPushManagementTokenHash\(request\)/);
});

test("existing subscriptions require token equality or their previously stored Web Push keys", () => {
  const upsertFunction = sql.slice(
    sql.indexOf("create or replace function public.upsert_push_subscription"),
    sql.indexOf("revoke all on function public.upsert_push_subscription"),
  );
  assert.match(upsertFunction, /management_token_hash = p_management_token_hash/);
  assert.match(upsertFunction, /v_p256dh is distinct from p_p256dh/);
  assert.match(upsertFunction, /v_auth is distinct from p_auth/);
  assert.match(upsertFunction, /push_subscription_management_forbidden/);
  assert.match(sql, /where management_token_hash = p_management_token_hash[\s\S]+for update/);
});

test("subscribe only accepts known Web Push provider endpoints", () => {
  const providers = DEFAULT_TRUSTED_WEB_PUSH_ENDPOINT_HOSTS;

  assert.equal(
    isTrustedWebPushEndpoint("https://fcm.googleapis.com/fcm/send/example", providers),
    true,
  );
  assert.equal(
    isTrustedWebPushEndpoint(
      "https://updates.push.services.mozilla.com/wpush/v2/example",
      providers,
    ),
    true,
  );
  assert.equal(isTrustedWebPushEndpoint("https://web.push.apple.com/example", providers), true);
  assert.equal(
    isTrustedWebPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=example", providers),
    true,
  );
  assert.equal(isTrustedWebPushEndpoint("https://example.com/push", providers), false);
  assert.equal(isTrustedWebPushEndpoint("https://127.0.0.1/push", providers), false);
  assert.equal(
    isTrustedWebPushEndpoint("http://fcm.googleapis.com/fcm/send/example", providers),
    false,
  );
  assert.match(subscribeRoute, /isTrustedWebPushEndpoint\(endpoint\)/);
});

test("new push subscriptions are rate-limited before insertion", () => {
  const upsertFunction = sql.slice(
    sql.indexOf("create or replace function public.upsert_push_subscription"),
    sql.indexOf("revoke all on function public.upsert_push_subscription"),
  );
  const newSubscriptionBranch = upsertFunction.slice(
    upsertFunction.indexOf("else"),
    upsertFunction.indexOf("insert into public.push_subscriptions"),
  );

  assert.match(sql, /create table if not exists public\.push_subscription_rate_limits/);
  assert.match(sql, /p_rate_limit_key_hash text/);
  assert.match(newSubscriptionBranch, /push_subscription_rate_limits/);
  assert.match(newSubscriptionBranch, /attempts < 20/);
  assert.match(newSubscriptionBranch, /push_subscription_rate_limit/);
  assert.match(store, /p_rate_limit_key_hash: input\.rateLimitKeyHash/);
  assert.match(subscribeRoute, /getPushSubscribeRateLimitKeyHash\(request\)/);
  assert.match(subscribeRoute, /status: 429/);
});
