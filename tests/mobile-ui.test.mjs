import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardCss = readFileSync(
  new URL("../components/dashboard/Dashboard.css", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("../components/dashboard/Dashboard.tsx", import.meta.url),
  "utf8",
);
const landingCss = readFileSync(
  new URL("../components/marketing/LandingPage.css", import.meta.url),
  "utf8",
);
const onboardingSource = readFileSync(
  new URL("../components/Onboarding.tsx", import.meta.url),
  "utf8",
);
const pushCardSource = readFileSync(
  new URL("../components/PushPermissionCard.tsx", import.meta.url),
  "utf8",
);

test("screen styles do not erase reusable component spacing", () => {
  assert.doesNotMatch(dashboardCss, /\.sky-dashboard \*\s*\{[^}]*margin:\s*0[^}]*padding:\s*0/s);
  assert.match(landingCss, /\.marketing-landing > section\s*\{/);
  assert.doesNotMatch(landingCss, /\.marketing-landing section\s*\{/);
});

test("mobile onboarding stays concise and adapts to short screens", () => {
  assert.match(onboardingSource, /type OnboardingStep = 1 \| 2/);
  assert.match(onboardingSource, /@media\(min-height:720px\)/);
  assert.match(onboardingSource, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/);
});

test("notification preferences are hidden behind an explicit disclosure", () => {
  assert.match(pushCardSource, /aria-expanded=\{showSettings\}/);
  assert.match(pushCardSource, /showSettings \? \(/);
  assert.match(pushCardSource, /Position approximative uniquement/);
});

test("sky explanations share one compact disclosure below the condition tiles", () => {
  assert.match(dashboardSource, /<details className="sky-insights-details">/);
  assert.match(dashboardSource, /Indice de visibilité · Qualité du ciel/);
  assert.equal((dashboardSource.match(/className="sky-quality-card"/g) ?? []).length, 1);
  assert.match(dashboardCss, /\.sky-dashboard \.sky-insights-details\s*\{/);
});
