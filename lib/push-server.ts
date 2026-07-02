import webPush from "web-push";
import {
  deletePushSubscription,
  markPushNotificationSent,
  type StoredPushSubscription,
} from "@/lib/push-store";

export type SkyQuestPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

let configuredVapidSignature = "";

function configureVapid(): void {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error("Configuration VAPID manquante");
  }

  const signature = `${subject}:${publicKey}:${privateKey}`;
  if (configuredVapidSignature === signature) return;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  configuredVapidSignature = signature;
}

function toWebPushSubscription(subscription: StoredPushSubscription): webPush.PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

export function isExpiredPushError(error: unknown): boolean {
  const statusCode = getStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: SkyQuestPushPayload,
): Promise<void> {
  configureVapid();
  await webPush.sendNotification(
    toWebPushSubscription(subscription),
    JSON.stringify({
      ...payload,
      icon: payload.icon ?? "/icon-192.png",
      badge: payload.badge ?? "/icon-192.png",
      url: payload.url ?? "/",
    }),
    { TTL: 60 * 60, urgency: "normal" },
  );
}

export async function sendPushToMany(
  subscriptions: StoredPushSubscription[],
  payload: SkyQuestPushPayload,
): Promise<{ sent: number; failed: number; expired: number }> {
  const result = { sent: 0, failed: 0, expired: 0 };
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendPushNotification(subscription, payload);
      } catch (error) {
        if (isExpiredPushError(error)) {
          try {
            await deletePushSubscription(subscription.endpoint);
            result.expired += 1;
          } catch {
            result.failed += 1;
          }
        } else {
          result.failed += 1;
        }
        return;
      }

      try {
        await markPushNotificationSent(subscription.endpoint);
        result.sent += 1;
      } catch {
        // The push was delivered, but without persistence we cannot safely count it as successful.
        result.failed += 1;
      }
    }),
  );
  return result;
}
