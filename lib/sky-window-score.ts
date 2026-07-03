import type { FogRisk, WeatherHour } from "@/lib/types";

export function calculateFogRisk(hour: WeatherHour): FogRisk {
  const dewPointSpread =
    typeof hour.temperature === "number" && typeof hour.dewPoint === "number"
      ? hour.temperature - hour.dewPoint
      : undefined;
  if (
    hour.relativeHumidity >= 95 ||
    (dewPointSpread !== undefined && dewPointSpread <= 1) ||
    (hour.visibilityMeters !== undefined && hour.visibilityMeters < 3_000)
  ) {
    return "high";
  }
  if (
    hour.relativeHumidity >= 85 ||
    (dewPointSpread !== undefined && dewPointSpread <= 3) ||
    (hour.visibilityMeters !== undefined && hour.visibilityMeters < 8_000)
  ) {
    return "moderate";
  }
  return "low";
}

export function selectBestWindowRange(
  hours: ReadonlyArray<{ score: number }>,
  bestIndex: number,
): { startIndex: number; endIndex: number } {
  if (bestIndex < 0 || bestIndex >= hours.length) {
    throw new Error("Best hour index is outside the forecast");
  }
  const threshold = Math.max(45, hours[bestIndex].score - 8);
  let startIndex = bestIndex;
  let endIndex = bestIndex;
  while (startIndex > 0 && bestIndex - startIndex < 1 && hours[startIndex - 1].score >= threshold) {
    startIndex -= 1;
  }
  while (
    endIndex < hours.length - 1 &&
    endIndex - startIndex < 2 &&
    hours[endIndex + 1].score >= threshold
  ) {
    endIndex += 1;
  }
  return { startIndex, endIndex };
}
