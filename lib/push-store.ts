import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  NOTIFICATION_TOPICS,
  type NotificationTopic,
  type TargetWatch,
  type TargetWatchReason,
} from "@/lib/push-types";

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  enabled: boolean;
  timezone?: string;
  latitudeRounded?: number;
  longitudeRounded?: number;
  topics: NotificationTopic[];
  lastNotificationSentAt?: string;
  reminderAt?: string;
  reminderWindowStartsAt?: string;
  reminderWindowEndsAt?: string;
  reminderTarget?: string;
  reminderScore?: number;
};

export type PushOpportunityClaimResult = "claimed" | "cooldown" | "duplicate" | "disabled";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  topics: unknown;
  timezone: string | null;
  latitude_rounded: number | string | null;
  longitude_rounded: number | string | null;
  last_seen_at: string;
  last_notification_sent_at: string | null;
  reminder_at: string | null;
  reminder_window_starts_at: string | null;
  reminder_window_ends_at: string | null;
  reminder_target: string | null;
  reminder_score: number | string | null;
  created_at: string;
  updated_at: string;
};

type UpsertPushSubscriptionInput = Pick<
  StoredPushSubscription,
  "endpoint" | "p256dh" | "auth" | "topics"
> &
  Partial<
    Pick<StoredPushSubscription, "timezone" | "latitudeRounded" | "longitudeRounded" | "enabled">
  > & { managementTokenHash: string };

const SELECT_FIELDS =
  "id,endpoint,p256dh,auth,enabled,topics,timezone,latitude_rounded,longitude_rounded,last_seen_at,last_notification_sent_at,reminder_at,reminder_window_starts_at,reminder_window_ends_at,reminder_target,reminder_score,created_at,updated_at";
const ACTIVE_SUBSCRIPTIONS_PAGE_SIZE = 1_000;
const VALID_TOPICS = new Set<string>(NOTIFICATION_TOPICS);

function throwStoreError(operation: string, cause: unknown): never {
  throw new Error(`Push subscription store failed during ${operation}`, { cause });
}

function normalizeCoordinate(value: number | undefined, min: number, max: number): number | null {
  if (value === undefined || !Number.isFinite(value) || value < min || value > max) return null;
  return Math.round(value * 10) / 10;
}

function parseCoordinate(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTopics(value: unknown): NotificationTopic[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter(
    (topic): topic is NotificationTopic => typeof topic === "string" && VALID_TOPICS.has(topic),
  );
}

function fromRow(row: PushSubscriptionRow): StoredPushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    enabled: row.enabled,
    topics: normalizeTopics(row.topics),
    timezone: row.timezone ?? undefined,
    latitudeRounded: parseCoordinate(row.latitude_rounded),
    longitudeRounded: parseCoordinate(row.longitude_rounded),
    lastSeenAt: row.last_seen_at,
    lastNotificationSentAt: row.last_notification_sent_at ?? undefined,
    reminderAt: row.reminder_at ?? undefined,
    reminderWindowStartsAt: row.reminder_window_starts_at ?? undefined,
    reminderWindowEndsAt: row.reminder_window_ends_at ?? undefined,
    reminderTarget: row.reminder_target ?? undefined,
    reminderScore: parseCoordinate(row.reminder_score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type TargetWatchRow = {
  id: string;
  subscription_id: string;
  target: string;
  target_type: string;
  reason: TargetWatchReason;
  minimum_score: number;
  expires_at: string;
  created_at: string;
};

function watchFromRow(row: TargetWatchRow): TargetWatch {
  return {
    id: row.id,
    target: row.target,
    targetType: row.target_type,
    reason: row.reason,
    minimumScore: Number(row.minimum_score),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function createTargetWatch({
  managementTokenHash,
  target,
  targetType,
  reason,
  minimumScore = 60,
  now = new Date(),
}: {
  managementTokenHash: string;
  target: string;
  targetType: string;
  reason: TargetWatchReason;
  minimumScore?: number;
  now?: Date;
}): Promise<TargetWatch> {
  const supabase = createSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id,latitude_rounded,longitude_rounded")
    .eq("management_token_hash", managementTokenHash)
    .eq("enabled", true)
    .maybeSingle();
  if (subscriptionError || !subscription)
    throwStoreError("find target watch subscription", subscriptionError);
  if (subscription.latitude_rounded === null || subscription.longitude_rounded === null) {
    throw new Error("Target watch requires an approximate location");
  }
  const existing = (await listTargetWatches(managementTokenHash, now)).find(
    (watch) => watch.target.toLocaleLowerCase("fr-FR") === target.toLocaleLowerCase("fr-FR"),
  );
  if (existing) return existing;

  const { data, error } = await supabase.rpc("create_target_watch", {
    p_management_token_hash: managementTokenHash,
    p_target: target,
    p_target_type: targetType,
    p_reason: reason,
    p_minimum_score: Math.max(50, Math.min(100, Math.round(minimumScore))),
    p_now: now.toISOString(),
  });
  if (error || !data) {
    if (String(error?.message).includes("target_watch_limit")) {
      throw new Error("Target watch limit reached");
    }
    throwStoreError("create target watch", error);
  }
  const row = (Array.isArray(data) ? data[0] : data) as TargetWatchRow | undefined;
  if (!row) throwStoreError("create target watch result", data);
  return watchFromRow(row);
}

export async function listTargetWatches(
  managementTokenHash: string,
  now = new Date(),
): Promise<TargetWatch[]> {
  const supabase = createSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("management_token_hash", managementTokenHash)
    .maybeSingle();
  if (subscriptionError) throwStoreError("find target watch subscription", subscriptionError);
  if (!subscription) return [];
  const { data, error } = await supabase
    .from("push_target_watches")
    .select("id,subscription_id,target,target_type,reason,minimum_score,expires_at,created_at")
    .eq("subscription_id", subscription.id)
    .eq("enabled", true)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false });
  if (error) throwStoreError("list target watches", error);
  return (data ?? []).map((row) => watchFromRow(row as TargetWatchRow));
}

export async function disableTargetWatch(
  managementTokenHash: string,
  watchId?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("management_token_hash", managementTokenHash)
    .maybeSingle();
  if (subscriptionError) throwStoreError("find target watch subscription", subscriptionError);
  if (!subscription) return;
  let query = supabase
    .from("push_target_watches")
    .update({ enabled: false })
    .eq("subscription_id", subscription.id)
    .eq("enabled", true);
  if (watchId) query = query.eq("id", watchId);
  const { error } = await query;
  if (error) throwStoreError("disable target watch", error);
}

export type ActiveTargetWatch = TargetWatch & { subscription: StoredPushSubscription };

export async function listActiveTargetWatches(now = new Date()): Promise<ActiveTargetWatch[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_target_watches")
    .select(
      "id,subscription_id,target,target_type,reason,minimum_score,expires_at,created_at,push_subscriptions!inner(id,endpoint,p256dh,auth,enabled,topics,timezone,latitude_rounded,longitude_rounded,last_seen_at,last_notification_sent_at,reminder_at,reminder_window_starts_at,reminder_window_ends_at,reminder_target,reminder_score,created_at,updated_at)",
    )
    .eq("enabled", true)
    .gt("expires_at", now.toISOString())
    .eq("push_subscriptions.enabled", true);
  if (error) throwStoreError("list active target watches", error);
  return (data ?? []).flatMap((raw) => {
    const row = raw as unknown as TargetWatchRow & {
      push_subscriptions: PushSubscriptionRow | PushSubscriptionRow[];
    };
    const subscription = Array.isArray(row.push_subscriptions)
      ? row.push_subscriptions[0]
      : row.push_subscriptions;
    return subscription ? [{ ...watchFromRow(row), subscription: fromRow(subscription) }] : [];
  });
}

export async function claimTargetWatch(watchId: string, now = new Date()): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_target_watch", {
    p_watch_id: watchId,
    p_now: now.toISOString(),
  });
  if (error) throwStoreError("claim target watch", error);
  return data === true;
}

export async function cleanupExpiredTargetWatches(now = new Date()): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cleanup_expired_target_watches", {
    p_now: now.toISOString(),
  });
  if (error) throwStoreError("cleanup target watches", error);
  return Number(data) || 0;
}

export async function scheduleSkyWindowReminder({
  managementTokenHash,
  reminderAt,
  windowStartsAt,
  windowEndsAt,
  target,
  score,
}: {
  managementTokenHash: string;
  reminderAt: Date;
  windowStartsAt: Date;
  windowEndsAt: Date;
  target?: string;
  score: number;
}): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .update({
      reminder_at: reminderAt.toISOString(),
      reminder_window_starts_at: windowStartsAt.toISOString(),
      reminder_window_ends_at: windowEndsAt.toISOString(),
      reminder_target: target?.slice(0, 100) || null,
      reminder_score: Math.max(0, Math.min(100, Math.round(score))),
      updated_at: now,
    })
    .eq("management_token_hash", managementTokenHash)
    .eq("enabled", true)
    .select("endpoint")
    .maybeSingle();

  if (error) throwStoreError("schedule reminder", error);
  return Boolean(data);
}

export async function upsertPushSubscription(
  input: UpsertPushSubscriptionInput,
): Promise<StoredPushSubscription> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const latitudeRounded = normalizeCoordinate(input.latitudeRounded, -90, 90);
  const longitudeRounded = normalizeCoordinate(input.longitudeRounded, -180, 180);
  const hasLocation = latitudeRounded !== null && longitudeRounded !== null;

  const { data, error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_management_token_hash: input.managementTokenHash,
    p_enabled: input.enabled ?? true,
    p_topics: normalizeTopics(input.topics),
    p_timezone: input.timezone?.trim() || null,
    p_latitude_rounded: hasLocation ? latitudeRounded : null,
    p_longitude_rounded: hasLocation ? longitudeRounded : null,
    p_now: now,
  });

  const row = (Array.isArray(data) ? data[0] : data) as PushSubscriptionRow | undefined;
  if (error || !row) throwStoreError("authorized upsert", error);
  return fromRow(row);
}

export async function getPushSubscriptionByEndpoint(
  endpoint: string,
): Promise<StoredPushSubscription | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select(SELECT_FIELDS)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error) throwStoreError("read", error);
  return data ? fromRow(data as PushSubscriptionRow) : undefined;
}

export async function getPushSubscriptionByManagementTokenHash(
  managementTokenHash: string,
): Promise<StoredPushSubscription | undefined> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select(SELECT_FIELDS)
    .eq("management_token_hash", managementTokenHash)
    .maybeSingle();

  if (error) throwStoreError("read by management token", error);
  return data ? fromRow(data as PushSubscriptionRow) : undefined;
}

export async function getActiveSubscriptions(): Promise<StoredPushSubscription[]> {
  const supabase = createSupabaseAdminClient();
  const subscriptions: StoredPushSubscription[] = [];

  for (let offset = 0; ; offset += ACTIVE_SUBSCRIPTIONS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select(SELECT_FIELDS)
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + ACTIVE_SUBSCRIPTIONS_PAGE_SIZE - 1);

    if (error) throwStoreError("list active", error);
    subscriptions.push(...(data ?? []).map((row) => fromRow(row as PushSubscriptionRow)));
    if (!data || data.length < ACTIVE_SUBSCRIPTIONS_PAGE_SIZE) break;
  }

  return subscriptions;
}

export async function listPushSubscriptions(): Promise<StoredPushSubscription[]> {
  return getActiveSubscriptions();
}

export async function disablePushSubscription(endpoint: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);

  if (error) throwStoreError("disable", error);
  return true;
}

export async function disablePushSubscriptionByManagementTokenHash(
  managementTokenHash: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("management_token_hash", managementTokenHash)
    .select("id")
    .maybeSingle();

  if (error) throwStoreError("disable by management token", error);
  return Boolean(data);
}

// Kept for compatibility with the existing routes and push sender. Rows are retained but disabled.
export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  return disablePushSubscription(endpoint);
}

export async function markPushNotificationSent(
  endpoint: string,
  sentAt = new Date(),
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const timestamp = sentAt.toISOString();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ last_notification_sent_at: timestamp, updated_at: timestamp })
    .eq("endpoint", endpoint)
    .eq("enabled", true);

  if (error) throwStoreError("mark sent", error);
}

export async function claimPushOpportunity({
  endpoint,
  dedupeKey,
  now = new Date(),
}: {
  endpoint: string;
  dedupeKey: string;
  now?: Date;
}): Promise<PushOpportunityClaimResult> {
  if (!dedupeKey || dedupeKey.length > 200) {
    throw new Error("Invalid push opportunity dedupe key");
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_push_notification_slot", {
    p_endpoint: endpoint,
    p_dedupe_key: dedupeKey,
    p_now: now.toISOString(),
  });

  if (error) throwStoreError("claim push opportunity", error);
  if (data === "claimed" || data === "cooldown" || data === "duplicate" || data === "disabled") {
    return data;
  }
  throwStoreError("claim push opportunity result", data);
}

export async function claimTestPushSlot(endpoint: string, now = new Date()): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_push_test_slot", {
    p_endpoint: endpoint,
    p_now: now.toISOString(),
  });

  if (error) throwStoreError("claim test push slot", error);
  return data === true;
}

export async function claimDueSkyWindowReminder(
  endpoint: string,
  now = new Date(),
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_due_sky_window_reminder", {
    p_endpoint: endpoint,
    p_now: now.toISOString(),
  });

  if (error) throwStoreError("claim reminder", error);
  return data === true;
}

export async function cleanupExpiredSkyWindowReminders(now = new Date()): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cleanup_expired_sky_window_reminders", {
    p_now: now.toISOString(),
  });

  if (error) throwStoreError("cleanup expired reminders", error);
  const cleaned = typeof data === "number" ? data : Number(data);
  return Number.isFinite(cleaned) ? cleaned : 0;
}
