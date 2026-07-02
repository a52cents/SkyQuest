const CACHE_NAME = "skyquest-v2";
const APP_SHELL = [
  "/",
  "/journal",
  "/glossary",
  "/manifest.webmanifest",
  "/newicon.png",
  "/newlogo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        const requestUrl = new URL(event.request.url);
        if (
          response.ok &&
          requestUrl.origin === self.location.origin &&
          !requestUrl.pathname.startsWith("/api/")
        ) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
