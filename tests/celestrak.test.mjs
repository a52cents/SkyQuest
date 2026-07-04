import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerSource = readFileSync(new URL("../lib/celestrak.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/iss-pass/route.ts", import.meta.url), "utf8");

test("CelesTrak uses the recommended OMM JSON query and a two-hour cache", () => {
  assert.match(providerSource, /CATNR=25544&FORMAT=JSON/);
  assert.match(providerSource, /CELESTRAK_CACHE_SECONDS = 2 \* 60 \* 60/);
  assert.match(providerSource, /next: \{ revalidate: CELESTRAK_CACHE_SECONDS \}/);
});

test("observer coordinates stay in the ISS pass route", () => {
  assert.doesNotMatch(providerSource, /latitude|longitude/i);
  assert.match(routeSource, /calculateNextSatelliteVisiblePass\(\{/);
  assert.match(routeSource, /"Cache-Control": "private, no-store"/);
});
