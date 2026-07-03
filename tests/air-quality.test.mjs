import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fetchAirQualityNow,
  getAirTransparencyEstimate,
  getTargetAirQualityPenalty,
} from "../lib/air-quality.ts";

const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");

test("air transparency uses aerosol haze and particulate matter without over-penalizing", () => {
  assert.equal(
    getAirTransparencyEstimate({ aerosolOpticalDepth: 0.08, pm2_5: 5 }).weakTargetPenalty,
    0,
  );
  assert.equal(
    getAirTransparencyEstimate({ aerosolOpticalDepth: 0.6, pm2_5: 80 }).weakTargetPenalty,
    10,
  );
  assert.equal(getAirTransparencyEstimate({ aerosolOpticalDepth: 0.3 }).level, "slight-haze");
});

test("loaded air affects a galaxy more than a planet", () => {
  const loadedAir = { aerosolOpticalDepth: 0.6, pm2_5: 80 };
  assert.equal(getTargetAirQualityPenalty("galaxy", loadedAir), 10);
  assert.equal(getTargetAirQualityPenalty("planet", loadedAir), 4);
  assert.equal(getTargetAirQualityPenalty("free_observation", loadedAir), 0);
});

test("Open-Meteo request rounds coordinates and maps current CAMS values", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        current: {
          pm10: 18,
          pm2_5: 9,
          european_aqi: 32,
          aerosol_optical_depth: 0.14,
          dust: 2,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const airQuality = await fetchAirQualityNow(48.85661, 2.35221);
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get("latitude"), "48.86");
    assert.equal(url.searchParams.get("longitude"), "2.35");
    assert.equal(airQuality.europeanAqi, 32);
    assert.equal(airQuality.aerosolOpticalDepth, 0.14);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("security policy allows only the dedicated Open-Meteo air quality origin", () => {
  assert.match(middlewareSource, /https:\/\/air-quality-api\.open-meteo\.com/);
});
