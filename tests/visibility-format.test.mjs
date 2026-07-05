import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const dashboardSource = source("../components/dashboard/Dashboard.tsx");
const journalSource = source("../components/JournalList.tsx");
const badgeSource = source("../components/VisibilityBadge.tsx");
const memorySource = source("../components/ObservationMemoryCard.tsx");
const canvasSource = source("../lib/observation-card.ts");
const tonightSource = source("../app/tonight/page.tsx");
const visibilityExplanationSource = source("../components/VisibilityExplanationCard.tsx");
const visualSources = [
  dashboardSource,
  journalSource,
  badgeSource,
  memorySource,
  canvasSource,
  tonightSource,
  visibilityExplanationSource,
].join("\n");

test("dashboard keeps the average visibility index on a 100-point scale", () => {
  assert.doesNotMatch(dashboardSource, /averageVisibility\s*\/\s*10/);
  assert.match(dashboardSource, /formatVisibilityScore\(averageVisibility, "compact"\)/);
  assert.match(dashboardSource, />Indice ciel</);
  assert.match(
    dashboardSource,
    /Indice moyen des quêtes disponibles : \$\{normalizeVisibilityScore\(averageVisibility\)\} sur 100/,
  );
});

test("visibility scores never render as percentages", () => {
  assert.doesNotMatch(visualSources, /visibilityScore[^\n]{0,80}%/i);
  assert.doesNotMatch(visualSources, /%\s*visibilité|visibilité\s*[^\n]{0,30}%/i);
  assert.match(journalSource, /formatVisibilityScore\(observation\.visibilityScore\)/);
  assert.match(badgeSource, /formatVisibilityScore\(score\)/);
});

test("real weather percentages and visual progress widths remain percentages", () => {
  assert.match(dashboardSource, /Math\.round\(weather\.cloudCover\)\}%/);
  assert.match(tonightSource, /Math\.round\(bestHour\?\.relativeHumidity \?\? 0\)\}%/);
  assert.match(tonightSource, /skyWindow\.moonIlluminationPercent\}%/);
  assert.match(tonightSource, /style=\{\{ width: `\$\{hour\.score\}%` \}\}/);
});

test("memory canvas and accessible copy use canonical visibility formats", () => {
  assert.match(canvasSource, /formatVisibilityScore\(observation\.visibilityScore\)/);
  assert.doesNotMatch(canvasSource, /% visibilité/);
  assert.match(memorySource, /formatVisibilityScoreForAccessibility/);
  assert.match(journalSource, /formatVisibilityScoreForAccessibility/);
  assert.match(badgeSource, /formatVisibilityScoreForAccessibility/);
  assert.match(tonightSource, /formatVisibilityScoreForAccessibility\(hour\.score\)/);
});
