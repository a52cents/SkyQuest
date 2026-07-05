import type { Observation, SkyQuest } from "@/lib/types";

export const NEW_TARGET_BONUS = 25;
export const IMPROVED_RETRY_BONUS = 22;
export const EXPERIENCE_MATCH_BONUS = 5;
export const RETRY_IMPROVEMENT_THRESHOLD = 10;

export type QuestPersonalizationBadge = "new_target" | "improved_retry";

export type RankedQuest = {
  quest: SkyQuest;
  personalizationBadge: QuestPersonalizationBadge | null;
};

export type QuestPersonalizationContext = {
  discoveredTargets: ReadonlySet<string>;
  observations: readonly Observation[];
  totalXp: number;
};

function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}

function getLatestMissedObservation(
  quest: SkyQuest,
  observations: readonly Observation[],
): Observation | null {
  const target = normalizeTarget(quest.target);
  return observations.reduce<Observation | null>((latest, observation) => {
    if (normalizeTarget(observation.target) !== target || observation.status !== "missed") {
      return latest;
    }
    if (!latest) return observation;
    return new Date(observation.createdAt).getTime() > new Date(latest.createdAt).getTime()
      ? observation
      : latest;
  }, null);
}

function getExperienceBonus(quest: SkyQuest, totalXp: number): number {
  if (totalXp < 100 && quest.difficulty === "easy") return EXPERIENCE_MATCH_BONUS;
  if (totalXp >= 300 && quest.difficulty === "medium") return EXPERIENCE_MATCH_BONUS;
  return 0;
}

function personalizeQuest(
  quest: SkyQuest,
  context: QuestPersonalizationContext,
): RankedQuest & { recommendationScore: number } {
  const normalizedDiscoveredTargets = new Set([...context.discoveredTargets].map(normalizeTarget));
  const target = normalizeTarget(quest.target);
  const isDiscovered = normalizedDiscoveredTargets.has(target);
  const targetObservations = context.observations.filter(
    (observation) => normalizeTarget(observation.target) === target,
  );
  const latestMiss = getLatestMissedObservation(quest, targetObservations);
  const isImprovedRetry =
    !isDiscovered &&
    latestMiss !== null &&
    quest.visibilityScore >= 60 &&
    quest.visibilityScore >= latestMiss.visibilityScore + RETRY_IMPROVEMENT_THRESHOLD;
  const isNewTarget =
    quest.targetType !== "free_observation" && !isDiscovered && targetObservations.length === 0;
  const personalizationBadge = isImprovedRetry
    ? "improved_retry"
    : isNewTarget
      ? "new_target"
      : null;
  const historyBonus = isImprovedRetry ? IMPROVED_RETRY_BONUS : isNewTarget ? NEW_TARGET_BONUS : 0;

  return {
    quest,
    personalizationBadge,
    recommendationScore:
      quest.visibilityScore + historyBonus + getExperienceBonus(quest, context.totalXp),
  };
}

export function rankQuestsForRecommendation(
  quests: readonly SkyQuest[],
  context: QuestPersonalizationContext,
): RankedQuest[] {
  return quests
    .map((quest, originalIndex) => ({ ...personalizeQuest(quest, context), originalIndex }))
    .sort((left, right) => {
      const satelliteDifference =
        Number(left.quest.targetType === "satellite") -
        Number(right.quest.targetType === "satellite");
      if (satelliteDifference !== 0) return satelliteDifference;

      const scoreDifference = right.recommendationScore - left.recommendationScore;
      if (scoreDifference !== 0) return scoreDifference;

      const visibilityDifference = right.quest.visibilityScore - left.quest.visibilityScore;
      return visibilityDifference !== 0
        ? visibilityDifference
        : left.originalIndex - right.originalIndex;
    })
    .map(({ quest, personalizationBadge }) => ({ quest, personalizationBadge }));
}
