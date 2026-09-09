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

import { produccionStages, getProduccionStage, isProduccionVisible, produccionTipo, forecastStock, pendingDeductions, applyConsumptionToStock, getProduccionLifecycle, productionDayInfo, productionStartMs, groupProductionsByDay, stockStatusFromForecast, defaultPlanAmount, DEFAULT_PLAN } from "../js/domain.js";

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

test("previsión de stock desde mañana (hoy ya está descontado)", () => {
  const planByKey = {
    "p1_2026-09-20": { desayuno: 30, comida: 20, extra: 0 },
    "p1_2026-09-21": { desayuno: 40, comida: 10, extra: 10 },
  };
  const f = forecastStock({ stockActual: 100, consumoDiarioDefecto: 10, planByKey, productoId: "p1", todayStr: "2026-09-20" });
  // La previsión arranca en mañana (09-21) y es plan-driven: consume 60 (días sin plan no alargan).
  assert.equal(f.daysCovered, 1);
  assert.equal(f.lastCovered, "2026-09-21");
  assert.equal(f.planTomorrow, 60);
  assert.equal(f.projectedTomorrow, 40);
  assert.equal(f.shortTomorrow, false);
});
test("deducciones pendientes: sin historial descuenta el consumo de hoy", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true }];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 50, comida: 0, extra: 0 },
    "p1_2026-09-20": { desayuno: 30, comida: 20, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [{ productoId: "p1", fecha: "2026-09-20", cantidad: 50 }]);
});

test("deducciones pendientes: descuenta hoy y no repite días ya descontados", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-19" }];
  const planByKey = {
    "p1_2026-09-19": { desayuno: 99, comida: 0, extra: 0 },
    "p1_2026-09-20": { desayuno: 30, comida: 20, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [{ productoId: "p1", fecha: "2026-09-20", cantidad: 50 }]);
});

test("deducciones pendientes: se pone al día tras varios días (incluido hoy)", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-16" }];
  const planByKey = {
    "p1_2026-09-17": { desayuno: 10, comida: 0, extra: 0 },
    "p1_2026-09-18": { desayuno: 20, comida: 0, extra: 0 },
    "p1_2026-09-19": { desayuno: 10, comida: 10, extra: 10 },
    "p1_2026-09-20": { desayuno: 40, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [
    { productoId: "p1", fecha: "2026-09-17", cantidad: 10 },
    { productoId: "p1", fecha: "2026-09-18", cantidad: 20 },
    { productoId: "p1", fecha: "2026-09-19", cantidad: 30 },
    { productoId: "p1", fecha: "2026-09-20", cantidad: 40 },
  ]);
});

test("deducciones pendientes: ignora días sin planificación", () => {
  const products = [{ id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-18" }];
  const d = pendingDeductions({ products, planByKey: {}, todayStr: "2026-09-20" });
  assert.deepEqual(d, []);
});

test("deducciones pendientes: ignora productos no STOCK o inactivos", () => {
  const products = [
    { id: "p1", categoria: "STOCK", activo: true, ultimaDeduccion: "2026-09-19" },
    { id: "p2", categoria: "SEMANAL", activo: true, ultimaDeduccion: "2026-09-19" },
    { id: "p3", categoria: "STOCK", activo: false, ultimaDeduccion: "2026-09-19" },
  ];
  const planByKey = {
    "p1_2026-09-20": { desayuno: 10, comida: 0, extra: 0 },
    "p2_2026-09-20": { desayuno: 10, comida: 0, extra: 0 },
    "p3_2026-09-20": { desayuno: 10, comida: 0, extra: 0 },
  };
  const d = pendingDeductions({ products, planByKey, todayStr: "2026-09-20" });
  assert.deepEqual(d, [{ productoId: "p1", fecha: "2026-09-20", cantidad: 10 }]);
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
test("ciclo de vida: helado cierra a las 16:30 del segundo día", () => {
  const h = { id: "h1", tipo: "HELADO", fechaInicio: "2026-09-20", estado: "PLANIFICADA", piezasProducidas: null, createdAt: "2026-09-10T10:00:00.000Z" };
  const before = getProduccionLifecycle(h, new Date(2026, 8, 21, 10, 0));
  assert.equal(before.active, true);
  assert.equal(before.isSecondDay, true);
  assert.equal(before.startLabel, "Iniciada");
  const after = getProduccionLifecycle(h, new Date(2026, 8, 21, 17, 0));
  assert.equal(after.active, false);
  assert.equal(after.finished, true);
  assert.equal(after.finishedByTime, true);
});

test("ciclo de vida: futura muestra Inicia el día", () => {
  const h = { id: "h1", tipo: "HELADO", fechaInicio: "2026-09-21", estado: "PLANIFICADA", piezasProducidas: null, createdAt: "2026-09-10T10:00:00.000Z" };
  const lc = getProduccionLifecycle(h, new Date(2026, 8, 20, 8, 0));
  assert.equal(lc.startLabel, "Inicia");
  assert.equal(lc.started, false);
  assert.equal(lc.active, true);
});

test("ciclo de vida: el pan (MASAS) no se cierra por tiempo", () => {
  const p = { id: "p1", tipo: "MASAS", fechaInicio: "2026-09-20", estado: "PLANIFICADA", piezasProducidas: null, createdAt: "2026-09-10T10:00:00.000Z" };
  const lc = getProduccionLifecycle(p, new Date(2026, 8, 23, 10, 0));
  assert.equal(lc.active, true);
  assert.equal(lc.finished, false);
});

test("ciclo de vida: day info usa la fecha de inicio", () => {
  assert.equal(productionDayInfo({ fechaInicio: "2026-09-20" }).fechaInicio, "2026-09-20");
});

test("agrupa producciones por día y ordena por hora de inicio", () => {
  const items = [
    { id: "b", fechaInicio: "2026-09-21", horaInicio: "10:30", tipo: "PANE_ESPECIAL" },
    { id: "a", fechaInicio: "2026-09-21", horaInicio: "07:30", tipo: "MASAS" },
    { id: "c", fechaInicio: "2026-09-20", horaInicio: "08:00", tipo: "HELADO" },
  ];
  const groups = groupProductionsByDay(items);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].day, "2026-09-20");
  assert.deepEqual(groups[1].items.map((i) => i.id), ["a", "b"]);
});

test("estado de stock según la previsión de planificación", () => {
  assert.equal(stockStatusFromForecast(null, 2), "ok");
  assert.equal(stockStatusFromForecast({ empty: true, shortTomorrow: false, daysCovered: 0 }, 2), "danger");
  assert.equal(stockStatusFromForecast({ empty: false, shortTomorrow: true, daysCovered: 0 }, 2), "danger");
  assert.equal(stockStatusFromForecast({ empty: false, shortTomorrow: false, daysCovered: 1 }, 2), "danger");
  assert.equal(stockStatusFromForecast({ empty: false, shortTomorrow: false, daysCovered: 0 }, 2), "ok");
});

test("inicio: solo amasadoras iniciadas y no expiradas (fuente: ciclo de vida)", () => {
  // Futura (mañana) -> no iniciada -> NO aparece en Inicio.
  const futura = { id: "f", tipo: "MASAS", fechaInicio: "2026-09-21", piezasProducidas: null, estado: "PLANIFICADA" };
  const lcF = getProduccionLifecycle(futura, new Date(2026, 8, 20, 10, 0));
  assert.equal(lcF.started, false);
  assert.equal(lcF.active && lcF.started, false);
  // Iniciada hoy a las 09:00 -> aparece.
  const iniciada = { id: "i", tipo: "MASAS", fechaInicio: "2026-09-20", horaInicio: "09:00", piezasProducidas: null, estado: "PLANIFICADA" };
  const lcI = getProduccionLifecycle(iniciada, new Date(2026, 8, 20, 10, 0));
  assert.equal(lcI.started, true);
  assert.equal(lcI.active && lcI.started, true);
  // Completada (piezas) -> no aparece.
  const comp = { id: "c", tipo: "MASAS", fechaInicio: "2026-09-20", piezasProducidas: 100, estado: "COMPLETADA" };
  const lcC = getProduccionLifecycle(comp, new Date(2026, 8, 20, 10, 0));
  assert.equal(lcC.active, false);
});

test("inicio: bizcocho expirado a las 16:30 del segundo día no aparece", () => {
  const b = { id: "b", tipo: "BIZCOCHO", fechaInicio: "2026-09-20", piezasProducidas: null, estado: "PLANIFICADA", createdAt: "2026-09-10T10:00:00.000Z" };
  // Escenario C: segundo día 16:29 -> activo.
  const c = getProduccionLifecycle(b, new Date(2026, 8, 21, 16, 29));
  assert.equal(c.active, true);
  assert.equal(c.started, true);
  // Escenario D: 16:30 -> finalizado.
  const d = getProduccionLifecycle(b, new Date(2026, 8, 21, 16, 30));
  assert.equal(d.finished, true);
  assert.equal(d.active, false);
  // Escenario E: 17:00 -> no activo (historial).
  const e = getProduccionLifecycle(b, new Date(2026, 8, 21, 17, 0));
  assert.equal(e.active, false);
});

test("inicio por hora: horaInicio determina cuándo se inicia", () => {
  const a = { id: "a", tipo: "MASAS", fechaInicio: "2026-09-20", horaInicio: "10:00", piezasProducidas: null };
  const start = productionStartMs(a);
  assert.equal(new Date(start).getHours(), 10);
  assert.equal(getProduccionLifecycle(a, new Date(2026, 8, 20, 10, 1)).started, true);
  assert.equal(getProduccionLifecycle(a, new Date(2026, 8, 20, 9, 59)).started, false);
});

test("valores por defecto por producto y día de la semana", () => {
  assert.equal(DEFAULT_PLAN.length, 4);
  assert.equal(defaultPlanAmount("Hogazas blancas", 0), 24);
  assert.equal(defaultPlanAmount("hogazas integrales", 4), 3);
  assert.equal(defaultPlanAmount("Bollitos blancos", 5), null);
  assert.equal(defaultPlanAmount("Barras blancas", 4), 50);
  assert.equal(defaultPlanAmount("Barras blancas", 6), 50);
  assert.equal(defaultPlanAmount("Otra cosa", 0), null);
});

test("defaultPlanAmount acepta reglas personalizadas", () => {
  const rules = [{ producto: "hogazas blancas", dias: [0, 1], cantidad: 35 }];
  assert.equal(defaultPlanAmount("Hogazas blancas", 0, rules), 35);
  assert.equal(defaultPlanAmount("Hogazas blancas", 2, rules), null);
});
