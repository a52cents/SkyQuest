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
