import assert from "node:assert/strict";
import test from "node:test";
import { rankQuestsForRecommendation, RETRY_IMPROVEMENT_THRESHOLD } from "../lib/quest-ranking.ts";

function quest(target, visibilityScore, difficulty = "easy") {
  return {
    id: target,
    target,
    targetType: "planet",
    title: target,
    difficulty,
    azimuth: 120,
    altitude: 40,
    cardinalDirection: "sud-est",
    visibilityScore,
    visibilityLabel: "Bonne chance",
    description: "Une cible de test.",
    tip: "Regarde vers le sud-est.",
    requiredGear: "naked_eye",
    generatedAt: "2026-07-05T20:00:00.000Z",
  };
}

function missedObservation(target, visibilityScore) {
  return {
    id: `missed-${target}`,
    createdAt: "2026-07-04T20:00:00.000Z",
    questTitle: target,
    target,
    status: "missed",
    visibilityScore,
  };
}

test("an undiscovered strong target outranks a perfect target already found", () => {
  const ranked = rankQuestsForRecommendation([quest("known", 100), quest("new", 81)], {
    discoveredTargets: new Set(["known"]),
    observations: [],
    totalXp: 150,
  });

  assert.equal(ranked[0].quest.target, "new");
  assert.equal(ranked[0].personalizationBadge, "new_target");
});

test("a missed target is promoted only when conditions have clearly improved", () => {
  const previousScore = 58;
  const improved = quest("retry", previousScore + RETRY_IMPROVEMENT_THRESHOLD);
  const ranked = rankQuestsForRecommendation([quest("other", 75), improved], {
    discoveredTargets: new Set(["other"]),
    observations: [missedObservation("retry", previousScore)],
    totalXp: 150,
  });

  assert.equal(ranked[0].quest.target, "retry");
  assert.equal(ranked[0].personalizationBadge, "improved_retry");

  const unchanged = rankQuestsForRecommendation([quest("retry", previousScore + 5)], {
    discoveredTargets: new Set(),
    observations: [missedObservation("retry", previousScore)],
    totalXp: 150,
  });
  assert.equal(unchanged[0].personalizationBadge, null);
});

test("experience breaks equal recommendations toward a suitable difficulty", () => {
  const easy = quest("easy", 75, "easy");
  const medium = quest("medium", 75, "medium");

  assert.equal(
    rankQuestsForRecommendation([medium, easy], {
      discoveredTargets: new Set(),
      observations: [],
      totalXp: 0,
    })[0].quest.difficulty,
    "easy",
  );
  assert.equal(
    rankQuestsForRecommendation([easy, medium], {
      discoveredTargets: new Set(),
      observations: [],
      totalXp: 300,
    })[0].quest.difficulty,
    "medium",
  );
});
