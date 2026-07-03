import type { SkyQuest } from "@/lib/types";

export const SKY_DATA_TTL_MS = 30 * 60 * 1000;

export function isGeneratedAtFresh(generatedAt: string | undefined, now = new Date()): boolean {
  if (!generatedAt) return false;

  const generatedTime = new Date(generatedAt).getTime();
  const ageMs = now.getTime() - generatedTime;
  return Number.isFinite(generatedTime) && ageMs >= 0 && ageMs < SKY_DATA_TTL_MS;
}

export function isQuestFresh(quest: SkyQuest, now = new Date()): boolean {
  return isGeneratedAtFresh(quest.generatedAt, now);
}
