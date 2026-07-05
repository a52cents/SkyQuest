import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyQuestReward,
  createEmptyProgressProfile,
  getLocalNightKey,
  getStreakDisplayState,
  updateStreakOnSuccess,
} from "../lib/progression.ts";

const progressionSource = readFileSync(new URL("../lib/progression.ts", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../lib/storage.ts", import.meta.url), "utf8");
const dashboardSource = readFileSync(
  new URL("../components/ProgressDashboard.tsx", import.meta.url),
  "utf8",
);

function localNight(day, hour = 22) {
  return new Date(2026, 0, day, hour, 0, 0, 0);
}

function quest() {
  return {
    id: "vega-test",
    target: "vega",
    targetType: "star",
    title: "Repère Véga",
    difficulty: "easy",
    azimuth: 180,
    altitude: 40,
    cardinalDirection: "sud",
    visibilityScore: 80,
    visibilityLabel: "Bonne chance",
    description: "",
    tip: "",
    requiredGear: "naked_eye",
    generatedAt: localNight(1).toISOString(),
  };
}

test("same, consecutive, and backdated local nights keep streak invariants", () => {
  const first = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  assert.equal(first.currentStreak, 1);
  assert.equal(first.streakFreezeCount, 1);

  const sameNight = updateStreakOnSuccess(first, localNight(1, 23));
  assert.strictEqual(sameNight, first);

  const consecutive = updateStreakOnSuccess(sameNight, localNight(2));
  assert.equal(consecutive.currentStreak, 2);
  assert.equal(consecutive.streakFreezeCount, 1);

  const backdated = updateStreakOnSuccess(consecutive, localNight(1));
  assert.strictEqual(backdated, consecutive);
});

test("one missed night consumes one freeze and two missed nights never do", () => {
  const first = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  const protectedStreak = updateStreakOnSuccess(first, localNight(3));

  assert.equal(protectedStreak.currentStreak, 2);
  assert.equal(protectedStreak.streakFreezeCount, 0);
  assert.equal(protectedStreak.lastStreakFreezeUsedNightKey, getLocalNightKey(localNight(3)));

  const noFreeze = updateStreakOnSuccess(protectedStreak, localNight(5));
  assert.equal(noFreeze.currentStreak, 1);
  assert.equal(noFreeze.streakFreezeCount, 0);

  const freshFirst = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  const expired = updateStreakOnSuccess(freshFirst, localNight(4));
  assert.equal(expired.currentStreak, 1);
  assert.equal(expired.streakFreezeCount, 1);
  assert.equal(expired.lastStreakFreezeUsedNightKey, null);
});

test("a freeze regenerates after seven nights but cannot rescue the current expired streak", () => {
  const first = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  let profile = updateStreakOnSuccess(first, localNight(3));

  for (let day = 4; day <= 9; day += 1) {
    profile = updateStreakOnSuccess(profile, localNight(day));
  }
  assert.equal(profile.streakFreezeCount, 0);

  profile = updateStreakOnSuccess(profile, localNight(10));
  assert.equal(profile.streakFreezeCount, 1);
  assert.equal(profile.lastFreezeRegenerationKey, getLocalNightKey(localNight(10)));

  const consumed = updateStreakOnSuccess(profile, localNight(12));
  assert.equal(consumed.streakFreezeCount, 0);
  assert.equal(consumed.lastStreakFreezeUsedNightKey, getLocalNightKey(localNight(12)));

  const consumedEarly = updateStreakOnSuccess(first, localNight(3));
  const regeneratedAfterExpiry = updateStreakOnSuccess(consumedEarly, localNight(10));
  assert.equal(regeneratedAfterExpiry.currentStreak, 1);
  assert.equal(regeneratedAfterExpiry.streakFreezeCount, 1);
  assert.equal(
    regeneratedAfterExpiry.lastStreakFreezeUsedNightKey,
    getLocalNightKey(localNight(3)),
  );
});

test("missed observations leave every streak field untouched", () => {
  const profile = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  const result = applyQuestReward(profile, quest(), "missed", localNight(4));

  assert.equal(result.profile.currentStreak, profile.currentStreak);
  assert.equal(result.profile.longestStreak, profile.longestStreak);
  assert.equal(result.profile.lastObservationNightKey, profile.lastObservationNightKey);
  assert.equal(result.profile.streakFreezeCount, profile.streakFreezeCount);
  assert.equal(result.profile.lastStreakFreezeUsedNightKey, profile.lastStreakFreezeUsedNightKey);
});

test("streak display state expires stale values without mutating the profile", () => {
  const profile = updateStreakOnSuccess(createEmptyProgressProfile(), localNight(1));
  const snapshot = structuredClone(profile);

  assert.deepEqual(getStreakDisplayState(profile, localNight(1)), {
    displayStreak: 1,
    status: "active",
    message: "Série de 1 nuit !",
  });
  assert.equal(getStreakDisplayState(profile, localNight(2)).status, "at_risk");
  assert.equal(getStreakDisplayState(profile, localNight(3)).status, "protected");
  assert.deepEqual(getStreakDisplayState(profile, localNight(4)), {
    displayStreak: 0,
    status: "expired",
    message: "Observe cette nuit pour commencer une nouvelle série.",
  });
  assert.equal(
    getStreakDisplayState({ ...profile, streakFreezeCount: 0 }, localNight(3)).displayStreak,
    0,
  );
  assert.deepEqual(profile, snapshot);
});

test("storage migrates the freeze cooldown marker and dashboard uses live display state", () => {
  assert.match(storageSource, /lastStreakFreezeUsedNightKey/);
  assert.match(
    storageSource,
    /streakFreezeCount === 0[\s\S]+lastFreezeRegenerationKey \?\? lastObservationNightKey/,
  );
  assert.match(dashboardSource, /getStreakDisplayState\(profile, new Date\(\)\)/);
  assert.match(dashboardSource, /streakDisplay\.displayStreak/);
  assert.doesNotMatch(progressionSource, /Ouch, série perdue/);
});
