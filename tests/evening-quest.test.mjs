import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "fake-indexeddb/auto";
import { selectEveningQuest } from "../lib/evening-quest.ts";
import { rankQuestsForRecommendation } from "../lib/quest-ranking.ts";
import {
  applyQuestReward,
  createEmptyProgressProfile,
  EVENING_QUEST_BONUS_XP,
  getLocalNightKey,
} from "../lib/progression.ts";
import {
  addObservation,
  clearExpiredEveningQuestAssignment,
  getEveningQuestAssignment,
  getProgressProfile,
  saveEveningQuestAssignment,
} from "../lib/storage.ts";

const dashboardSource = readFileSync(
  new URL("../components/dashboard/Dashboard.tsx", import.meta.url),
  "utf8",
);
const feedbackSource = readFileSync(
  new URL("../components/ProgressFeedback.tsx", import.meta.url),
  "utf8",
);
const journalSource = readFileSync(
  new URL("../components/JournalList.tsx", import.meta.url),
  "utf8",
);

function localDate(day, hour = 22) {
  return new Date(2026, 6, day, hour, 0, 0, 0);
}

function quest(target, visibilityScore, options = {}) {
  const now = options.now ?? localDate(6);
  return {
    id: `${target}-${options.idSuffix ?? "fresh"}`,
    target,
    targetType: options.targetType ?? "planet",
    title: target,
    difficulty: options.difficulty ?? "easy",
    azimuth: options.azimuth ?? 120,
    altitude: options.altitude ?? 40,
    cardinalDirection: "sud-est",
    visibilityScore,
    visibilityLabel: "Bonne chance",
    description: "Une cible de test.",
    tip: "Regarde vers le sud-est.",
    requiredGear: options.requiredGear ?? "naked_eye",
    generatedAt: now.toISOString(),
    weather: { cloudCover: 10, isDay: options.isDay ?? false },
  };
}

function ranked(quests, context = {}) {
  return rankQuestsForRecommendation(quests, {
    discoveredTargets: context.discoveredTargets ?? new Set(),
    observations: context.observations ?? [],
    totalXp: context.totalXp ?? 150,
  });
}

function select(quests, options = {}) {
  const now = options.now ?? localDate(6);
  return selectEveningQuest({
    rankedQuests: ranked(quests, options.context),
    existingAssignment: options.existingAssignment ?? null,
    nightKey: options.nightKey ?? getLocalNightKey(now),
    totalXp: options.totalXp ?? 150,
    now,
  });
}

test("selects a fresh reliable quest and excludes free observation and satellites", () => {
  const result = select([
    quest("FreeObservation", 100, { targetType: "free_observation" }),
    quest("iss", 100, { targetType: "satellite" }),
    quest("Jupiter", 72),
  ]);

  assert.equal(result.quest?.target, "Jupiter");
  assert.equal(result.quest?.questKind, "evening");
  assert.equal(result.assignment?.target, "Jupiter");
});

test("rejects stale, daytime, and low-confidence candidates", () => {
  const now = localDate(6);
  const staleAt = new Date(now.getTime() - 31 * 60 * 1000);
  const result = select(
    [
      quest("stale", 90, { now: staleAt }),
      quest("daylight", 90, { now, isDay: true }),
      quest("uncertain", 59, { now }),
    ],
    { now },
  );
  assert.equal(result.quest, null);
  assert.equal(result.assignment, null);
});

test("keeps priority for a never discovered target", () => {
  const result = select([quest("known", 100), quest("new", 60)], {
    context: { discoveredTargets: new Set(["known"]) },
  });
  assert.equal(result.quest?.target, "new");
});

test("beginners prefer an easy naked-eye target with a strong score", () => {
  const result = select(
    [
      quest("galaxy", 96, {
        targetType: "galaxy",
        difficulty: "medium",
        requiredGear: "binoculars_recommended",
      }),
      quest("Vega", 72, { targetType: "star", difficulty: "easy" }),
    ],
    { totalXp: 25 },
  );
  assert.equal(result.quest?.target, "Vega");
});

test("same-night assignment stays on target while fresh coordinates are replaced", () => {
  const now = localDate(6, 23);
  const nightKey = getLocalNightKey(now);
  const existingAssignment = {
    version: 1,
    nightKey,
    target: "Vega",
    targetType: "star",
    assignedAt: localDate(6, 21).toISOString(),
    lastMatchedAt: localDate(6, 21).toISOString(),
    status: "active",
  };
  const result = select([quest("Vega", 78, { now, targetType: "star", azimuth: 245 })], {
    now,
    existingAssignment,
  });

  assert.equal(result.assignment?.assignedAt, existingAssignment.assignedAt);
  assert.equal(result.quest?.azimuth, 245);
  assert.notEqual(result.quest?.id, "stored-quest");
});

test("never guides from an assignment when no fresh quest matches", () => {
  const now = localDate(6);
  const assignment = {
    version: 1,
    nightKey: getLocalNightKey(now),
    target: "Vega",
    targetType: "star",
    assignedAt: now.toISOString(),
    lastMatchedAt: now.toISOString(),
    status: "active",
  };
  const result = select([], { now, existingAssignment: assignment });
  assert.equal(result.quest, null);
  assert.strictEqual(result.assignment, assignment);
});

test("replaces an unavailable active target, but never a completed same-night quest", () => {
  const now = localDate(6);
  const assignment = {
    version: 1,
    nightKey: getLocalNightKey(now),
    target: "Vega",
    targetType: "star",
    assignedAt: now.toISOString(),
    lastMatchedAt: now.toISOString(),
    status: "active",
  };
  const replacement = select([quest("Jupiter", 80)], { now, existingAssignment: assignment });
  assert.equal(replacement.quest?.target, "Jupiter");
  assert.equal(replacement.wasReassigned, true);

  const completed = select([quest("Jupiter", 80)], {
    now,
    existingAssignment: { ...assignment, status: "completed", completedAt: now.toISOString() },
  });
  assert.equal(completed.quest, null);
  assert.equal(completed.assignment?.target, "Vega");
});

test("a new local night can receive a new assignment", () => {
  const yesterday = localDate(5);
  const now = localDate(6);
  const result = select([quest("Jupiter", 80, { now })], {
    now,
    existingAssignment: {
      version: 1,
      nightKey: getLocalNightKey(yesterday),
      target: "Vega",
      targetType: "star",
      assignedAt: yesterday.toISOString(),
      lastMatchedAt: yesterday.toISOString(),
      status: "completed",
      completedAt: yesterday.toISOString(),
    },
  });
  assert.equal(result.assignment?.nightKey, getLocalNightKey(now));
  assert.equal(result.quest?.target, "Jupiter");
});

test("seen grants the evening bonus once, while missed grants none", () => {
  const now = localDate(6);
  const nightKey = getLocalNightKey(now);
  const eveningQuest = {
    ...quest("Vega", 80, { now, targetType: "star" }),
    questKind: "evening",
    eveningQuestNightKey: nightKey,
  };
  const empty = createEmptyProgressProfile();
  const missed = applyQuestReward(empty, eveningQuest, "missed", now);
  assert.equal(missed.reward.eveningQuestBonusXp, 0);
  assert.equal(missed.profile.eveningQuestCompletions.length, 0);

  const seen = applyQuestReward(empty, eveningQuest, "seen", now);
  assert.equal(seen.reward.eveningQuestBonusXp, EVENING_QUEST_BONUS_XP);
  assert.equal(seen.reward.isEveningQuestCompleted, true);
  assert.equal(seen.profile.eveningQuestCompletions.length, 1);
  assert.equal(seen.profile.eveningQuestCompletionCount, 1);

  const duplicate = applyQuestReward(
    seen.profile,
    { ...eveningQuest, target: "Jupiter" },
    "seen",
    now,
  );
  assert.equal(duplicate.reward.eveningQuestBonusXp, 0);
  assert.equal(duplicate.profile.eveningQuestCompletions.length, 1);
  assert.equal(duplicate.profile.eveningQuestCompletionCount, 1);
});

test("observation persistence completes only a successful evening assignment", async () => {
  const missedAt = localDate(7);
  const missedNightKey = getLocalNightKey(missedAt);
  const missedAssignment = {
    version: 1,
    nightKey: missedNightKey,
    target: "Vega",
    targetType: "star",
    assignedAt: missedAt.toISOString(),
    lastMatchedAt: missedAt.toISOString(),
    status: "active",
  };
  saveEveningQuestAssignment(missedAssignment);
  const missedResult = await addObservation(
    {
      ...quest("Vega", 80, { now: missedAt, targetType: "star" }),
      questKind: "evening",
      eveningQuestNightKey: missedNightKey,
    },
    "missed",
    undefined,
    undefined,
    missedAt,
  );
  assert.equal(missedResult.reward.eveningQuestBonusXp, 0);
  assert.equal(getEveningQuestAssignment()?.status, "active");

  const seenAt = localDate(8);
  const seenNightKey = getLocalNightKey(seenAt);
  clearExpiredEveningQuestAssignment(seenNightKey);
  saveEveningQuestAssignment({
    ...missedAssignment,
    nightKey: seenNightKey,
    assignedAt: seenAt.toISOString(),
    lastMatchedAt: seenAt.toISOString(),
  });
  const seenResult = await addObservation(
    {
      ...quest("Vega", 80, { now: seenAt, targetType: "star" }),
      questKind: "evening",
      eveningQuestNightKey: seenNightKey,
    },
    "seen",
    undefined,
    undefined,
    seenAt,
  );
  assert.equal(seenResult.reward.eveningQuestBonusXp, EVENING_QUEST_BONUS_XP);
  assert.equal(seenResult.observation.questKind, "evening");
  assert.equal(getEveningQuestAssignment()?.status, "completed");
});

test("old profiles migrate and assignment storage falls back to memory", () => {
  const originalWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };

  values.set(
    "skyquest.progression.v1",
    JSON.stringify({
      version: 1,
      totalXp: 40,
      discoveredTargets: [],
      unlockedAchievements: [],
      rewardHistory: [],
      currentStreak: 0,
      longestStreak: 0,
      lastObservationNightKey: null,
      streakFreezeCount: 1,
      lastStreakFreezeUsedNightKey: null,
      lastFreezeRegenerationKey: null,
      updatedAt: localDate(6).toISOString(),
    }),
  );
  assert.deepEqual(getProgressProfile().eveningQuestCompletions, []);
  assert.equal(getProgressProfile().eveningQuestCompletionCount, 0);

  const now = localDate(6);
  const assignment = {
    version: 1,
    nightKey: getLocalNightKey(now),
    target: "Vega",
    targetType: "star",
    assignedAt: now.toISOString(),
    lastMatchedAt: now.toISOString(),
    status: "active",
  };
  globalThis.window.localStorage.setItem = () => {
    throw new Error("blocked");
  };
  saveEveningQuestAssignment(assignment);
  assert.deepEqual(getEveningQuestAssignment(), assignment);
  assert.equal(clearExpiredEveningQuestAssignment("2026-07-07"), null);

  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("local-night boundaries switch at noon, not at UTC midnight", () => {
  assert.equal(getLocalNightKey(localDate(6, 11)), "2026-07-05");
  assert.equal(getLocalNightKey(localDate(6, 12)), "2026-07-06");
});

test("dashboard, feedback, and journal expose evening state without marking alternatives", () => {
  assert.match(dashboardSource, /Ta quête du soir/);
  assert.match(dashboardSource, /Bonus \+25 Éclats d’étoile/);
  assert.match(dashboardSource, /evening=\{Boolean\(activeEveningQuest\)\}/);
  assert.doesNotMatch(dashboardSource, /displayedAlternativeQuests\.map[\s\S]{0,500}evening=/);
  assert.match(feedbackSource, /Quête du soir accomplie/);
  assert.match(feedbackSource, /bonus du soir/);
  assert.match(journalSource, /observation\.questKind === "evening"/);
});
