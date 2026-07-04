import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardCss = readFileSync(
  new URL("../components/dashboard/Dashboard.css", import.meta.url),
  "utf8",
);
const globalsCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const dashboardSource = readFileSync(
  new URL("../components/dashboard/Dashboard.tsx", import.meta.url),
  "utf8",
);
const landingCss = readFileSync(
  new URL("../components/marketing/LandingPage.css", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("../components/marketing/LandingPage.tsx", import.meta.url),
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
const bottomNavigationSource = readFileSync(
  new URL("../components/navigation/BottomNavigation.tsx", import.meta.url),
  "utf8",
);
const appHeaderSource = readFileSync(
  new URL("../components/AppHeader.tsx", import.meta.url),
  "utf8",
);
const tonightSource = readFileSync(new URL("../app/tonight/page.tsx", import.meta.url), "utf8");
const exploreSource = readFileSync(new URL("../app/explore/page.tsx", import.meta.url), "utf8");

test("screen styles do not erase reusable component spacing", () => {
  assert.doesNotMatch(dashboardCss, /\.sky-dashboard \*\s*\{[^}]*margin:\s*0[^}]*padding:\s*0/s);
  assert.match(landingCss, /\.marketing-landing > section\s*\{/);
  assert.doesNotMatch(landingCss, /\.marketing-landing section\s*\{/);
});

test("application chrome and dashboard accents follow theme tokens", () => {
  assert.match(appHeaderSource, /bg-background\/85/);
  assert.match(appHeaderSource, /bg-surface-strong\/95/);
  assert.doesNotMatch(appHeaderSource, /bg-\[#/);
  assert.match(globalsCss, /\.app-bottom-nav[\s\S]+var\(--background\)/);
  assert.doesNotMatch(dashboardCss, /rgba\(124, 92, 255/);
});

test("the dashboard composes shared button and card primitives", () => {
  assert.match(dashboardSource, /import \{ AppButton \} from "@\/components\/AppButton"/);
  assert.match(dashboardSource, /import \{ AppCard, getAppCardClassName \}/);
  assert.equal((dashboardSource.match(/<AppButton/g) ?? []).length, 2);
  assert.ok((dashboardSource.match(/<AppCard/g) ?? []).length >= 5);
  assert.doesNotMatch(dashboardSource, /className="(?:camera-btn|quest-btn)"/);
  assert.doesNotMatch(dashboardCss, /\.sky-dashboard \.(?:camera-btn|quest-btn)/);
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
  assert.match(dashboardSource, /<details[\s\S]+className: "sky-insights-details"/);
  assert.match(dashboardSource, /Indice de visibilité · Qualité du ciel/);
  assert.equal((dashboardSource.match(/className="sky-quality-card"/g) ?? []).length, 1);
  assert.match(dashboardCss, /\.sky-dashboard \.sky-insights-details\s*\{/);
});

test("free observation replaces stale quests and remains usable without GPS", () => {
  assert.match(dashboardSource, /if \(quest\.targetType === "free_observation"\) return true/);
  assert.match(dashboardSource, /setQuests\(fallbackQuests\)/);
  assert.doesNotMatch(
    dashboardSource,
    /setQuests\(\(currentQuests\) => \(currentQuests\.length > 0/,
  );
});

test("the landing page makes only cautious and verifiable observation claims", () => {
  assert.doesNotMatch(
    landingSource,
    /Conditions optimales|Nuit claire détectée|>88<|réellement visible|Ciel en temps réel|Carte du ciel|réalité augmentée/,
  );
  assert.match(landingSource, /Les conditions[\s\S]+restent toujours à vérifier sur place/);
  assert.match(landingSource, /indice indicatif/);
  assert.match(landingSource, /sans garantir que la cible sera visible/);
  assert.match(landingSource, /Estimations à vérifier sur place/);
});

test("primary navigation prioritizes Now, Later, Explore, and Journal", () => {
  const labels = ["Maintenant", "Plus tard", "Explorer", "Journal"];
  const positions = labels.map((label) => bottomNavigationSource.indexOf(`label: "${label}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
  );
  assert.doesNotMatch(bottomNavigationSource, /label: "Profil"/);
  assert.match(appHeaderSource, /href="\/profile"/);
  assert.match(appHeaderSource, /Profil et progression/);
});

test("Explore prioritizes the learning catalog and keeps space news secondary", () => {
  assert.ok(
    exploreSource.indexOf("Catalogue du ciel") < exploreSource.indexOf("Actualités spatiales"),
  );
  assert.match(exploreSource, /typeFilter/);
  assert.match(exploreSource, /difficultyFilter/);
  assert.match(exploreSource, /filteredObjects\.map/);
});

test("the Now dashboard displays every generated quest and the sky conditions", () => {
  assert.match(dashboardSource, /const displayedQuests = quests;/);
  assert.doesNotMatch(dashboardSource, /quests\.slice\(0, 3\)/);
  assert.match(dashboardSource, /weather\?\.isDay \? "À observer maintenant" : "Quêtes du soir"/);
  assert.doesNotMatch(
    dashboardSource,
    /Objets observables|Prochains événements|id="journal"|id="progression"|futureSuggestions/,
  );
  assert.match(dashboardCss, /\.camera-guide\s*\{\s*order: 1/);
  assert.match(dashboardCss, /\.sky-insights-disclosure\s*\{\s*order: 6/);
  assert.match(dashboardCss, /\.space-news-block\s*\{\s*order: 7/);
  assert.match(tonightSource, /<UpcomingSkyEvents \/>/);
  assert.match(tonightSource, /title="Plus tard"/);
  assert.match(dashboardSource, /<NasaHighlights compact \/>/);
});
