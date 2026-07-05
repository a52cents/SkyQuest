import type { SatelliteTrajectoryPoint } from "./types.ts";

const MAX_SAMPLE_GAP_MS = 60_000;

function normalizeAzimuth(azimuth: number): number {
  return ((azimuth % 360) + 360) % 360;
}

function interpolateAzimuth(left: number, right: number, progress: number): number {
  const shortestDifference = ((right - left + 540) % 360) - 180;
  return normalizeAzimuth(left + shortestDifference * progress);
}

export function getSatellitePositionAt(
  trajectory: readonly SatelliteTrajectoryPoint[] | undefined,
  now: Date,
): { azimuth: number; altitude: number } | null {
  if (!trajectory || trajectory.length < 2) return null;

  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) return null;

  for (let index = 1; index < trajectory.length; index += 1) {
    const left = trajectory[index - 1];
    const right = trajectory[index];
    const leftTime = new Date(left.at).getTime();
    const rightTime = new Date(right.at).getTime();
    if (
      !Number.isFinite(leftTime) ||
      !Number.isFinite(rightTime) ||
      rightTime <= leftTime ||
      rightTime - leftTime > MAX_SAMPLE_GAP_MS ||
      currentTime < leftTime ||
      currentTime > rightTime
    ) {
      continue;
    }

    const progress = (currentTime - leftTime) / (rightTime - leftTime);
    return {
      azimuth: interpolateAzimuth(left.azimuth, right.azimuth, progress),
      altitude: left.altitude + (right.altitude - left.altitude) * progress,
    };
  }

  return null;
}
