import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://skyquest.test";
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function createWorker() {
  const handlers = new Map();
  const cacheStores = new Map();
  let fetchImplementation = async () => {
    throw new TypeError("offline");
  };

  function requestKey(request) {
    const value = typeof request === "string" ? request : request.url;
    return new URL(value, ORIGIN).href;
  }

  class MemoryCache {
    entries = new Map();

    async match(request, options = {}) {
      const key = requestKey(request);
      if (!options.ignoreSearch) return this.entries.get(key)?.clone();
      const expected = new URL(key);
      for (const [storedKey, response] of this.entries) {
        const stored = new URL(storedKey);
        if (stored.origin === expected.origin && stored.pathname === expected.pathname) {
          return response.clone();
        }
      }
      return undefined;
    }

    async put(request, response) {
      this.entries.set(requestKey(request), response.clone());
    }

    async addAll() {}
  }

  const caches = {
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, new MemoryCache());
      return cacheStores.get(name);
    },
    async keys() {
      return [...cacheStores.keys()];
    },
    async delete(name) {
      return cacheStores.delete(name);
    },
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
  };

  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    Response,
    fetch: (...args) => fetchImplementation(...args),
  });

  async function dispatchFetch(request) {
    let responsePromise;
    handlers.get("fetch")({
      request,
      respondWith(value) {
        responsePromise = Promise.resolve(value);
      },
    });
    return responsePromise;
  }

  return {
    caches,
    dispatchFetch,
    async dispatchLifecycle(type) {
      let lifecyclePromise;
      handlers.get(type)({
        waitUntil(value) {
          lifecyclePromise = Promise.resolve(value);
        },
      });
      await lifecyclePromise;
    },
    setFetch(implementation) {
      fetchImplementation = implementation;
    },
  };
}

function fakeRequest(pathname, options = {}) {
  return {
    url: new URL(pathname, ORIGIN).href,
    method: options.method ?? "GET",
    mode: options.mode ?? "cors",
    destination: options.destination ?? "",
  };
}

test("offline API requests return JSON 503, never HTML", async () => {
  const worker = createWorker();
  const response = await worker.dispatchFetch(fakeRequest("/api/iss-pass?lat=1&lon=2"));

  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), { error: "offline" });
});

test("offline images and static assets fail without an HTML substitution", async () => {
  const worker = createWorker();
  const image = await worker.dispatchFetch(fakeRequest("/missing.png", { destination: "image" }));
  const script = await worker.dispatchFetch(
    fakeRequest("/_next/static/chunks/missing.js", { destination: "script" }),
  );

  assert.equal(image.status, 0);
  assert.equal(script.status, 0);
  assert.equal(image.headers.get("content-type"), null);
  assert.equal(script.headers.get("content-type"), null);
});

test("offline navigation falls back to the dedicated cached page", async () => {
  const worker = createWorker();
  const pageCache = await worker.caches.open("skyquest-pages-v3");
  await pageCache.put(
    "/offline",
    new Response("<h1>Tu es hors ligne</h1>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
  );

  const response = await worker.dispatchFetch(fakeRequest("/unknown", { mode: "navigate" }));
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(await response.text(), /Tu es hors ligne/);
});

test("activation removes old SkyQuest caches only", async () => {
  const worker = createWorker();
  await worker.caches.open("skyquest-pages-v2");
  await worker.caches.open("skyquest-pages-v3");
  await worker.caches.open("another-app-cache");

  await worker.dispatchLifecycle("activate");

  const keys = await worker.caches.keys();
  assert.equal(keys.includes("skyquest-pages-v2"), false);
  assert.equal(keys.includes("skyquest-pages-v3"), true);
  assert.equal(keys.includes("another-app-cache"), true);
});
