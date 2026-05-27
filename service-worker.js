const CACHE_NAME = "quiz-pwa-v3";
const APP_FILES = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./questions.json",
  "./manifest.json",
  "./icon.svg",
];
const IMAGE_DIR = "./assets/question-images/";

function cacheUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function cacheQuestionImages(cache) {
  try {
    const response = await fetch(cacheUrl("./questions.json"), { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const questions = await response.json();
    if (!Array.isArray(questions)) {
      return;
    }

    const imageUrls = [
      ...new Set(
        questions
          .map((question) => question && question.image)
          .filter((image) => typeof image === "string" && image.length > 0)
          .map(cacheUrl)
      ),
    ];

    await Promise.allSettled(
      imageUrls.map(async (url) => {
        const imageResponse = await fetch(url);
        if (imageResponse.ok) {
          await cache.put(url, imageResponse);
        }
      })
    );
  } catch {
    // Core files are enough for the app shell; images are cached opportunistically.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_FILES);
      await cacheQuestionImages(cache);
    })
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
  const imageDirUrl = cacheUrl(IMAGE_DIR);
  if (requestUrl.href.startsWith(imageDirUrl)) {
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
    return;
  }

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
