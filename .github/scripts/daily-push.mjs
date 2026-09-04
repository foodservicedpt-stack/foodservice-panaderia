// Envía el aviso diario del obrador usando Firebase Cloud Messaging (FCM).
// Se ejecuta desde GitHub Actions (gratuito) con un service account como secreto.
// NO requiere Cloud Functions ni el plan Blaze.

// Requisitos:
//  - Secreto de repo FIREBASE_SERVICE_ACCOUNT con el JSON del service account
//    (Firebase Console → Project settings → Service accounts → Generar clave privada).
//  - El script toma las credenciales de GOOGLE_APPLICATION_CREDENTIALS (ADC),
//    que el workflow apunta a un fichero temporal con ese secreto.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const adminApp = initializeApp();
const db = getFirestore(adminApp);

// Fecha y hora locales de Madrid.
function madridParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

function todayStr() { return madridParts().date; }

async function getTokens() {
  const snap = await db.collection("pushSubscriptions").where("enabled", "==", true).get();
  return snap.docs.map((d) => d.data().token).filter(Boolean);
}

async function buildSummary() {
  const today = todayStr();
  const [prodsSnap, planSnap] = await Promise.all([
    db.collection("productos").where("categoria", "==", "STOCK").get(),
    db.collection("planificacion").where("fecha", "==", today).get(),
  ]);
  const planByProduct = {};
  planSnap.forEach((d) => { const p = d.data(); planByProduct[p.productoId] = p; });
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

async function main() {
  const now = madridParts();
  // Solo enviar a partir de las 06:30 de Madrid (cubre el cambio de hora verano/invierno).
  if (now.hour < 6 || (now.hour === 6 && now.minute < 30)) {
    console.log(`Aún no son las 06:30 Madrid (${now.hour}:${String(now.minute).padStart(2, "0")}); salto.`);
    return;
  }
  const today = now.date;
  const metaRef = db.collection("pushMeta").doc("daily");
  const metaSnap = await metaRef.get();
  if (metaSnap.exists && metaSnap.data().sentFor === today) {
    console.log(`Aviso de ${today} ya enviado; salto.`);
    return;
  }
  const tokens = await getTokens();
  if (!tokens.length) {
    console.log("Sin tokens registrados; marco como enviado.");
    await metaRef.set({ sentFor: today, sentAt: new Date().toISOString() });
    return;
  }
  const { title, body } = await buildSummary();
  const resp = await getMessaging(adminApp).sendEachForMulticast({ tokens, data: { title, body } });
  const invalid = [];
  resp.responses.forEach((r, i) => {
    const code = r.success ? "" : ((r.error && r.error.code) || "").toLowerCase();
    if (!r.success && /not-registered|invalid-registration|unregistered|invalid-argument/.test(code)) invalid.push(tokens[i]);
  });
  if (invalid.length) await Promise.all(invalid.map((t) => db.collection("pushSubscriptions").doc(t).delete().catch(() => {})));
  await metaRef.set({ sentFor: today, sentAt: new Date().toISOString() });
  console.log(`Aviso enviado: ${resp.successCount} ok, ${resp.failureCount} fallos (${today}).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
