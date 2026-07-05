import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVisibilityScore,
  formatVisibilityScore,
  formatVisibilityScoreForAccessibility,
  getVisibilityLabel,
  normalizeVisibilityScore,
} from "../lib/visibility.ts";

test("visibility score formatting uses a bounded editorial index", () => {
  assert.equal(formatVisibilityScore(72), "Indice 72/100");
  assert.equal(formatVisibilityScore(72, "compact"), "72/100");
  assert.equal(formatVisibilityScore(72.6), "Indice 73/100");
  assert.equal(normalizeVisibilityScore(-12), 0);
  assert.equal(normalizeVisibilityScore(140), 100);
  assert.equal(normalizeVisibilityScore(Number.NaN), 0);
  assert.equal(normalizeVisibilityScore(Number.POSITIVE_INFINITY), 0);
  assert.equal(formatVisibilityScoreForAccessibility(72.4), "Indice de visibilité : 72 sur 100");
});

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
