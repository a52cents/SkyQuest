import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createObservationReport, getObservationReportLabel } from "../lib/observation-report.ts";

function observation(status) {
  return {
    id: "observation-1",
    createdAt: "2026-07-06T22:00:00.000Z",
    questTitle: "Trouve Jupiter",
    target: "Jupiter",
    targetType: "planet",
    status,
    visibilityScore: 70,
  };
}

test("reports accept only values matching the observation status", () => {
  assert.equal(createObservationReport(observation("seen"), "clouds"), null);
  assert.equal(createObservationReport(observation("missed"), "bright"), null);
  const report = createObservationReport(
    observation("missed"),
    "uncertain_direction",
    new Date("2026-07-06T22:01:00.000Z"),
  );
  assert.equal(report?.kind, "missed_reason");
  assert.equal(getObservationReportLabel(report), "Direction incertaine");
});

test("durable journal has no silent 50-item trim and migrates before removing local data", () => {
  const storage = readFileSync(new URL("../lib/storage.ts", import.meta.url), "utf8");
  const database = readFileSync(new URL("../lib/local-database.ts", import.meta.url), "utf8");
  assert.doesNotMatch(storage, /slice\(0,\s*50\)/);
  assert.match(storage, /await importStoredObservations\(observations\)[\s\S]+removeStoredValue/);
  assert.match(database, /createIndex\("createdAt"/);
  assert.match(database, /getObservationPage/);
});
