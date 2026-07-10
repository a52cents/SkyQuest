import { calculateMagVar } from "magvar";

export const MAGNETIC_MODEL = "WMM2025" as const;
export const MAGNETIC_MODEL_EPOCH = 2025;
export const MAGNETIC_MODEL_VALID_UNTIL = "2030-01-01";

export type MagneticDeclinationResult =
  | {
      available: true;
      declinationDegrees: number;
      model: typeof MAGNETIC_MODEL;
      epoch: typeof MAGNETIC_MODEL_EPOCH;
      validUntil: typeof MAGNETIC_MODEL_VALID_UNTIL;
      usedAltitudeFallback: boolean;
    }
  | {
      available: false;
      reason: "invalid_input" | "outside_model_period" | "calculation_failed";
    };

export type MagneticDeclinationInput = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
  date: Date;
};

const MODEL_START_MS = Date.UTC(2025, 0, 1);
const MODEL_END_MS = Date.UTC(2030, 0, 1);
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;

export function getMagneticDeclination(
  { latitude, longitude, altitudeMeters, date }: MagneticDeclinationInput,
  calculate: typeof calculateMagVar = calculateMagVar,
): MagneticDeclinationResult {
  const dateMs = date.getTime();
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(dateMs) ||
    (altitudeMeters !== undefined &&
      altitudeMeters !== null &&
      (!Number.isFinite(altitudeMeters) || altitudeMeters < -1_000 || altitudeMeters > 850_000))
  ) {
    return { available: false, reason: "invalid_input" };
  }
  if (dateMs < MODEL_START_MS || dateMs >= MODEL_END_MS) {
    return { available: false, reason: "outside_model_period" };
  }

  const usedAltitudeFallback = altitudeMeters === undefined || altitudeMeters === null;
  const altitudeKilometers = (altitudeMeters ?? 0) / 1_000;
  try {
    const julianDays = dateMs / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
    const declinationDegrees = calculate(julianDays, latitude, longitude, altitudeKilometers);
    if (!Number.isFinite(declinationDegrees)) {
      return { available: false, reason: "calculation_failed" };
    }
    return {
      available: true,
      declinationDegrees,
      model: MAGNETIC_MODEL,
      epoch: MAGNETIC_MODEL_EPOCH,
      validUntil: MAGNETIC_MODEL_VALID_UNTIL,
      usedAltitudeFallback,
    };
  } catch {
    return { available: false, reason: "calculation_failed" };
  }
}

export function createMagneticDeclinationCache(
  calculate: (
    input: MagneticDeclinationInput,
  ) => MagneticDeclinationResult = getMagneticDeclination,
): (input: MagneticDeclinationInput) => MagneticDeclinationResult {
  const cache = new Map<string, MagneticDeclinationResult>();
  return (input) => {
    const dateMs = input.date.getTime();
    if (!Number.isFinite(dateMs)) return calculate(input);
    const monthKey = `${input.date.getUTCFullYear()}-${input.date.getUTCMonth()}`;
    const latitudeKey = Number.isFinite(input.latitude) ? input.latitude.toFixed(2) : "invalid";
    const longitudeKey = Number.isFinite(input.longitude) ? input.longitude.toFixed(2) : "invalid";
    const altitudeKey =
      input.altitudeMeters === undefined || input.altitudeMeters === null
        ? "fallback-0"
        : Number.isFinite(input.altitudeMeters)
          ? String(Math.round(input.altitudeMeters / 100) * 100)
          : "invalid";
    const key = `${MAGNETIC_MODEL}:${monthKey}:${latitudeKey}:${longitudeKey}:${altitudeKey}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const result = calculate(input);
    if (cache.size >= 32) cache.delete(cache.keys().next().value as string);
    cache.set(key, result);
    return result;
  };
}

export const getCachedMagneticDeclination = createMagneticDeclinationCache();
