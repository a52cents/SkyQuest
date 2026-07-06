import "server-only";

import { createHmac } from "node:crypto";

const LOCAL_RATE_LIMIT_SECRET = "skyquest-local-push-subscribe-rate-limit";

function firstHeaderValue(value: string | null): string | undefined {
  return value
    ?.split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

function getClientAddress(request: Request): string | undefined {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("x-vercel-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-real-ip"))
  );
}

function getRateLimitSecret(): string {
  return (
    process.env.PUSH_RATE_LIMIT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.VAPID_PRIVATE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    LOCAL_RATE_LIMIT_SECRET
  );
}

export function getPushSubscribeRateLimitKeyHash(request: Request): string {
  const clientAddress = getClientAddress(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) || "unknown";
  const rateLimitKey = clientAddress ? `ip:${clientAddress.toLowerCase()}` : `unknown:${userAgent}`;

  return createHmac("sha256", getRateLimitSecret())
    .update("skyquest:push-subscribe:v1")
    .update("\0")
    .update(rateLimitKey)
    .digest("hex");
}
