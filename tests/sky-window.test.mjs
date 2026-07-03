import assert from "node:assert/strict";
import test from "node:test";
import { calculateFogRisk, selectBestWindowRange } from "../lib/sky-window-score.ts";

test("fog risk combines humidity, dew point spread, and visibility", () => {
  assert.equal(
    calculateFogRisk({
      date: "2026-07-03T20:00:00.000Z",
      cloudCover: 10,
      relativeHumidity: 96,
      temperature: 12,
      dewPoint: 8,
    }),
    "high",
  );
  assert.equal(
    calculateFogRisk({
      date: "2026-07-03T20:00:00.000Z",
      cloudCover: 10,
      relativeHumidity: 70,
      visibilityMeters: 12_000,
    }),
    "low",
  );
});

test("best sky window expands only across adjacent similarly good hours", () => {
  const range = selectBestWindowRange(
    [{ score: 42 }, { score: 70 }, { score: 78 }, { score: 74 }, { score: 55 }],
    2,
  );
  assert.deepEqual(range, { startIndex: 1, endIndex: 3 });
});
