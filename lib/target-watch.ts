import { discoveryAtlasEntries } from "./discovery-atlas.ts";
import type { QuestTargetType } from "@/lib/types";

export type WatchableTarget = { target: string; targetType: QuestTargetType };

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("fr-FR");
}

export function resolveWatchableTarget(target: string): WatchableTarget | null {
  const normalized = normalize(target);
  const entry = discoveryAtlasEntries.find(
    (candidate) =>
      normalize(candidate.target) === normalized || normalize(candidate.id) === normalized,
  );
  if (!entry) return null;
  return { target: entry.target, targetType: entry.targetType };
}

export function getWatchableTargetLabel(target: string): string {
  const normalized = normalize(target);
  return (
    discoveryAtlasEntries.find((entry) => normalize(entry.target) === normalized)?.frenchName ??
    target
  );
}
