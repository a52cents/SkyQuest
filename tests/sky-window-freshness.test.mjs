import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BEST_SKY_WINDOW_CLOCK_SKEW_TOLERANCE_MS,
  BEST_SKY_WINDOW_TTL_MS,
  ESTIMATED_BEST_SKY_WINDOW_TTL_MS,
  getBestSkyWindowValidity,
  isBestSkyWindowFresh,
} from "../lib/sky-window-freshness.ts";

const NOW = new Date("2026-07-06T20:00:00.000Z");

function skyWindow(overrides = {}) {
  return {
    generatedAt: "2026-07-06T19:30:00.000Z",
    startsAt: "2026-07-06T21:00:00.000Z",
    endsAt: "2026-07-06T23:00:00.000Z",
    score: 72,
    bestTargets: ["Vega"],
    moonIlluminationPercent: 45,
    moonPhaseLabel: "Premier quartier",
    hours: [],
    timezone: "Europe/Paris",
    isEstimated: false,
    ...overrides,
  };
}

test("fresh future and currently active sky windows are accepted", () => {
  assert.equal(isBestSkyWindowFresh(skyWindow(), NOW), true);
  assert.equal(
    isBestSkyWindowFresh(
      skyWindow({
        startsAt: "2026-07-06T19:00:00.000Z",
        endsAt: "2026-07-06T20:30:00.000Z",
      }),
      NOW,
    ),
    true,
  );
});

test("ended windows and invalid ranges are rejected", () => {
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({ startsAt: "2026-07-06T19:00:00.000Z", endsAt: NOW.toISOString() }),
      NOW,
    ).reason,
    "expired",
  );
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({
        startsAt: "2026-07-06T23:00:00.000Z",
        endsAt: "2026-07-06T23:00:00.000Z",
      }),
      NOW,
    ).reason,
    "invalid_range",
  );
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({
        startsAt: "2026-07-07T00:00:00.000Z",
        endsAt: "2026-07-06T23:00:00.000Z",
      }),
      NOW,
    ).reason,
    "invalid_range",
  );
});

test("real and estimated forecasts use separate freshness limits", () => {
  assert.equal(BEST_SKY_WINDOW_TTL_MS, 3 * 60 * 60 * 1_000);
  assert.equal(ESTIMATED_BEST_SKY_WINDOW_TTL_MS, 60 * 60 * 1_000);
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({
        generatedAt: new Date(NOW.getTime() - BEST_SKY_WINDOW_TTL_MS - 1).toISOString(),
      }),
      NOW,
    ).reason,
    "stale",
  );
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({
        generatedAt: new Date(NOW.getTime() - ESTIMATED_BEST_SKY_WINDOW_TTL_MS - 1).toISOString(),
        isEstimated: true,
      }),
      NOW,
    ).reason,
    "stale",
  );
});

test("small future clock skew is accepted and excessive skew is rejected", () => {
  assert.equal(
    isBestSkyWindowFresh(
      skyWindow({
        generatedAt: new Date(
          NOW.getTime() + BEST_SKY_WINDOW_CLOCK_SKEW_TOLERANCE_MS,
        ).toISOString(),
      }),
      NOW,
    ),
    true,
  );
  assert.equal(
    getBestSkyWindowValidity(
      skyWindow({
        generatedAt: new Date(
          NOW.getTime() + BEST_SKY_WINDOW_CLOCK_SKEW_TOLERANCE_MS + 1,
        ).toISOString(),
      }),
      NOW,
    ).reason,
    "future_generation",
  );
});

test("invalid generated, start, end, or current dates fail safely", () => {
  for (const field of ["generatedAt", "startsAt", "endsAt"]) {
    assert.equal(
      getBestSkyWindowValidity(skyWindow({ [field]: "not-a-date" }), NOW).reason,
      "invalid_date",
    );
  }
  assert.equal(getBestSkyWindowValidity(skyWindow(), new Date("invalid")).reason, "invalid_date");
});

test("storage, dashboard, Tonight, and reminder API enforce freshness boundaries", () => {
  const storageSource = readFileSync(new URL("../lib/storage.ts", import.meta.url), "utf8");
  const dashboardSource = readFileSync(
    new URL("../components/dashboard/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const tonightSource = readFileSync(new URL("../app/tonight/page.tsx", import.meta.url), "utf8");
  const reminderRouteSource = readFileSync(
    new URL("../app/api/push/reminder/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(storageSource, /getBestSkyWindowStatus\(now = new Date\(\)\)/);
  assert.match(storageSource, /memoryBestSkyWindow = null;[\s\S]+removeStoredValue/);
  assert.match(storageSource, /localStorage\.removeItem\(key\)/);
  assert.match(storageSource, /catch \{[\s\S]+failedStorageKeys\.add\(key\)/);
  assert.match(dashboardSource, /isBestSkyWindowFresh\(cachedAnalysis\.bestSkyWindow\)/);
  assert.match(dashboardSource, /setBestSkyWindow\(cachedBestSkyWindow\)/);
  assert.match(tonightSource, /Ton précédent créneau a expiré/);
  assert.match(tonightSource, /visibilitychange/);
  assert.match(tonightSource, /window\.setTimeout/);
  assert.match(tonightSource, /Math\.min\(endsAtMs, generatedAtMs \+ ttlMs\)/);
  assert.match(tonightSource, /if \(!isBestSkyWindowFresh\(skyWindow, now\)\)/);
  assert.match(tonightSource, /saveBestSkyWindow\(result\);\s+setSkyWindow\(result\)/);
  assert.match(reminderRouteSource, /windowStartsAt\.getTime\(\) >= windowEndsAt\.getTime\(\)/);
  assert.match(reminderRouteSource, /windowEndsAt\.getTime\(\) <= now/);
  assert.match(reminderRouteSource, /reminderAt\.getTime\(\) > windowEndsAt\.getTime\(\)/);
  assert.match(reminderRouteSource, /status: 400/);
});
