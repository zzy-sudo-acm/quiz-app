const CACHE_NAME = "quiz-pwa-v2";
const APP_FILES = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./questions.json",
  "./manifest.json",
  "./icon.svg",
];

function cacheUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(cacheUrl("./index.html")))
    );
    return;
  }

  const cachedUrls = new Set(APP_FILES.map(cacheUrl));
  if (!cachedUrls.has(requestUrl.href)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(requestUrl.href, copy));
        }
        return response;
      })
      .catch(() => caches.match(requestUrl.href))
  );
});
