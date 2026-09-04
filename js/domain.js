/**
 * @typedef {Object} Producto
 * @property {string} id
 * @property {string} nombre
 * @property {"STOCK"|"SEMANAL"|"OTRO"} categoria
 * @property {boolean} activo
 * @property {number} stockActual
 * @property {number} consumoDiarioDefecto
 * @property {number} margenSeguridadDias
 * @property {string} [unidad]
 */

/**
 * @typedef {Object} Movimiento
 * @property {string} productoId
 * @property {number} cantidad
 * @property {string} tipo
 * @property {string|null} notas
 */

import { parseDateString, toDateString } from "./utils.js";

export const CATEGORIES = Object.freeze(["STOCK", "SEMANAL", "OTRO"]);
export const AMASADORA_STATES = Object.freeze(["PLANIFICADA", "EN_FERMENTACION", "COMPLETADA"]);

export function validateProductInput({ nombre, categoria, margenSeguridadDias, consumoDiarioDefecto, unidad }) {
  if (nombre !== undefined && (!String(nombre).trim() || String(nombre).length > 120)) {
    throw new Error("El nombre debe tener entre 1 y 120 caracteres");
  }
  if (categoria !== undefined && !CATEGORIES.includes(categoria)) {
    throw new Error("Categoría inválida");
  }
  if (margenSeguridadDias !== undefined) validateNonNegativeInteger(margenSeguridadDias, "El margen de seguridad");
  if (consumoDiarioDefecto !== undefined) validateNonNegativeInteger(consumoDiarioDefecto, "El consumo diario");
  if (unidad !== undefined && (typeof unidad !== "string" || unidad.trim().length > 12)) {
    throw new Error("La unidad no puede superar 12 caracteres");
  }
}

export function validateNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} debe ser un número entero no negativo`);
  }
  return number;
}

export function validateMovementInput({ productoId, cantidad, notas }) {
  if (!productoId || !Number.isInteger(Number(cantidad)) || Number(cantidad) === 0) {
    throw new Error("Producto y cantidad válida son obligatorios");
  }
  if (notas !== undefined && (typeof notas !== "string" || notas.length > 200)) {
    throw new Error("El motivo no puede superar 200 caracteres");
  }
}

// ---------- Amasadoras: ciclo de producción por tiempo ----------
export const AMASADORA_STAGES = Object.freeze([
  { key: "PLANIFICADA", label: "Planificada" },
  { key: "AMASADO", label: "Amasado" },
  { key: "FERMENTANDO", label: "Fermentando" },
  { key: "HORNEADO", label: "Horneado" },
]);

export const AMASADORA_TIMING = Object.freeze({
  kneadStartHour: 0,        // empieza el amasado a las 00:00 del día de inicio
  fermentStartHour: 15.5,   // fin de amasado / inicio de fermentación a las 15:30
  bakeStartOffsetDays: 1,   // el horneado empieza el día siguiente a las 00:00
  bakeEndHour: 15.5,        // fin del horneado el día siguiente a las 15:30
});

function atHour(base, hourFloat) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setHours(Math.floor(hourFloat), Math.round((hourFloat % 1) * 60), 0, 0);
  return d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function amasadoraMilestones(fechaInicio) {
  const base = typeof fechaInicio === "string" ? parseDateString(fechaInicio) : new Date(fechaInicio.getTime());
  const bake = addDays(base, AMASADORA_TIMING.bakeStartOffsetDays);
  return {
    kneadStart: atHour(base, AMASADORA_TIMING.kneadStartHour),
    fermentStart: atHour(base, AMASADORA_TIMING.fermentStartHour),
    bakeStart: atHour(bake, 0),
    bakeEnd: atHour(bake, AMASADORA_TIMING.bakeEndHour),
  };
}

/** Devuelve la etapa actual de una amasadora según el momento (now).
 *  Si ya tiene piezas registradas -> COMPLETADA.
 *  Si no, calcula la etapa por tiempo (planificada → amasado → fermentando → horneado)
 *  y el porcentaje de avance continuo dentro de la etapa. */
export function getAmasadoraStage(amasadora, now = new Date()) {
  if (!amasadora) throw new Error("Amasadora requerida");
  const t = (now instanceof Date ? now : new Date(now)).getTime();

  if (amasadora.piezasProducidas != null) {
    return { key: "COMPLETADA", label: "Completada", index: AMASADORA_STAGES.length, progress: 1, overall: 100 };
  }

  const fechaInicio = amasadora.fechaInicio || new Date().toISOString().slice(0, 10);
  const m = amasadoraMilestones(fechaInicio);
  const planRef = amasadora.createdAt ? new Date(amasadora.createdAt).getTime() : m.kneadStart.getTime() - 86400000;

  const segments = [
    { start: planRef, end: m.kneadStart.getTime(), skey: "PLANIFICADA" },
    { start: m.kneadStart.getTime(), end: m.fermentStart.getTime(), skey: "AMASADO" },
    { start: m.fermentStart.getTime(), end: m.bakeStart.getTime(), skey: "FERMENTANDO" },
    { start: m.bakeStart.getTime(), end: m.bakeEnd.getTime(), skey: "HORNEADO" },
  ];

  let index = 0;
  let progress = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (t < s.end) {
      index = i;
      progress = s.end > s.start ? Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start))) : 0;
      break;
    }
    index = i;
    progress = 1;
  }
  if (t >= segments[segments.length - 1].end) {
    index = segments.length - 1;
    progress = 1;
  }

  const overall = Math.min(100, Math.round(((index + progress) / AMASADORA_STAGES.length) * 100));
  const stage = AMASADORA_STAGES[index];
  return { key: stage.key, label: stage.label, index, progress, overall };
}
// ---------- Producciones (amasadoras + yogur/helado/bizcocho/panes especiales) ----------
export const PRODUCCION_TIPOS = Object.freeze([
  { tipo: "MASAS", label: "Pan", tracksStock: true, visible: "PLAN_DATE", confirm: true },
  { tipo: "PANE_ESPECIAL", label: "Pan especial", tracksStock: false, visible: "PLAN_DATE", confirm: false },
  { tipo: "YOGUR", label: "Yogur", tracksStock: false, visible: "DAY_BEFORE", confirm: false },
  { tipo: "HELADO", label: "Helado", tracksStock: false, visible: "DAY_BEFORE", confirm: false },
  { tipo: "BIZCOCHO", label: "Bizcocho", tracksStock: false, visible: "DAY_BEFORE", confirm: false },
]);

export function produccionTipo(tipo) {
  return PRODUCCION_TIPOS.find((t) => t.tipo === tipo) || PRODUCCION_TIPOS[0];
}

const HOUR = 3600000;
const DAY = 86400000;

function localDateMs(fechaInicio) {
  const d = typeof fechaInicio === "string" ? parseDateString(fechaInicio) : new Date(fechaInicio.getTime());
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Devuelve las etapas (con inicio/fin en ms) para un tipo concreto.
export function produccionStages(tipo, fechaInicio, createdAt) {
  const y0 = localDateMs(fechaInicio);
  const createdMs = createdAt ? new Date(createdAt).getTime() : null;

  if (tipo === "MASAS" || tipo === "PANE_ESPECIAL") {
    const planStart = createdMs != null ? createdMs : y0 - DAY;
    return [
      { key: "PLANIFICADA", label: "Planificada", start: planStart, end: y0 },
      { key: "AMASADO", label: "Amasado", start: y0, end: y0 + 15.5 * HOUR },
      { key: "FERMENTANDO", label: "Fermentando", start: y0 + 15.5 * HOUR, end: y0 + DAY },
      { key: "HORNEADO", label: "Horneado", start: y0 + DAY, end: y0 + DAY + 15.5 * HOUR },
    ];
  }

  // Tipos "el día anterior": PREVISION rellena desde el día de antes hasta el inicio de la producción.
  const prevStart = Math.max(createdMs != null ? createdMs : (y0 - DAY), y0 - DAY);

  if (tipo === "YOGUR") {
    return [
      { key: "PREVISION", label: "Pendiente", start: prevStart, end: y0 },
      { key: "PREPARACION", label: "Preparación", start: y0, end: y0 + 12.5 * HOUR },
      { key: "FERMENTACION", label: "Fermentando", start: y0 + 12.5 * HOUR, end: y0 + DAY },
      { key: "ENVASADO", label: "Envasado", start: y0 + DAY, end: y0 + DAY + 15.5 * HOUR },
    ];
  }
  if (tipo === "HELADO") {
    return [
      { key: "PREVISION", label: "Pendiente", start: prevStart, end: y0 },
      { key: "MEZCLA", label: "Mezcla", start: y0, end: y0 + 12.5 * HOUR },
      { key: "MADURACION", label: "Madurando", start: y0 + 12.5 * HOUR, end: y0 + DAY },
      { key: "SERVICIO", label: "Servir", start: y0 + DAY, end: y0 + DAY + 12.5 * HOUR },
    ];
  }
  // BIZCOCHO
  return [
    { key: "PREVISION", label: "Pendiente", start: prevStart, end: y0 },
    { key: "PREPARACION", label: "Preparación", start: y0, end: y0 + 10.5 * HOUR },
    { key: "HORNEADO", label: "Horneado", start: y0 + 10.5 * HOUR, end: y0 + 13.5 * HOUR },
    { key: "CONSERVACION", label: "Conservación", start: y0 + 13.5 * HOUR, end: y0 + 2 * DAY },
  ];
}

export function isProduccionVisible(produccion, def, now = new Date()) {
  const t = (now instanceof Date ? now : new Date(now)).getTime();
  if (def.visible === "DAY_BEFORE") {
    const y0 = localDateMs(produccion.fechaInicio);
    return t >= (y0 - DAY);
  }
  return true;
}

export function getProduccionStage(produccion, now = new Date()) {
  const tipo = produccion.tipo || "MASAS";
  const def = produccionTipo(tipo);
  const t = (now instanceof Date ? now : new Date(now)).getTime();

  if (produccion.estado === "COMPLETADA" || (def.tracksStock && produccion.piezasProducidas != null)) {
    return { key: "COMPLETADA", label: "Completada", index: 4, progress: 1, overall: 100 };
  }
  if (produccion.estado === "CANCELADA") {
    return { key: "CANCELADA", label: "Cancelada", index: 0, progress: 0, overall: 0, cancelled: true };
  }

  const fechaInicio = produccion.fechaInicio || new Date().toISOString().slice(0, 10);
  const stages = produccionStages(tipo, fechaInicio, produccion.createdAt);

  let index = 0;
  let progress = 0;
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (t < s.end) {
      index = i;
      progress = s.end > s.start ? Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start))) : 0;
      break;
    }
    index = i;
    progress = 1;
  }
  if (t >= stages[stages.length - 1].end) {
    index = stages.length - 1;
    progress = 1;
  }
  const overall = Math.min(100, Math.round(((index + progress) / stages.length) * 100));
  const stage = stages[index];
  return { key: stage.key, label: stage.label, index, progress, overall, stages: stages.map((s) => s.key) };
}


// ---------- Previsión de stock a partir de la planificación ----------
function addCalendarDaysLocal(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function forecastStock({ stockActual, consumoDiarioDefecto, planByKey, productoId, todayStr, horizonDays = 45 }) {
  const stock = Number(stockActual) || 0;
  const def = Number(consumoDiarioDefecto) || 0;
  const today = typeof todayStr === "string" ? parseDateString(todayStr) : (todayStr || new Date());

  let remaining = stock;
  let daysCovered = 0;
  let lastCovered = null;
  for (let i = 0; i < horizonDays; i++) {
    const date = toDateString(addCalendarDaysLocal(today, i));
    const plan = planByKey[`${productoId}_${date}`];
    let planned = 0;
    if (plan) planned = (plan.desayuno || 0) + (plan.comida || 0) + (plan.extra || 0);
    const consumption = planned > 0 ? planned : def;
    if (remaining <= 0) break;
    if (consumption > 0) { remaining -= consumption; daysCovered++; lastCovered = date; }
    else { lastCovered = date; daysCovered++; }
  }

  const tomorrow = toDateString(addCalendarDaysLocal(today, 1));
  const tPlan = planByKey[`${productoId}_${tomorrow}`];
  const planTomorrow = tPlan ? (tPlan.desayuno || 0) + (tPlan.comida || 0) + (tPlan.extra || 0) : 0;
  const projectedTomorrow = stock - planTomorrow;

  return {
    lastCovered,
    coversBeyond: lastCovered !== null && remaining > 0,
    daysCovered,
    projectedTomorrow,
    planTomorrow,
    shortTomorrow: projectedTomorrow < 0,
    empty: stock <= 0,
  };
}
// ---------- Deducción diaria automática de stock según la planificación ----------

/** Devuelve la fecha siguiente a la última deducción registrada (o hoy si no hay historial). */
function deductionStartDate(producto, today) {
  if (producto && producto.ultimaDeduccion) {
    return addCalendarDaysLocal(parseDateString(producto.ultimaDeduccion), 1);
  }
  return today;
}

/** Cantidad total planificada para un producto en una fecha concreta. */
function planTotal(plan) {
  if (!plan) return 0;
  return (Number(plan.desayuno) || 0) + (Number(plan.comida) || 0) + (Number(plan.extra) || 0);
}

/** Deducciones pendientes (producto + fecha + cantidad). Descuenta cada día ya
 *  pasado: desde el día siguiente a la última deducción de cada producto hasta ayer
 *  inclusive (hoy queda como previsión y se descuenta cuando se abra la app mañana).
 *  Solo incluye días con planificación > 0. Es una función pura para testearla en Node. */
export function pendingDeductions({ products, planByKey, todayStr }) {
  const today = typeof todayStr === "string" ? parseDateString(todayStr) : new Date(todayStr);
  const endMs = addCalendarDaysLocal(today, -1).getTime();
  const out = [];
  for (const p of products || []) {
    if (p.categoria !== "STOCK" || p.activo === false) continue;
    const from = deductionStartDate(p, today);
    if (from.getTime() > endMs) continue;
    for (let d = from; d.getTime() <= endMs; d = addCalendarDaysLocal(d, 1)) {
      const fecha = toDateString(d);
      const cantidad = planTotal(planByKey[`${p.id}_${fecha}`]);
      if (cantidad > 0) out.push({ productoId: p.id, fecha, cantidad });
    }
  }
  return out;
}

/** Aplica las deducciones de un producto sin dejar el stock en negativo.
 *  Devuelve el stock final y la lista de consumos realmente aplicados. */
export function applyConsumptionToStock(stockActual, items) {
  let stock = Number(stockActual) || 0;
  const applied = [];
  for (const it of items || []) {
    const consume = Math.min(Number(it.cantidad) || 0, Math.max(0, stock));
    if (consume <= 0) continue;
    stock -= consume;
    applied.push({ fecha: it.fecha, cantidad: consume });
  }
  return { stockFinal: stock, applied };
}
