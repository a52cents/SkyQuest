import test from "node:test";
import assert from "node:assert/strict";
import {
  applyWeeklyObservation,
  createEmptyProgressProfile,
  getLocalNightKey,
  getLocalWeekKey,
  getWeeklyStreakDisplayState,
} from "../lib/progression.ts";

function localDate(year, month, day, hour = 22) {
  return new Date(year, month - 1, day, hour, 0, 0);
}

function record(profile, date) {
  return applyWeeklyObservation(profile, getLocalNightKey(date), date);
}

test("two successes on one local night count once", () => {
  const now = localDate(2026, 7, 6);
  const first = record(createEmptyProgressProfile(now.toISOString()), now);
  const second = record(first, new Date(now.getTime() + 30 * 60_000));
  assert.deepEqual(second.currentWeek.successfulNightKeys, [getLocalNightKey(now)]);
  assert.equal(second.currentWeek.completed, false);
});

test("two distinct nights validate a week and consecutive completed weeks extend it", () => {
  let profile = createEmptyProgressProfile(localDate(2026, 7, 6).toISOString());
  profile = record(profile, localDate(2026, 7, 6));
  profile = record(profile, localDate(2026, 7, 7));
  assert.equal(profile.weeklyStreak, 1);
  assert.equal(profile.currentWeek.completed, true);

  profile = record(profile, localDate(2026, 7, 13));
  profile = record(profile, localDate(2026, 7, 14));
  assert.equal(profile.weeklyStreak, 2);
  assert.equal(profile.longestWeeklyStreak, 2);
});

test("a missing week resets the active streak without erasing the record", () => {
  let profile = createEmptyProgressProfile(localDate(2026, 7, 6).toISOString());
  profile = record(record(profile, localDate(2026, 7, 6)), localDate(2026, 7, 7));
  profile = record(record(profile, localDate(2026, 7, 20)), localDate(2026, 7, 21));
  assert.equal(profile.weeklyStreak, 1);
  assert.equal(profile.longestWeeklyStreak, 1);
  assert.equal(getWeeklyStreakDisplayState(profile, localDate(2026, 7, 21)).displayStreak, 1);
});

test("local weeks start on Monday across Sunday and year boundaries", () => {
  assert.equal(getLocalWeekKey(localDate(2026, 7, 12)), "2026-07-06");
  assert.equal(getLocalWeekKey(localDate(2026, 7, 13)), "2026-07-13");
  assert.equal(getLocalWeekKey(localDate(2027, 1, 1)), "2026-12-28");
});
