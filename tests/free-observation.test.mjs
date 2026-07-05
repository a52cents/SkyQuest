import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyQuestReward,
  createEmptyProgressProfile,
  getLocalNightKey,
} from "../lib/progression.ts";
import {
  formatFreeObservationTime,
  FREE_OBSERVATION_DURATION_SECONDS,
  getFreeObservationRemainingSeconds,
} from "../lib/free-observation.ts";

const guideSource = readFileSync(
  new URL("../components/FreeObservationGuide.tsx", import.meta.url),
  "utf8",
);
const questPageSource = readFileSync(
  new URL("../app/quest/[id]/page.tsx", import.meta.url),
  "utf8",
);
const observationCardSource = readFileSync(
  new URL("../lib/observation-card.ts", import.meta.url),
  "utf8",
);

function freeObservationQuest() {
  return {
    id: "free-observation-test",
    target: "FreeObservation",
    targetType: "free_observation",
    title: "Observe le ciel pendant 2 minutes",
    difficulty: "easy",
    azimuth: null,
    altitude: null,
    cardinalDirection: null,
    visibilityScore: 40,
    visibilityLabel: "Tentable",
    description: "",
    tip: "",
    requiredGear: "naked_eye",
    generatedAt: "2026-07-06T20:00:00.000Z",
  };
}

test("free observation uses its dedicated guide while targeted quests keep CameraGuide", () => {
  assert.match(questPageSource, /quest\.targetType === "free_observation"/);
  assert.match(questPageSource, /<FreeObservationGuide/);
  assert.match(questPageSource, /return \(\s*<CameraGuide/);
});

test("free observation guide never requests camera or orientation access", () => {
  assert.doesNotMatch(guideSource, /getUserMedia|mediaDevices|requestPermission/);
  assert.doesNotMatch(guideSource, /DeviceOrientation|useDeviceOrientation|CameraGuide/);
});

test("free observation timer lasts 120 seconds and is based on an absolute end time", () => {
  assert.equal(FREE_OBSERVATION_DURATION_SECONDS, 120);
  assert.equal(getFreeObservationRemainingSeconds(121_000, 1_000), 120);
  assert.equal(getFreeObservationRemainingSeconds(121_000, 61_001), 60);
  assert.equal(getFreeObservationRemainingSeconds(121_000, 121_000), 0);
  assert.equal(formatFreeObservationTime(120), "02:00");
  assert.match(guideSource, /Date\.now\(\) \+ FREE_OBSERVATION_DURATION_SECONDS \* 1_000/);
});

test("free observation seen earns at most 15 XP per local night", () => {
  const now = new Date("2026-07-06T22:00:00.000Z");
  const first = applyQuestReward(createEmptyProgressProfile(), freeObservationQuest(), "seen", now);
  const repeated = applyQuestReward(first.profile, freeObservationQuest(), "seen", now);

  assert.equal(first.reward.xpEarned, 15);
  assert.equal(repeated.reward.xpEarned, 0);
  assert.equal(repeated.profile.totalXp, 15);
});

test("free observation missed earns at most 5 XP per local night and does not start a streak", () => {
  const now = new Date("2026-07-06T22:00:00.000Z");
  const first = applyQuestReward(
    createEmptyProgressProfile(),
    freeObservationQuest(),
    "missed",
    now,
  );
  const repeated = applyQuestReward(first.profile, freeObservationQuest(), "missed", now);

  assert.equal(first.reward.xpEarned, 5);
  assert.equal(repeated.reward.xpEarned, 0);
  assert.equal(repeated.profile.totalXp, 5);
  assert.equal(repeated.profile.currentStreak, 0);
  assert.equal(repeated.profile.lastObservationNightKey, null);
});

test("free observation never becomes a discovery but seen can extend the streak", () => {
  const firstNight = new Date("2026-07-06T22:00:00.000Z");
  const secondNight = new Date("2026-07-07T22:00:00.000Z");
  const missed = applyQuestReward(
    createEmptyProgressProfile(),
    freeObservationQuest(),
    "missed",
    firstNight,
  );
  const seen = applyQuestReward(missed.profile, freeObservationQuest(), "seen", secondNight);

  assert.equal(missed.reward.isFirstDiscovery, false);
  assert.equal(seen.reward.isFirstDiscovery, false);
  assert.deepEqual(seen.profile.discoveredTargets, []);
  assert.equal(seen.profile.currentStreak, 1);
  assert.equal(seen.profile.lastObservationNightKey, getLocalNightKey(secondNight));
});

test("free observation has a stable user-facing journal label", () => {
  assert.match(observationCardSource, /return "Observation libre"/);
  assert.match(observationCardSource, /observation\.targetType === "free_observation"/);
});
