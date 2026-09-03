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
