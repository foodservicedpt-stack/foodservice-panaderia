import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion } from "./data.js";
import { addCalendarDays, getMondayOfWeek, toDateString, dayAbbr, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";

renderNav("planificacion.html");

const planMobile = document.getElementById("plan-mobile");
const planDesktop = document.getElementById("plan-desktop");
const weekLabelEl = document.getElementById("week-label");
const weekSubEl = document.getElementById("week-sub");

let week = getMondayOfWeek(new Date());
let selectedDate = toDateString(week);
let planState = null;

function daysOfWeek() { return Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i)); }
function dayAbbrFromDate(d) { return dayAbbr(d.getDay() === 0 ? 6 : d.getDay() - 1); }
function isCurrentWeek() { return toDateString(week) === toDateString(getMondayOfWeek(new Date())); }
function isToday(fecha) { return fecha === toDateString(new Date()); }
function dayTotal(e) { return e ? (e.desayuno || 0) + (e.comida || 0) + (e.extra || 0) : ""; }

function moveWeek(delta) { week = addCalendarDays(week, 7 * delta); loadWithState(document.getElementById("page-status"), load); }

document.getElementById("prev-week").addEventListener("click", () => moveWeek(-1));
document.getElementById("next-week").addEventListener("click", () => moveWeek(1));
document.getElementById("today-btn").addEventListener("click", () => {
  week = getMondayOfWeek(new Date());
  selectedDate = toDateString(new Date());
  loadWithState(document.getElementById("page-status"), load);
});

async function load() {
  const days = daysOfWeek();
  const start = toDateString(days[0]);
  const end = toDateString(days[6]);
  weekLabelEl.textContent = `${formatDateES(days[0], { day: "numeric", month: "short" })} – ${formatDateES(days[6], { day: "numeric", month: "short" })}`;
  weekSubEl.textContent = isCurrentWeek() ? "Semana actual" : "Semana del " + formatDateES(days[0], { month: "long" });

  const { planificaciones, products } = await getPlanificacion(start, end);
  const byKey = {};
  planificaciones.forEach((p) => { byKey[`${p.productoId}_${p.fecha}`] = p; });
  planState = { days, products, byKey };

  if (!products.length) {
    planMobile.innerHTML = `<p class="empty">No hay productos de tipo STOCK activos</p>`;
    planDesktop.innerHTML = "";
    return;
  }
  if (!days.some((d) => toDateString(d) === selectedDate)) selectedDate = toDateString(days[0]);
  renderDesktop();
  renderMobile();
}

function renderDesktop() {
  const { days, products, byKey } = planState;
  planDesktop.innerHTML = `<div class="table-scroll planning-table-scroll"><table class="planning-table">
    <thead><tr><th>Producto</th>${days.map((d) => { const fecha = toDateString(d); return `<th class="${isToday(fecha) ? "is-today" : ""}">${dayAbbrFromDate(d)}<small>${d.getDate()}</small></th>`; }).join("")}</tr></thead>
    <tbody>${products.map((p) => `<tr>
      <td class="planning-product"><strong>${escapeHtml(p.nombre)}</strong><span class="planning-unit">${escapeHtml(p.unidad || "uds.")}</span></td>
      ${days.map((d) => { const fecha = toDateString(d); const key = `${p.id}_${fecha}`; const total = dayTotal(byKey[key]); return `<td class="${isToday(fecha) ? "is-today" : ""}"><input type="number" min="0" value="${total}" data-prod="${p.id}" data-fecha="${fecha}" class="plan-input" aria-label="${escapeHtml(p.nombre)}, ${formatDateES(d, { weekday: "long" })}" /></td>`; }).join("")}
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderMobile() {
  const { days, products, byKey } = planState;
  const strip = `<div class="plan-day-strip">${days.map((d) => { const fecha = toDateString(d); return `<button class="plan-day-chip ${fecha === selectedDate ? "active" : ""}" data-date="${fecha}" aria-label="Día ${formatDateES(d, { weekday: "long" })}"><span>${dayAbbrFromDate(d)}</span><strong>${d.getDate()}</strong></button>`; }).join("")}</div>`;
  const list = `<div class="plan-day-list">${products.map((p) => { const key = `${p.id}_${selectedDate}`; const total = dayTotal(byKey[key]); return `<div class="plan-day-item"><span class="plan-day-item-name">${escapeHtml(p.nombre)}</span><span class="plan-day-item-unit">${escapeHtml(p.unidad || "uds.")}</span><input type="number" min="0" value="${total}" data-prod="${p.id}" data-fecha="${selectedDate}" class="plan-input" aria-label="${escapeHtml(p.nombre)}, ${formatDateES(selectedDate, { weekday: "long" })}" /></div>`; }).join("")}</div>`;
  planMobile.innerHTML = strip + list;
}

// Delegación de eventos (se registra una vez)
for (const container of [planMobile, planDesktop]) {
  container.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.matches(".plan-input")) return;
    const productoId = input.dataset.prod;
    const fecha = input.dataset.fecha;
    const cantidad = parseInt(input.value) || 0;
    const cell = input.closest("td") || input.closest(".plan-day-item");
    input.disabled = true;
    if (cell) cell.classList.add("is-saving");
    try {
      await savePlanificacion({ productoId, fecha, desayuno: 0, comida: cantidad, extra: 0, esExcepcion: false });
      if (cell) { cell.classList.add("is-saved"); setTimeout(() => cell.classList.remove("is-saved"), 1200); }
    } catch (err) {
      toast("Error al guardar: " + err.message, "error");
    } finally {
      input.disabled = false;
      if (cell) cell.classList.remove("is-saving");
    }
  });
  container.addEventListener("click", (event) => {
    const chip = event.target.closest(".plan-day-chip");
    if (!chip) return;
    selectedDate = chip.dataset.date;
    renderMobile();
  });
}

loadWithState(document.getElementById("page-status"), load);
