import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getTargetLightingPracticeAdjustment,
  normalizeMunicipalityCode,
} from "../lib/lighting-practices.ts";

const generatedIndex = JSON.parse(
  readFileSync(new URL("../lib/data/cerema-lighting-practices-2026.json", import.meta.url), "utf8"),
);
const routeSource = readFileSync(
  new URL("../app/api/lighting-practice/route.ts", import.meta.url),
  "utf8",
);

test("generated Cerema index keeps known municipal signals and its source version", () => {
  assert.equal(generatedIndex.version, "2026-06-16");
  assert.deepEqual(generatedIndex.municipalities["01004"], ["E", "2022-11"]);
  assert.deepEqual(generatedIndex.municipalities["75056"], ["R", "2022-10"]);
  assert.ok(Object.keys(generatedIndex.municipalities).length > 27_000);
});

test("municipal arrondissement codes normalize to their parent municipality", () => {
  assert.equal(normalizeMunicipalityCode("75104"), "75056");
  assert.equal(normalizeMunicipalityCode("13208"), "13055");
  assert.equal(normalizeMunicipalityCode("69385"), "69123");
  assert.equal(normalizeMunicipalityCode("01004"), "01004");
});

test("municipal lighting affects weak targets more than planets", () => {
  const estimate = {
    category: "outside_light_footprint",
    municipalityCode: "01019",
    municipalityName: "Arbent",
    label: "Peu de lumière détectée",
    shortAdvice: "Signal prudent",
    scoreAdjustment: 5,
    source: "cerema-2026",
    confidence: "low",
  };

  assert.equal(getTargetLightingPracticeAdjustment("galaxy", estimate), 5);
  assert.equal(getTargetLightingPracticeAdjustment("planet", estimate), 1);
  assert.equal(getTargetLightingPracticeAdjustment("free_observation", estimate), 0);
});

test("API Geo receives only coordinates rounded to two decimals", () => {
  assert.match(routeSource, /Math\.round\(parsed \* 100\) \/ 100/);
  assert.match(routeSource, /https:\/\/geo\.api\.gouv\.fr\/communes/);
  assert.match(routeSource, /latitude\.toFixed\(2\)/);
  assert.match(routeSource, /longitude\.toFixed\(2\)/);
});
