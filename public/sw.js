const SW_VERSION = "v4";
const STATIC_CACHE = `skyquest-static-${SW_VERSION}`;
const PAGE_CACHE = `skyquest-pages-${SW_VERSION}`;
const RUNTIME_CACHE = `skyquest-runtime-${SW_VERSION}`;
const CURRENT_CACHES = new Set([STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE]);

const PRECACHE_PAGES = ["/", "/journal", "/glossary", "/explore", "/profile", "/offline"];
const PRECACHE_STATIC = [
  "/manifest.webmanifest",
  "/newicon.png",
  "/newlogo.png",
  "/icon-192.png",
  "/icon-512.png",
];

function isHtmlResponse(response) {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function isImageResponse(response) {
  return response.headers.get("content-type")?.startsWith("image/") ?? false;
}

function isStaticResponse(response) {
  return response.ok && !isHtmlResponse(response);
}

async function cachePageAndItsNextAssets(pathname) {
  const response = await fetch(pathname, { cache: "reload" });
  if (!response.ok || !isHtmlResponse(response)) {
    throw new Error(`Unable to precache page: ${pathname}`);
  }

  const pageCache = await caches.open(PAGE_CACHE);
  await pageCache.put(pathname, response.clone());

  // Next hashes its route chunks. Discovering them from each shell page keeps this
  // dependency-free service worker usable after a fresh install, even before a visit.
  const html = await response.text();
  const assetUrls = new Set();
  const assetPattern = /(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g;
  for (const match of html.matchAll(assetPattern)) {
    assetUrls.add(match[1].replaceAll("&amp;", "&"));
  }

  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assetUrls].map(async (assetUrl) => {
      const cached = await staticCache.match(assetUrl);
      if (cached) return;
      const assetResponse = await fetch(assetUrl, { cache: "reload" });
      if (isStaticResponse(assetResponse)) {
        await staticCache.put(assetUrl, assetResponse);
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_STATIC)),
      Promise.all(PRECACHE_PAGES.map(cachePageAndItsNextAssets)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("skyquest-") && !CURRENT_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstNavigation(request) {
  const pageCache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && isHtmlResponse(response)) {
      await pageCache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await pageCache.match(request, { ignoreSearch: true })) ||
      (await pageCache.match("/offline")) ||
      new Response("Tu es hors ligne.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isStaticResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function cacheFirstImage(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && isImageResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    // An image failure stays an image failure: never substitute an HTML page.
    return Response.error();
  }
}

async function networkOnlyApi(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkOnlyApi(request));
    return;
  }

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirstImage(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = typeof payload.title === "string" ? payload.title : "SkyQuest";
  const payloadData =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : {};
  const options = {
    body:
      typeof payload.body === "string" ? payload.body : "Une nouvelle alerte ciel est disponible.",
    icon: typeof payload.icon === "string" ? payload.icon : "/icon-192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icon-192.png",
    tag: typeof payload.tag === "string" ? payload.tag : "skyquest-alert",
    data: {
      ...payloadData,
      url: typeof payload.url === "string" ? payload.url : "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let destination = new URL("/", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || "/", self.location.origin);
    if (requested.origin === self.location.origin) destination = requested;
  } catch {
    // Malformed or external URLs fall back to the application root.
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            await client.focus();
            if ("navigate" in client) await client.navigate(destination.href);
            return;
          }
        }

        if (self.clients.openWindow) return self.clients.openWindow(destination.href);
      }),
  );
});
