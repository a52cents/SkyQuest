import assert from "node:assert/strict";
import test from "node:test";
import { calculateVisibilityScore, getVisibilityLabel } from "../lib/visibility.ts";

test("visibility labels keep their editorial thresholds", () => {
  assert.equal(getVisibilityLabel(80), "Excellente chance");
  assert.equal(getVisibilityLabel(79), "Bonne chance");
  assert.equal(getVisibilityLabel(60), "Bonne chance");
  assert.equal(getVisibilityLabel(59), "Tentable");
  assert.equal(getVisibilityLabel(40), "Tentable");
  assert.equal(getVisibilityLabel(39), "Pas conseillé");
});

test("altitude and clouds materially affect a bright target score", () => {
  const clearHighMoon = calculateVisibilityScore({
    object: { name: "Moon", altitude: 35, azimuth: 180, magnitudeHint: "very-bright" },
    weather: { cloudCover: 10, isDay: false },
    sunAltitude: -12,
  });
  const cloudyLowMoon = calculateVisibilityScore({
    object: { name: "Moon", altitude: 8, azimuth: 180, magnitudeHint: "very-bright" },
    weather: { cloudCover: 90, isDay: false },
    sunAltitude: -12,
  });

  assert.ok(clearHighMoon >= 80);
  assert.ok(cloudyLowMoon < 50);
});
