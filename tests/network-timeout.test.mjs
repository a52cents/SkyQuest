import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createNetworkTimeoutSignal, NETWORK_TIMEOUT_MS } from "../lib/network.ts";

const criticalRequestFiles = [
  "../lib/weather.ts",
  "../lib/air-quality.ts",
  "../lib/iss.ts",
  "../lib/satellites.ts",
  "../lib/light-pollution-client.ts",
  "../lib/lighting-practices-client.ts",
];

test("network requests use an eight-second AbortSignal timeout", async () => {
  assert.equal(NETWORK_TIMEOUT_MS, 8_000);
  const signal = createNetworkTimeoutSignal(1);
  await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason?.name, "TimeoutError");
});

test("every request blocking the Now analysis has a timeout signal", () => {
  for (const relativePath of criticalRequestFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /signal: createNetworkTimeoutSignal\(\)/, relativePath);
  }
});

test("server-side provider calls are bounded too", () => {
  for (const relativePath of [
    "../lib/celestrak.ts",
    "../app/api/lighting-practice/route.ts",
    "../lib/light-pollution-provider.ts",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /signal: createNetworkTimeoutSignal\(\)/, relativePath);
  }
});
