import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findNextIssVisiblePass, isIssPassGuidable, isIssQuestGuidable } from "../lib/iss.ts";

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

test("expired passes are ignored when selecting the next ISS pass", () => {
  const result = findNextIssVisiblePass(
    {
      passes: [
        {
          startAz: 10,
          maxAz: 20,
          maxEl: 40,
          startUTC: 1_000,
          maxUTC: 1_100,
          duration: 200,
        },
        {
          startAz: 30,
          maxAz: 40,
          maxEl: 50,
          startUTC: 2_100,
          maxUTC: 2_200,
          duration: 300,
        },
      ],
    },
    new Date(2_000 * 1000),
    30,
  );

  assert.equal(result?.startTime, new Date(2_100 * 1000).toISOString());
});

test("the quest page rechecks ISS availability until the pass ends", () => {
  assert.match(guidePageSource, /isIssQuestGuidable\(stored\.startsAt, stored\.endsAt\)/);
  assert.match(guidePageSource, /setInterval\(refreshAvailability, 15_000\)/);
});
