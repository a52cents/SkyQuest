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
const appRouteShellSource = readFileSync(
  new URL("../components/navigation/AppRouteShell.tsx", import.meta.url),
  "utf8",
);
const tonightSource = readFileSync(new URL("../app/tonight/page.tsx", import.meta.url), "utf8");
const exploreSource = readFileSync(new URL("../app/explore/page.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

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

test("route content stays visible even when client animation cannot hydrate", () => {
  assert.match(appRouteShellSource, /<div className=\{showNavigation/);
  assert.doesNotMatch(appRouteShellSource, /initial=\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(appRouteShellSource, /AnimatePresence/);
});

test("the dashboard composes shared button and card primitives", () => {
  assert.match(dashboardSource, /import \{ AppButton \} from "@\/components\/AppButton"/);
  assert.match(dashboardSource, /import \{ AppCard, getAppCardClassName \}/);
  assert.equal((dashboardSource.match(/<AppButton/g) ?? []).length, 2);
  assert.ok((dashboardSource.match(/<AppCard/g) ?? []).length >= 4);
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
  assert.match(
    dashboardSource,
    /<details[\s\S]+className: "sky-insights-details sky-quality-card"/,
  );
  assert.match(dashboardSource, /className="sky-quality-kicker">Qualité du ciel/);
  assert.match(dashboardSource, /className="sky-insights-toggle-label">Comprendre ton ciel/);
  assert.doesNotMatch(dashboardSource, /<AppCard[^>]+className="sky-quality-card"/);
  assert.match(dashboardCss, /\.sky-dashboard \.sky-insights-details\s*\{/);
  assert.match(dashboardCss, /\.sky-insights-details::before[\s\S]+conic-gradient\(/);
  assert.match(dashboardCss, /transparent 118deg 286deg/);
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

test("the landing page offers a browser trial before installation", () => {
  assert.match(landingSource, /href="\/\?app=1"[\s\S]+Essayer maintenant/);
  assert.ok(
    landingSource.indexOf("Essayer maintenant") < landingSource.indexOf("Installer l'application"),
  );
  assert.match(homeSource, /displayMode === "standalone" \|\| isBrowserTrial/);
  assert.match(bottomNavigationSource, /displayMode === "browser" \? "\/\?app=1"/);
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
  assert.match(exploreSource, /variants=\{container\} initial=\{false\} animate="show"/);
});

test("the Now dashboard prioritizes one quest, two alternatives, and keeps the full list secondary", () => {
  assert.match(dashboardSource, /rankQuestsForRecommendation/);
  assert.match(dashboardSource, /const alternativeQuests = rankedQuests\.slice\(1, 3\)/);
  assert.match(dashboardSource, /const remainingQuests = rankedQuests\.slice\(3\)/);
  assert.match(dashboardSource, /Ta quête recommandée/);
  assert.match(dashboardSource, /Voir toutes les quêtes/);
  assert.match(dashboardSource, /Nouvelle pour toi/);
  assert.match(dashboardSource, /Bonne soirée pour réessayer/);
  assert.doesNotMatch(
    dashboardSource,
    /Objets observables|Prochains événements|id="journal"|id="progression"|futureSuggestions/,
  );
  assert.match(dashboardCss, /\.camera-guide\s*\{\s*order: 1/);
  assert.match(dashboardCss, /\.quest-priority,\s*\.sky-dashboard \.empty-state\s*\{\s*order: 4/);
  assert.match(dashboardCss, /\.sky-insights-disclosure\s*\{\s*order: 6/);
  assert.match(tonightSource, /<UpcomingSkyEvents \/>/);
  assert.match(tonightSource, /title="Plus tard"/);
  assert.doesNotMatch(dashboardSource, /NasaHighlights/);
  assert.match(exploreSource, /<NasaHighlights \/>/);
});

test("the Now analysis renders weather and astronomy before network enrichment", () => {
  const initialResultsPosition = dashboardSource.indexOf("setQuests(initialQuests)");
  const readyPosition = dashboardSource.indexOf('setLoadState("ready")', initialResultsPosition);
  const enrichmentPosition = dashboardSource.indexOf("void enrichmentPromise", readyPosition);

  assert.match(dashboardSource, /const enrichmentPromise = Promise\.all\(/);
  assert.ok(initialResultsPosition >= 0);
  assert.ok(readyPosition > initialResultsPosition);
  assert.ok(enrichmentPosition > readyPosition);
  assert.match(dashboardSource, /requestId !== activeAnalysisRequestRef\.current/);
  assert.match(dashboardSource, /isRefining \? "Affinage…"/);
});

test("dashboard quest cards show a condition-aware difficulty badge", () => {
  assert.match(dashboardSource, /function getQuestEase\(quest: SkyQuest\)/);
  assert.match(dashboardSource, /quest\.visibilityScore >= 75 && quest\.difficulty === "easy"/);
  assert.match(dashboardSource, /Difficulté estimée : \$\{questEase\.label\}/);
  assert.match(dashboardCss, /\.quest-badge\.difficulty\.easy/);
  assert.match(dashboardCss, /\.quest-badge\.difficulty\.moderate/);
  assert.match(dashboardCss, /\.quest-badge\.difficulty\.hard/);
});
