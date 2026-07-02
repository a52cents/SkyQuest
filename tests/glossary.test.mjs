import assert from "node:assert/strict";
import test from "node:test";
import {
  filterGlossaryTerms,
  getGlossaryTerm,
  glossaryCategories,
  glossaryTerms,
} from "../lib/glossary.ts";

test("glossary contains the requested beginner vocabulary", () => {
  assert.ok(glossaryTerms.length >= 20);
  assert.equal(glossaryCategories.length, 5);
  for (const id of ["asterisme", "amas-etoiles", "magnitude", "azimut", "altitude", "telescope"]) {
    const item = getGlossaryTerm(id);
    assert.ok(item, `missing glossary term: ${id}`);
    assert.ok(item.shortDefinition.length > 20);
  }
});

test("local search ignores case and French accents", () => {
  assert.ok(filterGlossaryTerms("NEBULEUSE").some((item) => item.id === "nebuleuse"));
  assert.ok(filterGlossaryTerms("étoiles").some((item) => item.id === "amas-etoiles"));
  assert.ok(filterGlossaryTerms("etoiles").some((item) => item.id === "amas-etoiles"));
});

test("category and query filters can be combined", () => {
  const results = filterGlossaryTerms("objet", "observation");
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.category === "observation"));
});
