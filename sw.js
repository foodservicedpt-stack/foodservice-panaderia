const CACHE_NAME = "panaderia-v1";
const CORE = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./inventario.html",
  "./planificacion.html",
  "./amasadoras.html",
  "./orden-trabajo.html",
  "./configuracion.html",
  "./css/style.css",
  "./manifest.webmanifest",
  "./js/nav.js",
  "./js/pwa.js",
  "./js/ui.js",
  "./js/components.js",
  "./js/domain.js",
  "./js/utils.js",
  "./js/data.js",
  "./js/dashboard.js",
  "./js/inventario.js",
  "./js/planificacion.js",
  "./js/amasadoras.js",
  "./js/orden-trabajo.js",
  "./js/configuracion.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase (CDN) goes to network

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
