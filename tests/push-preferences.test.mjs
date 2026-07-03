import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TOPICS } from "../lib/push-types.ts";

test("notification defaults cover every supported topic", () => {
  assert.deepEqual(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES), [...NOTIFICATION_TOPICS]);
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.clear_sky_evening, true);
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.moon_visible, true);
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.planet_visible, true);
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.celestial_event, true);
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.daily_mission, false);
});
