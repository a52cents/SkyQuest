"use client";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TOPICS,
  type NotificationPreferences,
  type NotificationTopic,
  type TargetWatch,
  type TargetWatchReason,
} from "@/lib/push-types";
import { registerSkyQuestServiceWorker } from "@/lib/service-worker-client";

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TOPICS,
  type NotificationPreferences,
  type NotificationTopic,
  type TargetWatch,
  type TargetWatchReason,
} from "@/lib/push-types";

export type PushSubscriptionOptions = {
  preferences?: NotificationPreferences;
  timezone?: string;
  location?: { latitude: number; longitude: number } | null;
};

export type SkyWindowReminderInput = {
  reminderAt: string;
  windowStartsAt: string;
  windowEndsAt: string;
  target?: string;
  score: number;
  location?: PushSubscriptionOptions["location"];
};

const PREFERENCES_STORAGE_KEY = "skyquest.notification-preferences.v1";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isTargetWatchSupported(): boolean {
  return (
    isPushSupported() &&
    !(isIosDevice() && !isStandaloneDisplay()) &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim())
  );
}

export async function watchTarget({
  target,
  reason,
  location,
}: {
  target: string;
  reason: TargetWatchReason;
  location?: PushSubscriptionOptions["location"];
}): Promise<{ ok: boolean; error?: string }> {
  let subscription = await getExistingPushSubscription();
  if (!subscription) subscription = await subscribeToPush({ location });
  else if (location) await saveSubscriptionOnServer(subscription, { location });
  if (!subscription) return { ok: false, error: "Active d’abord les alertes sur cet appareil." };
  try {
    const response = await fetch("/api/push/target-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, target, reason }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: response.ok, error: payload.error };
  } catch {
    return { ok: false, error: "Connexion indisponible." };
  }
}

export async function getTargetWatches(): Promise<TargetWatch[]> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return [];
  try {
    const response = await fetch(
      `/api/push/target-watch?endpoint=${encodeURIComponent(subscription.endpoint)}`,
    );
    const payload = (await response.json()) as { watches?: TargetWatch[] };
    return response.ok && Array.isArray(payload.watches) ? payload.watches : [];
  } catch {
    return [];
  }
}

export async function cancelTargetWatch(watchId?: string): Promise<boolean> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return true;
  try {
    const response = await fetch("/api/push/target-watch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, watchId, all: !watchId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const safariNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    safariNavigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return (
      (await navigator.serviceWorker.getRegistration("/")) ??
      (await registerSkyQuestServiceWorker())
    );
  } catch {
    return null;
  }
}

function getTopics(preferences: NotificationPreferences): NotificationTopic[] {
  return NOTIFICATION_TOPICS.filter((topic) => preferences[topic]);
}

async function saveSubscriptionOnServer(
  subscription: PushSubscription,
  options: PushSubscriptionOptions = {},
): Promise<boolean> {
  const preferences = options.preferences ?? getNotificationPreferences();
  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        topics: getTopics(preferences),
        timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: options.location ?? undefined,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(
  options: PushSubscriptionOptions = {},
): Promise<PushSubscription | null> {
  if (!isPushSupported() || (isIosDevice() && !isStandaloneDisplay())) return null;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) return null;

  const permission =
    Notification.permission === "default"
      ? await requestNotificationPermission()
      : Notification.permission;
  if (permission !== "granted") return null;

  const registration = await getPushRegistration();
  if (!registration) return null;

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    if (!(await saveSubscriptionOnServer(subscription, options))) {
      if (!existing) await subscription.unsubscribe().catch(() => false);
      return null;
    }
    return subscription;
  } catch {
    return null;
  }
}

export async function scheduleSkyWindowReminder(input: SkyWindowReminderInput): Promise<boolean> {
  let subscription = await getExistingPushSubscription();
  if (!subscription) {
    subscription = await subscribeToPush({
      preferences: getNotificationPreferences(),
      location: input.location,
    });
  } else if (input.location) {
    await saveSubscriptionOnServer(subscription, { location: input.location });
  }
  if (!subscription) return false;

  try {
    const response = await fetch("/api/push/reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        reminderAt: input.reminderAt,
        windowStartsAt: input.windowStartsAt,
        windowEndsAt: input.windowEndsAt,
        target: input.target,
        score: input.score,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncPushPreferences(
  preferences: NotificationPreferences,
  location?: PushSubscriptionOptions["location"],
): Promise<boolean> {
  saveNotificationPreferences(preferences);
  const subscription = await getExistingPushSubscription();
  if (!subscription) return false;
  return saveSubscriptionOnServer(subscription, { preferences, location });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  let unsubscribed = false;
  try {
    unsubscribed = await subscription.unsubscribe();
  } catch {
    return false;
  }

  try {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // The provider will return 404/410 later, allowing the server to remove the stale endpoint.
  }
  return unsubscribed;
}

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "null",
    ) as Partial<NotificationPreferences> | null;
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(stored ?? {}),
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export function saveNotificationPreferences(preferences: NotificationPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain valid for the current UI session when storage is unavailable.
  }
}
