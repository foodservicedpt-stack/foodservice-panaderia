import { escapeHtml } from "./ui.js";

export function productOption(product) {
  return `<option value="${escapeHtml(product.id)}">${escapeHtml(product.nombre)}</option>`;
}

export function quantityInput({ id, label, value = "", min = 0, className = "quantity-input", placeholder = "" }) {
  const minimum = min === "" ? "" : ` min="${escapeHtml(min)}"`;
  const ph = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : "";
  return `<input type="number" id="${escapeHtml(id)}" class="${className}"${minimum} value="${escapeHtml(value)}"${ph} aria-label="${escapeHtml(label)}" />`;
}