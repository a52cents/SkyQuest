import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { NOTIFICATION_TOPICS, type NotificationTopic } from "@/lib/push-types";

export type StoredPushSubscription = {
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

type PushSubscriptionRow = {
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
  >;

const SELECT_FIELDS =
  "endpoint,p256dh,auth,enabled,topics,timezone,latitude_rounded,longitude_rounded,last_seen_at,last_notification_sent_at,reminder_at,reminder_window_starts_at,reminder_window_ends_at,reminder_target,reminder_score,created_at,updated_at";
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

export async function scheduleSkyWindowReminder({
  endpoint,
  reminderAt,
  windowStartsAt,
  windowEndsAt,
  target,
  score,
}: {
  endpoint: string;
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
    .eq("endpoint", endpoint)
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

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        enabled: input.enabled ?? true,
        topics: normalizeTopics(input.topics),
        timezone: input.timezone?.trim() || null,
        latitude_rounded: hasLocation ? latitudeRounded : null,
        longitude_rounded: hasLocation ? longitudeRounded : null,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "endpoint" },
    )
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throwStoreError("upsert", error);
  return fromRow(data as PushSubscriptionRow);
}

export async function getPushSubscription(
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

export async function claimHourlyPushSlot(endpoint: string, now = new Date()): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_push_notification_slot", {
    p_endpoint: endpoint,
    p_now: now.toISOString(),
  });

  if (error) throwStoreError("claim hourly slot", error);
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
