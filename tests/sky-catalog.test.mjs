import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { catalogSkyObjects, getCatalogSkyObject } from "../lib/sky-catalog.ts";

test("every catalog object has a local credited image and detail content", () => {
  assert.ok(catalogSkyObjects.length > 0);

  for (const object of catalogSkyObjects) {
    assert.equal(getCatalogSkyObject(object.id), object);
    assert.match(object.image.src, /^\/catalog\/[a-z-]+\.jpg$/);
    assert.equal(existsSync(new URL(`../public${object.image.src}`, import.meta.url)), true);
    assert.ok(object.image.credit.length > 0);
    assert.match(object.image.sourceUrl, /^https:\/\//);
    assert.ok(object.introduction.length > 50);
    assert.ok(object.howToFind.length > 50);
    assert.ok(object.whatToExpect.length > 50);
    assert.ok(object.quickFacts.length >= 3);
  }
});

test("unknown catalog objects stay unavailable", () => {
  assert.equal(getCatalogSkyObject("not-in-the-sky"), undefined);
});
