import { isQuestFresh } from "./quest-freshness.ts";
import type { RankedQuest } from "@/lib/quest-ranking";
import type { EveningQuestAssignment, SkyQuest } from "@/lib/types";

export type EveningQuestSelection = {
  assignment: EveningQuestAssignment | null;
  quest: SkyQuest | null;
  wasReassigned: boolean;
};

type SelectEveningQuestInput = {
  rankedQuests: readonly RankedQuest[];
  existingAssignment: EveningQuestAssignment | null;
  nightKey: string;
  totalXp: number;
  now: Date;
};

function normalizeTarget(target: string): string {
  return target.trim().toLocaleLowerCase("fr-FR");
}

function isReliableCandidate(quest: SkyQuest, now: Date): boolean {
  return (
    quest.visibilityScore >= 60 &&
    isQuestFresh(quest, now) &&
    quest.targetType !== "free_observation" &&
    quest.targetType !== "satellite" &&
    quest.weather?.isDay !== true &&
    quest.target.trim().length > 0
  );
}

function chooseCandidate(candidates: readonly RankedQuest[], totalXp: number): RankedQuest | null {
  if (candidates.length === 0) return null;

  const newTargets = candidates.filter(
    ({ personalizationBadge }) => personalizationBadge === "new_target",
  );
  const improvedRetries = candidates.filter(
    ({ personalizationBadge }) => personalizationBadge === "improved_retry",
  );
  const prioritized =
    newTargets.length > 0
      ? newTargets
      : improvedRetries.length > 0
        ? improvedRetries
        : [...candidates];
  if (totalXp >= 100) return prioritized[0] ?? null;

  let preferred = [...prioritized];
  const easyAndAccessible = preferred.filter(
    ({ quest }) =>
      quest.difficulty === "easy" &&
      quest.targetType !== "galaxy" &&
      quest.requiredGear === "naked_eye",
  );
  if (easyAndAccessible.length > 0) {
    preferred = easyAndAccessible;
  } else {
    const easy = preferred.filter(({ quest }) => quest.difficulty === "easy");
    if (easy.length > 0) preferred = easy;
  }

  const strong = preferred.filter(({ quest }) => quest.visibilityScore >= 70);
  return (strong.length > 0 ? strong : preferred)[0] ?? null;
}

function asEveningQuest(quest: SkyQuest, nightKey: string): SkyQuest {
  return {
    ...quest,
    questKind: "evening",
    eveningQuestNightKey: nightKey,
  };
}

export function selectEveningQuest({
  rankedQuests,
  existingAssignment,
  nightKey,
  totalXp,
  now,
}: SelectEveningQuestInput): EveningQuestSelection {
  const candidates = rankedQuests.filter(({ quest }) => isReliableCandidate(quest, now));
  const currentAssignment = existingAssignment?.nightKey === nightKey ? existingAssignment : null;

  if (currentAssignment?.status === "completed") {
    return { assignment: currentAssignment, quest: null, wasReassigned: false };
  }

  if (currentAssignment) {
    const match = candidates.find(
      ({ quest }) => normalizeTarget(quest.target) === normalizeTarget(currentAssignment.target),
    );
    if (match) {
      return {
        assignment: { ...currentAssignment, lastMatchedAt: now.toISOString() },
        quest: asEveningQuest(match.quest, nightKey),
        wasReassigned: false,
      };
    }
  }

  const selected = chooseCandidate(candidates, totalXp);
  if (!selected) {
    return { assignment: currentAssignment, quest: null, wasReassigned: false };
  }

  const timestamp = now.toISOString();
  const assignment: EveningQuestAssignment = {
    version: 1,
    nightKey,
    target: selected.quest.target,
    targetType: selected.quest.targetType,
    assignedAt: timestamp,
    lastMatchedAt: timestamp,
    status: "active",
  };

  return {
    assignment,
    quest: asEveningQuest(selected.quest, nightKey),
    wasReassigned: currentAssignment !== null,
  };
}
