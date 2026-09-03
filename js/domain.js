/**
 * @typedef {Object} Producto
 * @property {string} id
 * @property {string} nombre
 * @property {"STOCK"|"SEMANAL"|"OTRO"} categoria
 * @property {boolean} activo
 * @property {number} stockActual
 * @property {number} consumoDiarioDefecto
 * @property {number} margenSeguridadDias
 */

/**
 * @typedef {Object} Movimiento
 * @property {string} productoId
 * @property {number} cantidad
 * @property {string} tipo
 * @property {string|null} notas
 */

export const CATEGORIES = Object.freeze(["STOCK", "SEMANAL", "OTRO"]);
export const AMASADORA_STATES = Object.freeze(["EN_FERMENTACION", "COMPLETADA"]);

export function validateProductInput({ nombre, categoria, margenSeguridadDias, consumoDiarioDefecto }) {
  if (nombre !== undefined && (!String(nombre).trim() || String(nombre).length > 120)) {
    throw new Error("El nombre debe tener entre 1 y 120 caracteres");
  }
  if (categoria !== undefined && !CATEGORIES.includes(categoria)) {
    throw new Error("Categoría inválida");
  }
  if (margenSeguridadDias !== undefined) validateNonNegativeInteger(margenSeguridadDias, "El margen de seguridad");
  if (consumoDiarioDefecto !== undefined) validateNonNegativeInteger(consumoDiarioDefecto, "El consumo diario");
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
