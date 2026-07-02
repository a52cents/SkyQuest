import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helperSource = readFileSync(
  new URL("../lib/service-worker-client.ts", import.meta.url),
  "utf8",
);
const registerSource = readFileSync(
  new URL("../components/PwaRegister.tsx", import.meta.url),
  "utf8",
);
const pushClientSource = readFileSync(new URL("../lib/push-client.ts", import.meta.url), "utf8");
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const manifestSource = readFileSync(
  new URL("../public/manifest.webmanifest", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("../components/marketing/LandingPage.tsx", import.meta.url),
  "utf8",
);

test("service worker registration uses its restricted Trusted Types policy", () => {
  assert.match(helperSource, /createPolicy\("skyquest-sw"/);
  assert.match(helperSource, /url\.pathname !== "\/sw\.js"/);
  assert.match(middlewareSource, /trusted-types skyquest skyquest-sw default/);
});

test("all application service worker registrations use the shared secure helper", () => {
  assert.match(registerSource, /registerSkyQuestServiceWorker\(\)/);
  assert.match(pushClientSource, /registerSkyQuestServiceWorker\(\)/);
  assert.doesNotMatch(registerSource, /serviceWorker\.register\(/);
  assert.doesNotMatch(pushClientSource, /serviceWorker\.register\(/);
});

test("desktop installation exposes valid icons and the native install prompt", () => {
  assert.match(manifestSource, /"sizes": "192x192"/);
  assert.match(manifestSource, /"sizes": "512x512"/);
  assert.match(landingSource, /useInstallPrompt\(\)/);
  assert.match(landingSource, /await promptInstall\(\)/);
});
