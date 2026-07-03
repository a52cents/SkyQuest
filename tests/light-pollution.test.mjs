import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultLightPollutionEstimate,
  getLightPollutionAdvice,
  getTargetLightPollutionPenalty,
  normalizeLightPollutionScore,
} from "../lib/light-pollution.ts";
import { fetchConfiguredLightPollutionEstimate } from "../lib/light-pollution-provider.ts";
import { calculateCatalogVisibilityScore, calculateVisibilityScore } from "../lib/visibility.ts";

const brightSky = {
  ...getLightPollutionAdvice(0),
  score: 0,
  source: "viirs",
  confidence: "high",
};

test("light pollution measurements normalize to a dark-sky score", () => {
  assert.equal(normalizeLightPollutionScore(120), 100);
  assert.equal(normalizeLightPollutionScore({ bortleClass: 1 }), 100);
  assert.equal(normalizeLightPollutionScore({ bortleClass: 9 }), 8);
  assert.equal(normalizeLightPollutionScore({ sqm: 19.5 }), 50);
  assert.ok(
    normalizeLightPollutionScore({ radiance: 1 }) > normalizeLightPollutionScore({ radiance: 50 }),
  );
});

test("sky quality levels provide beginner-friendly advice", () => {
  assert.equal(getLightPollutionAdvice(90).level, "excellent");
  assert.equal(getLightPollutionAdvice(55).label, "Ciel périurbain");
  assert.match(getLightPollutionAdvice(10).shortAdvice, /objets faibles/i);
});

test("a bright sky penalizes a galaxy more than a planet", () => {
  assert.ok(
    getTargetLightPollutionPenalty("galaxy", brightSky) >
      getTargetLightPollutionPenalty("planet", brightSky),
  );
});

test("provider failure returns a non-blocking low-confidence fallback", async () => {
  const estimate = await fetchConfiguredLightPollutionEstimate({
    latitude: 48.86,
    longitude: 2.35,
    apiUrl: "https://provider.invalid/estimate",
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  assert.deepEqual(estimate, getDefaultLightPollutionEstimate());
});

test("a planet remains eligible under strong light pollution when altitude and weather are good", () => {
  const planetScore = calculateVisibilityScore({
    object: { name: "Jupiter", altitude: 45, azimuth: 180, magnitudeHint: "very-bright" },
    weather: { cloudCover: 5, isDay: false },
    sunAltitude: -18,
    lightPollution: brightSky,
  });
  const galaxyScore = calculateCatalogVisibilityScore({
    object: {
      id: "test-galaxy",
      name: "Test galaxy",
      frenchName: "Galaxie test",
      type: "galaxy",
      requiredGear: "binoculars_recommended",
      difficulty: "hard",
      franceFriendly: true,
      priority: 100,
      questTitle: "Tente la galaxie",
      description: "Cible faible",
      observationTip: "Utilise des jumelles",
    },
    altitude: 45,
    weather: { cloudCover: 5, isDay: false },
    sunAltitude: -18,
    now: new Date("2026-07-03T23:00:00Z"),
    lightPollution: brightSky,
  });

  assert.ok(planetScore >= 50);
  assert.ok(galaxyScore < planetScore);
});
