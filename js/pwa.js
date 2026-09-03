// Registro del Service Worker (PWA). Se ejecuta en cada página.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* silencioso: si el registro falla, la app sigue funcionando */
    });
  });
}
