// Notificaciones push (FCM / web push).
// Se carga solo en la página de Configuración para no añadir peso a las demás.
import { app, db, doc, setDoc, deleteDoc, VAPID_KEY } from "./firebase-config.js";

const MESSAGING_URL = "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";
const TOKEN_COLLECTION = "pushSubscriptions";

let messagingInstance = null;
let messageListenerAttached = false;
let tokenRefreshAttached = false;
let currentToken = null;

async function getMessaging() {
  if (messagingInstance) return messagingInstance;
  const { getMessaging } = await import(MESSAGING_URL);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

function vapidKeySet() {
  return Boolean(VAPID_KEY) && !VAPID_KEY.includes("TU_CLAVE");
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (_) {
    return false;
  }
}

function showInAppNotification(title, body) {
  import("./ui.js")
    .then(({ toast }) => toast(body, "info", { title, duration: 5000 }))
    .catch(() => {});
}

async function saveToken(token) {
  await setDoc(doc(db, TOKEN_COLLECTION, token), {
    token,
    userAgent: navigator.userAgent,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function enablePushNotifications() {
  if (typeof window === "undefined") throw new Error("Entorno no compatible.");
  if (!("Notification" in window)) throw new Error("Este dispositivo no soporta notificaciones.");
  if (!vapidKeySet()) throw new Error("Configura la clave VAPID en js/firebase-config.js antes de activar notificaciones.");
  // En iOS, el permiso de web push solo puede pedirse desde una PWA instalada en la pantalla de inicio.
  if (isIOS() && !isStandalone()) {
    throw new Error("En iOS, instala primero la app (Compartir → Añadir a pantalla de inicio) y vuelve a intentarlo.");
  }

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Permiso de notificación denegado.");
  }

  const messaging = await getMessaging();
  const { getToken } = await import(MESSAGING_URL);
  // Asegurar que el service worker esté registrado antes de pedir el token.
  const swReg = await navigator.serviceWorker.register("./sw.js");
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) throw new Error("No se pudo obtener el token de notificación.");

  await saveToken(token);
  currentToken = token;

  // Mensajes en primer plano: mostrar un aviso dentro de la app.
  if (!messageListenerAttached) {
    const { onMessage } = await import(MESSAGING_URL);
    onMessage(messaging, (payload) => {
      const data = payload.data || {};
      showInAppNotification(data.title || "Panadería", data.body || "Tienes una actualización del obrador.");
    });
    messageListenerAttached = true;
  }

  // Mantener el token registrado actualizado cuando FCM lo renueve.
  if (!tokenRefreshAttached) {
    const { onTokenRefresh } = await import(MESSAGING_URL);
    onTokenRefresh(messaging, async (newToken) => {
      if (!newToken) return;
      try {
        await saveToken(newToken);
        if (currentToken && currentToken !== newToken) {
          await deleteDoc(doc(db, TOKEN_COLLECTION, currentToken));
        }
        currentToken = newToken;
      } catch (err) {
        console.warn("[push] onTokenRefresh", err.message);
      }
    });
    tokenRefreshAttached = true;
  }

  return token;
}

export async function disablePushNotifications() {
  const messaging = await getMessaging();
  const { deleteToken } = await import(MESSAGING_URL);
  try { await deleteToken(messaging); } catch (err) { /* ignorar */ }
  if (currentToken) {
    try { await deleteDoc(doc(db, TOKEN_COLLECTION, currentToken)); } catch (err) { /* ignorar */ }
    currentToken = null;
  }
}
