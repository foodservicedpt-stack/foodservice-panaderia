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
  const d = typeof date === "string" ? parseDateString(date) : date;
  return d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", ...(options || {}) });
}

export function parseDateString(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) throw new Error("Fecha inválida");
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    throw new Error("Fecha inválida");
  }
  return parsed;
}

export function addCalendarDays(date, days) {
  const d = typeof date === "string" ? parseDateString(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
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

// Cobertura (días) = cuántos días dura el stock actual.
//   - Recorre los consumos planificados día a día (si los hay).
//   - Después suma días con el consumo diario medio del producto.
//   - Devuelve null si hay stock pero no hay ningún dato de consumo (cobertura indeterminada).
export function calcCoverageDays(stockActual, consumosPlanificados, consumoDiarioDefecto) {
  const stock = Number(stockActual) || 0;
  const plan = (consumosPlanificados || []);
  const defaultConsumo = Number(consumoDiarioDefecto) || 0;

  if (stock <= 0) return 0;

  const hasConsumption = plan.some((c) => Number(c) > 0) || defaultConsumo > 0;
  if (!hasConsumption) return null;

  let remaining = stock;
  let days = 0;
  for (const consumo of plan) {
    if (remaining <= 0) break;
    const c = Number(consumo) || 0;
    if (c > 0) { remaining -= c; days++; }
  }

  if (remaining > 0 && defaultConsumo > 0) {
    days += Math.floor(remaining / defaultConsumo);
  }
  return days;
}

export function getStockStatus(coverageDays, marginDays) {
  if (coverageDays === null || coverageDays === undefined) return "info";
  if (coverageDays <= marginDays) return "danger";
  if (coverageDays <= marginDays + 1) return "warning";
  return "ok";
}

export function formatCoverageDays(days) {
  if (days === null || days === undefined) return "Sin datos";
  if (!Number.isFinite(days)) return "∞";
  return `${days} día${days === 1 ? "" : "s"}`;
}

export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
