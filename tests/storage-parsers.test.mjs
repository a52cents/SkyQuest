import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBestSkyWindow,
  parseDashboardAnalysis,
  parseSkyQuest,
  parseStoredLocation,
} from "../lib/storage-parsers.ts";
import { getActiveQuest, getLastLocation, saveLastLocation } from "../lib/storage.ts";

function quest(overrides = {}) {
  return {
    id: "jupiter-now",
    target: "Jupiter",
    targetType: "planet",
    title: "Trouve Jupiter",
    difficulty: "easy",
    azimuth: 182,
    altitude: 42,
    cardinalDirection: "sud",
    visibilityScore: 78,
    visibilityLabel: "Bonne chance",
    description: "Un point très lumineux.",
    tip: "Regarde vers le sud.",
    requiredGear: "naked_eye",
    generatedAt: "2026-07-06T22:00:00.000Z",
    weather: { cloudCover: 12, isDay: false, temperature: 18 },
    ...overrides,
  };
}

function bestSkyWindow(overrides = {}) {
  return {
    generatedAt: "2026-07-06T20:00:00.000Z",
    startsAt: "2026-07-06T22:00:00.000Z",
    endsAt: "2026-07-06T23:00:00.000Z",
    score: 82,
    bestTargets: ["Jupiter"],
    moonIlluminationPercent: 24,
    moonPhaseLabel: "Premier croissant",
    hours: [
      {
        date: "2026-07-06T22:00:00.000Z",
        score: 82,
        cloudCover: 12,
        relativeHumidity: 55,
        fogRisk: "low",
        sunAltitude: -22,
        isAstronomicalDark: true,
        bestTargets: ["Jupiter"],
      },
    ],
    timezone: "Europe/Paris",
    isEstimated: false,
    ...overrides,
  };
}

test("SkyQuest and location parsers accept valid values and reject unsafe coordinates", () => {
  assert.equal(parseSkyQuest(quest())?.id, "jupiter-now");
  assert.equal(
    parseSkyQuest(
      quest({
        targetType: "satellite",
        satelliteTrajectory: [{ at: "2026-07-06T22:01:00.000Z", azimuth: 359, altitude: 34 }],
      }),
    )?.targetType,
    "satellite",
  );
  assert.equal(parseSkyQuest(quest({ visibilityScore: Number.NaN })), null);
  assert.equal(
    parseSkyQuest(quest({ satelliteTrajectory: [{ at: "invalid", azimuth: 400, altitude: 34 }] })),
    null,
  );
  assert.deepEqual(parseStoredLocation({ latitude: 48.86, longitude: 2.35, extra: true }), {
    latitude: 48.86,
    longitude: 2.35,
  });
  assert.deepEqual(parseStoredLocation({ latitude: 48.86, longitude: 2.35, altitudeMeters: 42 }), {
    latitude: 48.86,
    longitude: 2.35,
    altitudeMeters: 42,
  });
  assert.equal(parseStoredLocation({ latitude: 91, longitude: 2.35 }), null);
  assert.equal(
    parseStoredLocation({ latitude: 48.86, longitude: 2.35, altitudeMeters: Number.NaN }),
    null,
  );
});

test("BestSkyWindow parser validates every nested forecast hour", () => {
  assert.equal(parseBestSkyWindow(bestSkyWindow())?.score, 82);
  assert.equal(
    parseBestSkyWindow(
      bestSkyWindow({
        hours: [{ ...bestSkyWindow().hours[0], fogRisk: "unknown" }],
      }),
    ),
    null,
  );
  assert.equal(
    parseBestSkyWindow(
      bestSkyWindow({
        startsAt: "2026-07-06T23:00:00.000Z",
        endsAt: "2026-07-06T22:00:00.000Z",
      }),
    ),
    null,
  );
});

test("DashboardAnalysis parser validates nested data and migrates the old generatedAt field", () => {
  const savedAt = new Date("2026-07-06T22:00:00.000Z").getTime();
  const legacy = {
    savedAt,
    position: { latitude: 48.86, longitude: 2.35 },
    weather: { cloudCover: 12, isDay: false },
    quests: [quest()],
    bestSkyWindow: bestSkyWindow(),
  };

  assert.equal(parseDashboardAnalysis(legacy)?.generatedAt, new Date(savedAt).toISOString());
  assert.equal(parseDashboardAnalysis({ ...legacy, quests: [quest({ altitude: 200 })] }), null);
  assert.equal(
    parseDashboardAnalysis({
      ...legacy,
      bestSkyWindow: bestSkyWindow({ hours: [{ ...bestSkyWindow().hours[0], score: 120 }] }),
    }),
    null,
  );
  assert.equal(parseDashboardAnalysis({ ...legacy, savedAt: Number.MAX_VALUE }), null);
});

test("storage getters remove corrupted active quests and locations instead of casting them", () => {
  const originalWindow = globalThis.window;
  const values = new Map([
    ["skyquest.activeQuest.v0", JSON.stringify(quest({ altitude: "très haut" }))],
    ["skyquest.lastLocation.v0", JSON.stringify({ latitude: 240, longitude: 2.35 })],
  ]);
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };

  try {
    assert.equal(getActiveQuest(), null);
    assert.equal(getLastLocation(), null);
    assert.equal(values.has("skyquest.activeQuest.v0"), false);
    assert.equal(values.has("skyquest.lastLocation.v0"), false);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("persisted observer location remains rounded, including optional altitude", () => {
  const originalWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };
  try {
    saveLastLocation({ latitude: 48.8566, longitude: 2.3522, altitudeMeters: 43 });
    assert.deepEqual(JSON.parse(values.get("skyquest.lastLocation.v0")), {
      latitude: 48.86,
      longitude: 2.35,
      altitudeMeters: 40,
    });
  } finally {
    globalThis.window = originalWindow;
  }
});
