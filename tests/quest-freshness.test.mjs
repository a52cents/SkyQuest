import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isGeneratedAtFresh, isQuestFresh, SKY_DATA_TTL_MS } from "../lib/quest-freshness.ts";

const generatorSource = readFileSync(new URL("../lib/quest-generator.ts", import.meta.url), "utf8");
const dashboardSource = readFileSync(
  new URL("../components/dashboard/Dashboard.tsx", import.meta.url),
  "utf8",
);
const guidePageSource = readFileSync(
  new URL("../app/quest/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("sky analyses and active quests expire after thirty minutes", () => {
  const generatedAt = "2026-07-04T20:00:00.000Z";
  assert.equal(SKY_DATA_TTL_MS, 30 * 60 * 1000);
  assert.equal(isGeneratedAtFresh(generatedAt, new Date("2026-07-04T20:29:59.999Z")), true);
  assert.equal(isGeneratedAtFresh(generatedAt, new Date("2026-07-04T20:30:00.000Z")), false);
  assert.equal(isGeneratedAtFresh(undefined, new Date("2026-07-04T20:10:00.000Z")), false);
  assert.equal(isGeneratedAtFresh(generatedAt, new Date("2026-07-04T19:59:59.000Z")), false);
});

test("quests without generatedAt from older storage versions are expired", () => {
  assert.equal(isQuestFresh({ generatedAt: undefined }, new Date()), false);
});

test("every quest constructor records generatedAt", () => {
  assert.equal((generatorSource.match(/generatedAt: now\.toISOString\(\)/g) ?? []).length, 5);
});

test("expired analyses and quest pages ask the user to relaunch Now", () => {
  assert.match(dashboardSource, /SKY_DATA_TTL_MS/);
  assert.match(dashboardSource, /Relancer Maintenant pour actualiser le ciel/);
  assert.match(guidePageSource, /Cette quête a expiré[\s\S]+Relancer Maintenant/);
  assert.match(guidePageSource, /setInterval\(refreshAvailability, 15_000\)/);
});
