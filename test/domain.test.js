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
