import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getNasaUpcomingEvents,
  parseApod,
  parseClosestAsteroid,
  summarizeSpaceWeather,
} from "../lib/nasa.ts";

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
            {
              close_approach_date: "2026-07-03",
              epoch_date_close_approach: Date.parse("2026-07-03T18:00:00Z"),
              miss_distance: { kilometers: "900000" },
            },
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
            {
              close_approach_date: "2026-07-04",
              epoch_date_close_approach: Date.parse("2026-07-04T18:00:00Z"),
              miss_distance: { kilometers: "400000" },
            },
          ],
        },
      ],
    },
  });

  assert.equal(asteroid?.name, "Near rock");
  assert.equal(asteroid?.diameterMeters, 30);
  assert.equal(asteroid?.missDistanceKm, 400_000);
  assert.equal(asteroid?.approachAt, "2026-07-04T18:00:00.000Z");
});

test("dashboard NASA events include only future approaches inside its horizon", () => {
  const startDate = new Date("2026-07-03T12:00:00Z");
  const highlights = {
    generatedAt: startDate.toISOString(),
    apod: null,
    spaceWeather: null,
    aurora: { level: "unknown", label: "Indisponible", summary: "", maxKp: null },
    asteroid: {
      name: "2026 AB",
      approachDate: "2026-07-04",
      approachAt: "2026-07-04T18:00:00.000Z",
      missDistanceKm: 1_200_000,
      diameterMeters: 42,
      potentiallyHazardous: false,
      sourceUrl: "https://ssd.jpl.nasa.gov/example",
    },
  };

  const events = getNasaUpcomingEvents(highlights, startDate, 60);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "near_earth_asteroid");
  assert.match(events[0].description, /non observable à l’œil nu/);

  assert.deepEqual(getNasaUpcomingEvents(highlights, new Date("2026-07-05T00:00:00Z"), 60), []);
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
