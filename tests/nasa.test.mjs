import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseApod, parseClosestAsteroid, summarizeSpaceWeather } from "../lib/nasa.ts";

test("APOD keeps a usable thumbnail for videos", () => {
  const apod = parseApod({
    title: "A sky video",
    date: "2026-07-03",
    explanation: "A short explanation.",
    media_type: "video",
    url: "https://example.test/video",
    thumbnail_url: "https://example.test/thumb.jpg",
  });

  assert.equal(apod?.imageUrl, "https://example.test/thumb.jpg");
  assert.equal(apod?.sourceUrl, "https://apod.nasa.gov/apod/ap260703.html");
});

test("NeoWs summary selects the closest approach in the feed", () => {
  const asteroid = parseClosestAsteroid({
    near_earth_objects: {
      "2026-07-03": [
        {
          name: "(Far rock)",
          nasa_jpl_url: "https://example.test/far",
          is_potentially_hazardous_asteroid: false,
          estimated_diameter: {
            meters: { estimated_diameter_min: 10, estimated_diameter_max: 30 },
          },
          close_approach_data: [
            { close_approach_date: "2026-07-03", miss_distance: { kilometers: "900000" } },
          ],
        },
        {
          name: "Near rock",
          nasa_jpl_url: "https://example.test/near",
          is_potentially_hazardous_asteroid: true,
          estimated_diameter: {
            meters: { estimated_diameter_min: 20, estimated_diameter_max: 40 },
          },
          close_approach_data: [
            { close_approach_date: "2026-07-04", miss_distance: { kilometers: "400000" } },
          ],
        },
      ],
    },
  });

  assert.equal(asteroid?.name, "Near rock");
  assert.equal(asteroid?.diameterMeters, 30);
  assert.equal(asteroid?.missDistanceKm, 400_000);
});

test("aurora wording stays cautious when DONKI reports a strong Kp index", () => {
  const result = summarizeSpaceWeather(
    [
      {
        startTime: "2026-07-02T20:00:00Z",
        link: "https://example.test/storm",
        allKpIndex: [{ KpIndex: 6 }],
      },
    ],
    [],
  );

  assert.equal(result.aurora.level, "notable");
  assert.equal(result.aurora.maxKp, 6);
  assert.match(result.aurora.summary, /sans garantie locale/);
});

test("content security policy permits APOD and video thumbnails only from known hosts", () => {
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");

  assert.match(middleware, /img-src[^\n]+https:\/\/apod\.nasa\.gov/);
  assert.match(middleware, /img-src[^\n]+https:\/\/img\.youtube\.com/);
  assert.doesNotMatch(middleware, /img-src[^\n]+\shttps:\s/);
});
