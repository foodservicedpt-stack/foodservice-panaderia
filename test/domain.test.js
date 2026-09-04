import test from "node:test";
import assert from "node:assert/strict";
import {
  validateMovementInput,
  validateNonNegativeInteger,
  validateProductInput,
} from "../js/domain.js";

test("valida productos y sus parámetros", () => {
  assert.doesNotThrow(() => validateProductInput({
    nombre: "Pan", categoria: "STOCK", margenSeguridadDias: "2", consumoDiarioDefecto: "10",
  }));
  assert.throws(() => validateProductInput({ nombre: "", categoria: "STOCK" }), /nombre/);
  assert.throws(() => validateProductInput({ nombre: "Pan", categoria: "INVALIDA" }), /Categoría/);
});

test("rechaza cantidades no enteras o negativas", () => {
  assert.equal(validateNonNegativeInteger("4", "Cantidad"), 4);
  assert.throws(() => validateNonNegativeInteger("-1", "Cantidad"), /no negativo/);
  assert.throws(() => validateNonNegativeInteger("1.5", "Cantidad"), /entero/);
});

test("valida movimientos y motivos", () => {
  assert.doesNotThrow(() => validateMovementInput({ productoId: "p1", cantidad: -3, notas: "Merma" }));
  assert.throws(() => validateMovementInput({ productoId: "p1", cantidad: 0 }), /cantidad/);
  assert.throws(() => validateMovementInput({ productoId: "p1", cantidad: 1, notas: "x".repeat(201) }), /200/);
});

import { getAmasadoraStage, amasadoraMilestones } from "../js/domain.js";

// Amasadora planificada para el 20/09/2026, creada el 18/09 a las 10:00
const base = { id: "a1", productoId: "p1", fechaInicio: "2026-09-20", piezasProducidas: null, createdAt: "2026-09-18T10:00:00.000Z" };
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0);

test("hitos de la amasadora por tiempo", () => {
  const m = amasadoraMilestones("2026-09-20");
  assert.equal(m.kneadStart.getDate(), 20);
  assert.equal(m.kneadStart.getHours(), 0);
  assert.equal(m.fermentStart.getHours(), 15);
  assert.equal(m.fermentStart.getMinutes(), 30);
  assert.equal(m.bakeStart.getDate(), 21);
  assert.equal(m.bakeStart.getHours(), 0);
});

test("etapa inicial planificada antes del día de inicio", () => {
  const s = getAmasadoraStage({ ...base }, at(2026, 9, 19, 12, 0));
  assert.equal(s.key, "PLANIFICADA");
});

test("amasado el día de inicio antes de las 15:30", () => {
  const s = getAmasadoraStage({ ...base }, at(2026, 9, 20, 8, 0));
  assert.equal(s.key, "AMASADO");
  assert.ok(s.progress > 0 && s.progress < 1);
});

test("fermentando tras las 15:30 hasta el día siguiente", () => {
  const s = getAmasadoraStage({ ...base }, at(2026, 9, 20, 18, 0));
  assert.equal(s.key, "FERMENTANDO");
});

test("horneado al llegar el día siguiente", () => {
  const s = getAmasadoraStage({ ...base }, at(2026, 9, 21, 6, 0));
  assert.equal(s.key, "HORNEADO");
});

test("permanece en horneado (100%) esperando piezas pasada la ventana", () => {
  const s = getAmasadoraStage({ ...base }, at(2026, 9, 22, 12, 0));
  assert.equal(s.key, "HORNEADO");
  assert.equal(s.progress, 1);
});

test("completada cuando se registran piezas", () => {
  const s = getAmasadoraStage({ ...base, piezasProducidas: 120 }, at(2026, 9, 20, 8, 0));
  assert.equal(s.key, "COMPLETADA");
  assert.equal(s.overall, 100);
});

test("avance crece de forma continua dentro de una etapa", () => {
  const early = getAmasadoraStage({ ...base }, at(2026, 9, 20, 7, 45));
  const late = getAmasadoraStage({ ...base }, at(2026, 9, 20, 15, 15));
  // Hacia el final del amasado el avance debe ser mayor
  assert.ok(late.progress > early.progress);
});


test("valida la unidad del producto", () => {
  assert.doesNotThrow(() => validateProductInput({ nombre: "Pan", unidad: "uds." }));
  assert.doesNotThrow(() => validateProductInput({ nombre: "Pan", unidad: "kg" }));
  assert.throws(() => validateProductInput({ nombre: "Pan", unidad: "x".repeat(13) }), /unidad/);
});

import { produccionStages, getProduccionStage, isProduccionVisible, produccionTipo, forecastStock, pendingDeductions, applyConsumptionToStock } from "../js/domain.js";

test("etapas y horarios de cada tipo de producción", () => {
  assert.equal(produccionStages("MASAS", "2026-09-20", "2026-09-15T10:00:00.000Z").length, 4);
  assert.deepEqual(produccionStages("YOGUR", "2026-09-20", "2026-09-10T10:00:00.000Z").map((s) => s.key), ["PREVISION", "PREPARACION", "FERMENTACION", "ENVASADO"]);
  assert.deepEqual(produccionStages("HELADO", "2026-09-20", "2026-09-10T10:00:00.000Z").map((s) => s.key), ["PREVISION", "MEZCLA", "MADURACION", "SERVICIO"]);
  assert.deepEqual(produccionStages("BIZCOCHO", "2026-09-20", "2026-09-10T10:00:00.000Z").map((s) => s.key), ["PREVISION", "PREPARACION", "HORNEADO", "CONSERVACION"]);
});

test("yogur: prepara el día propio, visible el día anterior", () => {
  const y = { id: "y1", tipo: "YOGUR", fechaInicio: "2026-09-20", createdAt: "2026-09-10T10:00:00.000Z" };
  assert.equal(getProduccionStage(y, new Date(2026, 8, 20, 8, 0)).key, "PREPARACION");
  assert.equal(getProduccionStage(y, new Date(2026, 8, 20, 20, 0)).key, "FERMENTACION");
  const def = produccionTipo("YOGUR");
  assert.ok(isProduccionVisible(y, def, new Date(2026, 8, 19, 12, 0)));
  assert.ok(!isProduccionVisible(y, def, new Date(2026, 8, 13, 12, 0)));
});

test("previsión de stock según la planificación", () => {
  const planByKey = {
    "p1_2026-09-20": { desayuno: 30, comida: 20, extra: 0 },
    "p1_2026-09-21": { desayuno: 40, comida: 10, extra: 10 },
  };
  const f = forecastStock({ stockActual: 100, consumoDiarioDefecto: 10, planByKey, productoId: "p1", todayStr: "2026-09-20" });
  assert.equal(f.daysCovered, 2);
  assert.equal(f.lastCovered, "2026-09-21");
  assert.equal(f.planTomorrow, 60);
  assert.equal(f.projectedTomorrow, 40);
  assert.equal(f.shortTomorrow, false);
});
test("deducciones pendientes: sin historial no descuenta días pasados ni hoy", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true }];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 50, comida: 0, extra: 0 },
    "p1_2026-09-20": { desayuno: 30, comida: 20, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, []);
});

test("deducciones pendientes: descuenta la planificación de ayer, no la de hoy", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-18" }];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 30, comida: 0, extra: 0 },
    "p1_2026-09-20": { desayuno: 99, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [{ productoId: "p1", fecha: "2026-09-19", cantidad: 30 }]);
});

test("deducciones pendientes: no repite días ya descontados", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-19" }];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 99, comida: 0, extra: 0 },
    "p1_2026-09-20": { desayuno: 50, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, []);
});

test("deducciones pendientes: se pone al día tras varios días", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-16" }];
  const planByKey = {
    "p1_2026-09-17": { desayuno: 10, comida: 0, extra: 0 },
    "p1_2026-09-18": { desayuno: 20, comida: 0, extra: 0 },
    "p1_2026-09-19": { desayuno: 10, comida: 10, extra: 10 },
    "p1_2026-09-20": { desayuno: 500, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [
    { productoId: "p1", fecha: "2026-09-17", cantidad: 10 },
    { productoId: "p1", fecha: "2026-09-18", cantidad: 20 },
    { productoId: "p1", fecha: "2026-09-19", cantidad: 30 },
  ]);
});

test("deducciones pendientes: ignora días sin planificación", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-18" }];
  const d = pendingDeductions({ products, planByKey: {}, todayStr: "2026-09-20" });
  assert.deepEqual(d, []);
});

test("deducciones pendientes: ignora productos no STOCK o inactivos", () => {
  const products = [
    { id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-18" },
    { id: "p2", categoria: "SEMANAL", activo: true, ultimaDeduccion: "2026-09-18" },
    { id: "p3", categoria: "STOCK", activo: false, ultimaDeduccion: "2026-09-18" },
  ];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 10, comida: 0, extra: 0 },
    "p2_2026-09-19": { desayuno: 10, comida: 0, extra: 0 },
    "p3_2026-09-19": { desayuno: 10, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [{ productoId: "p1", fecha: "2026-09-19", cantidad: 10 }]);
});

test("aplica consumo sin dejar stock negativo ni descontar de más", () => {
  const { stockFinal, applied } = applyConsumptionToStock(100, [
    { fecha: "2026-09-20", cantidad: 30 },
    { fecha: "2026-09-21", cantidad: 80 },
  ]);
  assert.equal(stockFinal, 0);
  assert.deepEqual(applied, [
    { fecha: "2026-09-20", cantidad: 30 },
    { fecha: "2026-09-21", cantidad: 70 },
  ]);
});
