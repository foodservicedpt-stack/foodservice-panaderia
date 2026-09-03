import { escapeHtml } from "./ui.js";

export function productOption(product) {
  return `<option value="${escapeHtml(product.id)}">${escapeHtml(product.nombre)}</option>`;
}

export function quantityInput({ id, label, value = "", min = 0, className = "quantity-input" }) {
  const minimum = min === "" ? "" : ` min="${escapeHtml(min)}"`;
  return `<input type="number" id="${escapeHtml(id)}" class="${className}"${minimum} value="${escapeHtml(value)}" aria-label="${escapeHtml(label)}" />`;
}
