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

export function getPushLocalNightKey(date: Date, timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    const hour = Number(values.hour);
    if (![year, month, day, hour].every(Number.isFinite)) return null;

    const nightDate = new Date(Date.UTC(year, month - 1, day - (hour < 12 ? 1 : 0)));
    return nightDate.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
