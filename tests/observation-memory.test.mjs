import assert from "node:assert/strict";
import test from "node:test";
import { applyQuestReward, createEmptyProgressProfile } from "../lib/progression.ts";

function quest(target, targetType) {
  return {
    id: target,
    target,
    targetType,
    title: target,
    difficulty: "easy",
    azimuth: 180,
    altitude: 30,
    cardinalDirection: "sud",
    visibilityScore: 84,
    visibilityLabel: "Bonne chance",
    description: "",
    tip: "",
    requiredGear: "naked_eye",
  };
}

test("memory achievements unlock for the first planet, constellation and Moon", () => {
  let profile = createEmptyProgressProfile("2026-01-01T00:00:00.000Z");

  const planet = applyQuestReward(
    profile,
    quest("Venus", "planet"),
    "seen",
    new Date("2026-01-01T22:00:00.000Z"),
  );
  profile = planet.profile;
  assert.ok(planet.reward.unlockedAchievements.includes("first-planet"));

  const constellation = applyQuestReward(
    profile,
    quest("Orion", "constellation"),
    "seen",
    new Date("2026-01-02T22:00:00.000Z"),
  );
  profile = constellation.profile;
  assert.ok(constellation.reward.unlockedAchievements.includes("first-constellation"));

  const moon = applyQuestReward(
    profile,
    quest("Moon", "moon"),
    "seen",
    new Date("2026-01-03T22:00:00.000Z"),
  );
  assert.ok(moon.reward.unlockedAchievements.includes("moon-hunter"));
});
