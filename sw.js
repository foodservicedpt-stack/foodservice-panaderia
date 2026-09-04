const CACHE_NAME = "panaderia-v2";
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
  "./js/firebase-config.js",
  "./js/push.js",
  "./js/dashboard.js",
  "./js/inventario.js",
  "./js/planificacion.js",
  "./js/amasadoras.js",
  "./js/amasadoras-ui.js",
  "./js/orden-trabajo.js",
  "./js/configuracion.js",
];

// Hosts de CDN cuyo contenido es seguro cachear en runtime (SDK de Firebase).
const CACHEABLE_CDN_HOSTS = ["www.gstatic.com", "firebasestorage.googleapis.com"];

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

  // SDK de Firebase (CDN): cachearlo en runtime para no volver a descargarlo en cada página.
  if (url.origin !== self.location.origin) {
    if (CACHEABLE_CDN_HOSTS.includes(url.hostname)) {
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
    }
    return;
  }

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

// ---- Notificaciones push (web push de FCM) ----

self.addEventListener("push", (event) => {
  // Si el payload ya trae "notification", el navegador la muestra por sí solo;
  // solo llamamos a showNotification en mensajes con payload solo-datos.
  let payload = null;
  try { payload = event.data ? event.data.json() : null; } catch (_) { /* no JSON */ }
  if (payload && payload.notification) return;
  const n = (payload && payload.data) || {};
  const title = n.title || "Panadería";
  const body = n.body || "Tienes una actualización del obrador.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      vibrate: [80, 60, 80],
      data: { url: "./dashboard.html" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "./dashboard.html";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
