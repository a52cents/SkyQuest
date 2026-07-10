import assert from "node:assert/strict";
import test from "node:test";
import {
  createMagneticDeclinationCache,
  getMagneticDeclination,
} from "../lib/magnetic-declination.ts";

function dateFromDecimalYear(decimalYear) {
  const year = Math.floor(decimalYear);
  return new Date(Date.UTC(year, 0, 1) + (decimalYear - year) * 365 * 86_400_000);
}

// NOAA/NCEI WMM2025 official validation vectors, published December 2024.
const officialVectors = [
  { date: 2025, altitudeMeters: 0, latitude: 80, longitude: 0, declination: 1.28 },
  { date: 2025, altitudeMeters: 0, latitude: 0, longitude: 120, declination: -0.16 },
  { date: 2025, altitudeMeters: 0, latitude: -80, longitude: -120, declination: 68.78 },
  { date: 2025, altitudeMeters: 100_000, latitude: 80, longitude: 0, declination: 0.85 },
  { date: 2027.5, altitudeMeters: 0, latitude: 80, longitude: 0, declination: 2.59 },
  { date: 2027.5, altitudeMeters: 0, latitude: 0, longitude: 120, declination: -0.24 },
];

test("WMM2025 matches official NOAA declination vectors", () => {
  for (const vector of officialVectors) {
    const result = getMagneticDeclination({
      ...vector,
      date: dateFromDecimalYear(vector.date),
    });
    assert.equal(result.available, true);
    assert.ok(Math.abs(result.declinationDegrees - vector.declination) <= 0.02);
    assert.equal(result.model, "WMM2025");
    assert.equal(result.epoch, 2025);
    assert.equal(result.validUntil, "2030-01-01");
  }
});

test("WMM input validation and altitude fallback fail safely", () => {
  const date = new Date("2026-07-10T00:00:00Z");
  assert.deepEqual(getMagneticDeclination({ latitude: 91, longitude: 0, date }), {
    available: false,
    reason: "invalid_input",
  });
  assert.deepEqual(getMagneticDeclination({ latitude: 0, longitude: Number.NaN, date }), {
    available: false,
    reason: "invalid_input",
  });
  assert.deepEqual(
    getMagneticDeclination({ latitude: 0, longitude: 0, date: new Date("invalid") }),
    { available: false, reason: "invalid_input" },
  );
  assert.deepEqual(
    getMagneticDeclination({ latitude: 0, longitude: 0, date: new Date("2030-01-01Z") }),
    { available: false, reason: "outside_model_period" },
  );
  assert.deepEqual(
    getMagneticDeclination({ latitude: 0, longitude: 0, date }, () => Number.NaN),
    { available: false, reason: "calculation_failed" },
  );
  assert.equal(
    getMagneticDeclination({ latitude: 48.86, longitude: 2.35, date }).usedAltitudeFallback,
    true,
  );
});

test("in-memory cache reuses nearby readings and refreshes for position or month changes", () => {
  let calculations = 0;
  const cache = createMagneticDeclinationCache((input) => {
    calculations += 1;
    return {
      available: true,
      declinationDegrees: input.latitude,
      model: "WMM2025",
      epoch: 2025,
      validUntil: "2030-01-01",
      usedAltitudeFallback: true,
    };
  });
  const base = {
    latitude: 48.8566,
    longitude: 2.3522,
    date: new Date("2026-07-10T00:00:00Z"),
  };
  cache(base);
  cache({ ...base, latitude: 48.8567, longitude: 2.3521 });
  assert.equal(calculations, 1);
  cache({ ...base, latitude: 49.1 });
  assert.equal(calculations, 2);
  cache({ ...base, date: new Date("2026-08-01T00:00:00Z") });
  assert.equal(calculations, 3);
  cache({ ...base, date: new Date("2027-07-10T00:00:00Z") });
  assert.equal(calculations, 4);
});
