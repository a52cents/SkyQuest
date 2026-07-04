import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isIssPassGuidable, isIssQuestGuidable } from "../lib/iss.ts";
import { calculateNextSatelliteVisiblePass } from "../lib/satellite-pass.ts";

const generatorSource = readFileSync(new URL("../lib/quest-generator.ts", import.meta.url), "utf8");
const guidePageSource = readFileSync(
  new URL("../app/quest/[id]/page.tsx", import.meta.url),
  "utf8",
);

const pass = {
  startAzimuth: 240,
  maxAzimuth: 180,
  maxElevation: 55,
  startTime: new Date("2026-07-04T23:00:00Z"),
  maxTime: new Date("2026-07-04T23:03:00Z"),
  durationSeconds: 360,
  magnitude: -3,
};

test("ISS guidance opens five minutes before the pass and closes when it ends", () => {
  assert.equal(isIssPassGuidable(pass, new Date("2026-07-04T22:54:59Z")), false);
  assert.equal(isIssPassGuidable(pass, new Date("2026-07-04T22:55:00Z")), true);
  assert.equal(isIssPassGuidable(pass, new Date("2026-07-04T23:06:00Z")), true);
  assert.equal(isIssPassGuidable(pass, new Date("2026-07-04T23:06:01Z")), false);
  assert.equal(
    isIssQuestGuidable(
      pass.startTime.toISOString(),
      "2026-07-04T23:06:00.000Z",
      new Date("2026-07-04T22:55:00Z"),
    ),
    true,
  );
});

test("current quest generation requires the ISS guidance window", () => {
  assert.match(generatorSource, /issPass && isIssPassGuidable\(issPass, now\)/);
});

test("a distant ISS pass is assigned to upcoming at its real start time", () => {
  assert.match(generatorSource, /availableAt: issPass\.startTime\.toISOString\(\)/);
  assert.match(generatorSource, /issPass: null/);
});

test("CelesTrak orbital elements produce a plausible sunlit ISS pass", () => {
  const result = calculateNextSatelliteVisiblePass({
    orbitalElements: {
      OBJECT_NAME: "ISS (ZARYA)",
      OBJECT_ID: "1998-067A",
      EPOCH: "2026-07-04T02:07:57.020160",
      MEAN_MOTION: 15.48879284,
      ECCENTRICITY: 0.00067632,
      INCLINATION: 51.6303,
      RA_OF_ASC_NODE: 216.4301,
      ARG_OF_PERICENTER: 253.0749,
      MEAN_ANOMALY: 106.9498,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: "U",
      NORAD_CAT_ID: 25544,
      ELEMENT_SET_NO: 999,
      REV_AT_EPOCH: 57437,
      BSTAR: 0.00014587488,
      MEAN_MOTION_DOT: 0.00007564,
      MEAN_MOTION_DDOT: 0,
    },
    latitude: 48.8566,
    longitude: 2.3522,
    now: new Date("2026-07-04T12:00:00Z"),
    horizonMinutes: 24 * 60,
  });

  assert.equal(result?.startTime, "2026-07-04T22:31:20.000Z");
  assert.ok((result?.maxElevation ?? 0) >= 40);
  assert.ok((result?.durationSeconds ?? 0) >= 4 * 60);
});

test("the quest page rechecks ISS availability until the pass ends", () => {
  assert.match(guidePageSource, /isIssQuestGuidable\(stored\.startsAt, stored\.endsAt\)/);
  assert.match(guidePageSource, /setInterval\(refreshAvailability, 15_000\)/);
});
