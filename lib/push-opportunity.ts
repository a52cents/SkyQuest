const SCHEDULED_PUSH_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export function isInterestingApproachingSkyWindow({
  score,
  minutesUntilWindow,
}: {
  score: number;
  minutesUntilWindow: number;
}): boolean {
  return score >= 75 && minutesUntilWindow >= 0 && minutesUntilWindow <= 10;
}

export function isInterestingBrightTarget({
  cloudCover,
  altitude,
}: {
  cloudCover: number;
  altitude: number;
}): boolean {
  return cloudCover <= 25 && altitude >= 25;
}

export function isExceptionalClearSky(cloudCover: number): boolean {
  return cloudCover <= 15;
}

export function isScheduledPushCooldownElapsed(
  lastNotificationSentAt: string | undefined,
  now = new Date(),
): boolean {
  if (!lastNotificationSentAt) return true;
  const lastSentAt = new Date(lastNotificationSentAt).getTime();
  return Number.isFinite(lastSentAt) && now.getTime() - lastSentAt >= SCHEDULED_PUSH_COOLDOWN_MS;
}
