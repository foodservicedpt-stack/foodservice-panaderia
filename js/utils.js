// Utilidades de negocio (equivalente a lib/business-logic.ts del proyecto original)

export function nextBusinessDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

export function prevBusinessDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

export function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getMondayOfWeek(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateES(date, options) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", ...(options || {}) });
}

export function dayAbbr(dayIndex) {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return days[dayIndex] ?? "";
}

export function dayFull(dayIndex) {
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return days[dayIndex] ?? "";
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function calcCoverageDays(stockActual, consumosPlanificados, consumoDiarioDefecto) {
  let stock = stockActual;
  let days = 0;
  for (const consumo of consumosPlanificados) {
    if (stock <= 0) break;
    stock -= consumo;
    days++;
  }
  if (stock > 0 && consumoDiarioDefecto > 0) {
    days += Math.floor(stock / consumoDiarioDefecto);
  }
  return days;
}

export function getStockStatus(coverageDays, marginDays) {
  if (coverageDays <= marginDays) return "danger";
  if (coverageDays <= marginDays + 1) return "warning";
  return "ok";
}

export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
