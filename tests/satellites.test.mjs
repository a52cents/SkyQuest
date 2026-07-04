import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectRecentStarlinkLaunches } from "../lib/satellites.ts";

const questGeneratorSource = readFileSync(
  new URL("../lib/quest-generator.ts", import.meta.url),
  "utf8",
);

function element(objectId, epoch, catalogId) {
  return { OBJECT_ID: objectId, EPOCH: epoch, NORAD_CAT_ID: catalogId };
}

test("Starlink calculations retain only the two most recent launches", () => {
  const selected = selectRecentStarlinkLaunches([
    element("2026-100A", "2026-06-01T00:00:00Z", 1),
    element("2026-101A", "2026-06-02T00:00:00Z", 2),
    element("2026-102A", "2026-06-03T00:00:00Z", 3),
    element("2026-102B", "2026-06-03T00:01:00Z", 4),
  ]);

  assert.deepEqual(
    selected.map((launch) => launch[0].OBJECT_ID.slice(0, 8)),
    ["2026-102", "2026-101"],
  );
});

test("satellite quests keep cautious wording for brightness", () => {
  assert.match(questGeneratorSource, /Cherche un train Starlink/);
  assert.match(questGeneratorSource, /luminosité réelle reste incertaine/);
  assert.match(questGeneratorSource, /satellitePasses = \[\]/);
});
