import assert from "node:assert/strict";
import test from "node:test";
import {
  getOnboardingCompleted,
  resetOnboardingCompleted,
  setOnboardingCompleted,
} from "../lib/onboarding.ts";

function withWindow(localStorage, callback) {
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage };
  try {
    callback();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("onboarding is saved with the v1 done flag and can be reset", () => {
  const values = new Map();
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  withWindow(localStorage, () => {
    assert.equal(getOnboardingCompleted(), false);
    setOnboardingCompleted();
    assert.equal(values.get("skyquest.onboarding.v1"), "done");
    assert.equal(getOnboardingCompleted(), true);
    resetOnboardingCompleted();
    assert.equal(getOnboardingCompleted(), false);
  });
});

test("unavailable localStorage never blocks the app", () => {
  const localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
  };

  withWindow(localStorage, () => assert.equal(getOnboardingCompleted(), true));
});
