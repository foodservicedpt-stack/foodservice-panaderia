// Cloud Functions para las notificaciones push del obrador.
// La PWA es estática; esta función (desplegada en Firebase) es la que envía los avisos.
//
// - dailyPush: programada (Firebase Cloud Scheduler) cada día a las 06:30 (Europe/Madrid).
// - dailyPushHttp: por si prefieres dispararlo desde un cron gratuito (p. ej. GitHub Actions),
//   llamando a su URL con el header "x-cron-secret". Requiere el plan Blaze solo para la
//   programada; la HTTP se puede invocar gratis desde GitHub Actions.
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

setGlobalOptions({ region: "europe-west1" });

const adminApp = initializeApp();
const db = getFirestore(adminApp);

// Fecha local (Madrid) en formato YYYY-MM-DD.
function todayStr() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function getTokens() {
  const snap = await db.collection("pushSubscriptions").where("enabled", "==", true).get();
  return snap.docs.map((d) => d.data().token).filter(Boolean);
}

// Resume la planificación del día y los productos sin stock suficiente.
async function buildSummary() {
  const today = todayStr();
  const [prodsSnap, planSnap] = await Promise.all([
    db.collection("productos").where("categoria", "==", "STOCK").get(),
    db.collection("planificacion").where("fecha", "==", today).get(),
  ]);

  const planByProduct = {};
  planSnap.forEach((d) => {
    const p = d.data();
    planByProduct[p.productoId] = p;
  });

  const planned = [];
  const belowMin = [];
  prodsSnap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    if (p.activo === false) return;
    const plan = planByProduct[p.id];
    const planTotal = plan
      ? (Number(plan.desayuno) || 0) + (Number(plan.comida) || 0) + (Number(plan.extra) || 0)
      : 0;
    const stock = Number(p.stockActual) || 0;
    const unidad = p.unidad || "uds.";
    if (planTotal > 0) planned.push({ nombre: p.nombre, total: planTotal, unidad });
    const consumoHoy = planTotal > 0 ? planTotal : Number(p.consumoDiarioDefecto) || 0;
    if (consumoHoy > 0 && stock < consumoHoy) belowMin.push(p.nombre);
  });

  let title;
  let body;
  if (planned.length) {
    const first = planned.slice(0, 3).map((p) => `${p.nombre} (${p.total} ${p.unidad})`).join(", ");
    title = "Plan de hoy";
    body = planned.length > 3 ? `${first} y ${planned.length - 3} más.` : first;
    if (belowMin.length) body += ` · Sin stock para: ${belowMin.slice(0, 3).join(", ")}`;
  } else if (belowMin.length) {
    title = "Stock bajo hoy";
    body = `Sin existencias para: ${belowMin.slice(0, 3).join(", ")}`;
  } else {
    title = "Recordatorio del obrador";
    body = "Hoy no hay producción planificada. Revisa la planificación y el stock.";
  }
  return { title, body };
}

async function sendDailyToAll() {
  const tokens = await getTokens();
  if (!tokens.length) return { success: 0, failure: 0 };

  const { title, body } = await buildSummary();
  const messaging = getMessaging(adminApp);
  const resp = await messaging.sendEachForMulticast({
    tokens,
    data: { title, body },
  });

  // Limpiar tokens que ya no son válidos para no acumular basura.
  const invalid = [];
  resp.responses.forEach((r, i) => {
    const code = r.success ? "" : ((r.error && r.error.code) || "").toLowerCase();
    if (!r.success && /not-registered|invalid-registration|unregistered|invalid-argument/.test(code)) {
      invalid.push(tokens[i]);
    }
  });
  if (invalid.length) {
    await Promise.all(
      invalid.map((t) => db.collection("pushSubscriptions").doc(t).delete().catch(() => {}))
    );
  }
  return { success: resp.successCount, failure: resp.failureCount };
}

export const dailyPush = onSchedule(
  { schedule: "every day 06:30", timeZone: "Europe/Madrid", region: "europe-west1" },
  async () => {
    await sendDailyToAll();
  }
);

// Trigger HTTP opcional (para cron gratuito como GitHub Actions).
// Protegido por header x-cron-secret igual a la variable de entorno CRON_SECRET.
export const dailyPushHttp = onRequest({ region: "europe-west1", timeoutSeconds: 60 }, async (req, res) => {
  const secret = process.env.CRON_SECRET;
  // Por seguridad, el endpoint exige el header x-cron-secret (variable CRON_SECRET).
  if (!secret || req.headers["x-cron-secret"] !== secret) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await sendDailyToAll();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
