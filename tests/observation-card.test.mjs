import assert from "node:assert/strict";
import test from "node:test";
import { getObservationCardRarity } from "../lib/observation-card.ts";

function observation(overrides = {}) {
  return {
    id: "memory-card-test",
    createdAt: "2026-07-06T22:00:00.000Z",
    questTitle: "Jupiter",
    target: "Jupiter",
    status: "seen",
    visibilityScore: 80,
    targetType: "planet",
    ...overrides,
  };
}

test("ordinary, first-discovery, and rare cards use distinct treatments", () => {
  assert.equal(getObservationCardRarity(observation()), "standard");
  assert.equal(getObservationCardRarity(observation({ isFirstDiscovery: true })), "discovery");
  assert.equal(getObservationCardRarity(observation({ targetType: "galaxy" })), "rare");
  assert.equal(getObservationCardRarity(observation({ targetType: "meteor_shower" })), "rare");
  assert.equal(getObservationCardRarity(observation({ targetType: "satellite" })), "rare");
});

test("advanced collection achievements unlock the rare treatment", () => {
  assert.equal(
    getObservationCardRarity(observation({ unlockedAchievements: ["orbital-watcher"] })),
    "rare",
  );
  assert.equal(
    getObservationCardRarity(observation({ unlockedAchievements: ["first-planet"] })),
    "standard",
  );
});
