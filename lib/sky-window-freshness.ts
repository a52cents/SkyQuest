import type { BestSkyWindow } from "@/lib/types";

export const BEST_SKY_WINDOW_TTL_MS = 3 * 60 * 60 * 1_000;
export const ESTIMATED_BEST_SKY_WINDOW_TTL_MS = 60 * 60 * 1_000;
export const BEST_SKY_WINDOW_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1_000;

export type BestSkyWindowValidityReason =
  "valid" | "invalid_date" | "invalid_range" | "expired" | "stale" | "future_generation";

export type BestSkyWindowValidity = {
  valid: boolean;
  reason: BestSkyWindowValidityReason;
};

export function getBestSkyWindowValidity(
  window: BestSkyWindow,
  now = new Date(),
): BestSkyWindowValidity {
  const nowMs = now.getTime();
  const generatedAtMs = new Date(window.generatedAt).getTime();
  const startsAtMs = new Date(window.startsAt).getTime();
  const endsAtMs = new Date(window.endsAt).getTime();

  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(generatedAtMs) ||
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(endsAtMs)
  ) {
    return { valid: false, reason: "invalid_date" };
  }

  if (startsAtMs >= endsAtMs) {
    return { valid: false, reason: "invalid_range" };
  }

  if (endsAtMs <= nowMs) {
    return { valid: false, reason: "expired" };
  }

  if (generatedAtMs > nowMs + BEST_SKY_WINDOW_CLOCK_SKEW_TOLERANCE_MS) {
    return { valid: false, reason: "future_generation" };
  }

  const ttlMs = window.isEstimated ? ESTIMATED_BEST_SKY_WINDOW_TTL_MS : BEST_SKY_WINDOW_TTL_MS;
  if (nowMs - generatedAtMs > ttlMs) {
    return { valid: false, reason: "stale" };
  }

  return { valid: true, reason: "valid" };
}

export function isBestSkyWindowFresh(window: BestSkyWindow, now = new Date()): boolean {
  return getBestSkyWindowValidity(window, now).valid;
}
