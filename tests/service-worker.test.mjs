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
  const notifications = [];
  const openedWindows = [];
  let windowClients = [];

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
    registration: {
      async showNotification(title, options) {
        notifications.push({ title, options });
      },
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () => windowClients,
      async openWindow(url) {
        openedWindows.push(url);
      },
    },
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
    notifications,
    openedWindows,
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
    async dispatchPush(payload) {
      let promise;
      handlers.get("push")({
        data:
          payload === undefined ? undefined : { json: () => payload, text: () => String(payload) },
        waitUntil(value) {
          promise = Promise.resolve(value);
        },
      });
      await promise;
    },
    async dispatchNotificationClick(data) {
      let promise;
      let closed = false;
      handlers.get("notificationclick")({
        notification: {
          data,
          close() {
            closed = true;
          },
        },
        waitUntil(value) {
          promise = Promise.resolve(value);
        },
      });
      await promise;
      return { closed };
    },
    setWindowClients(clients) {
      windowClients = clients;
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
  const pageCache = await worker.caches.open("skyquest-pages-v4");
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
  await worker.caches.open("skyquest-pages-v3");
  await worker.caches.open("skyquest-pages-v4");
  await worker.caches.open("another-app-cache");

  await worker.dispatchLifecycle("activate");

  const keys = await worker.caches.keys();
  assert.equal(keys.includes("skyquest-pages-v3"), false);
  assert.equal(keys.includes("skyquest-pages-v4"), true);
  assert.equal(keys.includes("another-app-cache"), true);
});

test("push events display a contextual notification with safe defaults", async () => {
  const worker = createWorker();
  await worker.dispatchPush({
    title: "Vénus est tentable ce soir",
    body: "Une mission simple est disponible.",
    url: "/#objects",
    tag: "planet-visible-venus",
    data: { type: "planet_visible" },
  });

  assert.equal(worker.notifications.length, 1);
  assert.equal(worker.notifications[0].title, "Vénus est tentable ce soir");
  assert.equal(worker.notifications[0].options.data.url, "/#objects");
  assert.equal(worker.notifications[0].options.data.type, "planet_visible");
  assert.equal(worker.notifications[0].options.icon, "/icon-192.png");
});

test("notification clicks focus an existing client and navigate to a same-origin URL", async () => {
  const worker = createWorker();
  const calls = [];
  worker.setWindowClients([
    {
      async focus() {
        calls.push("focus");
      },
      async navigate(url) {
        calls.push(url);
      },
    },
  ]);

  const result = await worker.dispatchNotificationClick({ url: "/journal" });

  assert.equal(result.closed, true);
  assert.deepEqual(calls, ["focus", `${ORIGIN}/journal`]);
  assert.deepEqual(worker.openedWindows, []);
});

test("notification clicks never open an external payload URL", async () => {
  const worker = createWorker();
  await worker.dispatchNotificationClick({ url: "https://example.com/phishing" });
  assert.deepEqual(worker.openedWindows, [`${ORIGIN}/`]);
});
