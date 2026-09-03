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

import { parseDateString } from "./utils.js";

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