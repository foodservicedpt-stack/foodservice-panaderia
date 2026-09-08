import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion, getSemanaModelo, saveSemanaModelo, getAmasadoras } from "./data.js";
import { addCalendarDays, getMondayOfWeek, toDateString, dayAbbr, dayFull, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { getProduccionLifecycle, produccionTipo } from "./domain.js";

renderNav("planificacion.html");

const planMobile = document.getElementById("plan-mobile");
const planDesktop = document.getElementById("plan-desktop");
const weekLabelEl = document.getElementById("week-label");
const weekSubEl = document.getElementById("week-sub");
const weekView = document.getElementById("week-view");
const monthView = document.getElementById("month-view");
const monthLabelEl = document.getElementById("month-label");
const calGrid = document.getElementById("cal-grid");
const calDayDetail = document.getElementById("cal-day-detail");

let week = getMondayOfWeek(new Date());
let selectedDate = toDateString(week);
let monthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let view = "week";
let planState = null;

function daysOfWeek() { return Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i)); }
function dayAbbrFromDate(d) { return dayAbbr(d.getDay() === 0 ? 6 : d.getDay() - 1); }
function isCurrentWeek() { return toDateString(week) === toDateString(getMondayOfWeek(new Date())); }
function isToday(fecha) { return fecha === toDateString(new Date()); }
function dayTotal(e) { return e ? (e.desayuno || 0) + (e.comida || 0) + (e.extra || 0) : ""; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function moveWeek(delta) { week = addCalendarDays(week, 7 * delta); loadWithState(document.getElementById("page-status"), load); }
function moveMonth(delta) { monthDate = addMonths(monthDate, delta); loadWithState(document.getElementById("page-status"), load); }
function setView(v) {
  view = v;
  weekView.hidden = v !== "week";
  monthView.hidden = v !== "month";
  document.querySelectorAll(".view-toggle-btn").forEach((b) => { const active = b.id === ("view-" + v); b.classList.toggle("active", active); b.setAttribute("aria-selected", String(active)); });
  loadWithState(document.getElementById("page-status"), load);
}

document.getElementById("prev-week").addEventListener("click", () => moveWeek(-1));
document.getElementById("next-week").addEventListener("click", () => moveWeek(1));
document.getElementById("today-btn").addEventListener("click", () => {
  week = getMondayOfWeek(new Date());
  selectedDate = toDateString(new Date());
  loadWithState(document.getElementById("page-status"), load);
});
document.getElementById("view-week").addEventListener("click", () => setView("week"));
document.getElementById("view-month").addEventListener("click", () => setView("month"));
document.getElementById("prev-month").addEventListener("click", () => moveMonth(-1));
document.getElementById("next-month").addEventListener("click", () => moveMonth(1));
document.getElementById("month-today").addEventListener("click", () => { monthDate = startOfMonth(new Date()); selectedDate = toDateString(new Date()); loadWithState(document.getElementById("page-status"), load); });

// --- Semana modelo ---
document.getElementById("guardar-modelo").addEventListener("click", async () => {
  if (!planState) return;
  const { products, days, byKey } = planState;
  const template = {};
  products.forEach((p) => { template[p.id] = days.map((d) => { const e = byKey[`${p.id}_${toDateString(d)}`]; const t = dayTotal(e); return t === "" ? 0 : Number(t); }); });
  try { await saveSemanaModelo(template); toast("Semana guardada como modelo", "success"); }
  catch (err) { toast("Error: " + err.message, "error"); }
});
document.getElementById("aplicar-modelo").addEventListener("click", async () => {
  try {
    const template = await getSemanaModelo();
    if (!template) { toast("Aún no hay una semana modelo guardada", "error"); return; }
    const { products, days } = planState;
    for (const p of products) {
      const arr = template[p.id];
      if (!arr) continue;
      for (let i = 0; i < days.length; i++) {
        const cantidad = Number(arr[i]) || 0;
        await savePlanificacion({ productoId: p.id, fecha: toDateString(days[i]), desayuno: 0, comida: cantidad, extra: 0, esExcepcion: false });
      }
    }
    toast("Semana modelo aplicada (puedes modificarla)", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) { toast("Error: " + err.message, "error"); }
});

async function load() {
  if (view === "month") { await renderCalendar(); return; }
  const days = daysOfWeek();
  const start = toDateString(days[0]);
  const end = toDateString(days[6]);
  weekLabelEl.textContent = `${formatDateES(days[0], { day: "numeric", month: "short" })} – ${formatDateES(days[6], { day: "numeric", month: "short" })}`;
  weekSubEl.textContent = isCurrentWeek() ? "Semana actual" : "Semana del " + formatDateES(days[0], { month: "long" });

  const { planificaciones, products } = await getPlanificacion(start, end);
  const byKey = {};
  planificaciones.forEach((p) => { byKey[`${p.productoId}_${p.fecha}`] = p; });
  planState = { days, products, byKey };

  if (!products.length) { planMobile.innerHTML = `<p class="empty">No hay productos de tipo STOCK activos</p>`; planDesktop.innerHTML = ""; return; }
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

// --- Vista calendario ---
const WEEKDAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

async function renderCalendar() {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const startStr = toDateString(first);
  const endStr = toDateString(last);
  monthLabelEl.textContent = formatDateES(first, { month: "long", year: "numeric" });
  const [planRes, amasadoras] = await Promise.all([getPlanificacion(startStr, endStr), getAmasadoras()]);
  const planByKey = {};
  planRes.planificaciones.forEach((p) => { planByKey[`${p.productoId}_${p.fecha}`] = p; });
  const amasByDate = {};
  amasadoras.forEach((a) => { const d = a.fechaInicio; if (d) (amasByDate[d] = amasByDate[d] || []).push(a); });
  renderMonthGrid(first, last, planRes.products || [], planByKey, amasByDate);
}

function renderMonthGrid(first, last, products, planByKey, amasByDate) {
  const firstDow = (first.getDay() + 6) % 7;
  const totalDays = last.getDate();
  const totalCells = firstDow + totalDays;
  const weeks = Math.ceil(totalCells / 7);
  let dayNum = 1;
  const rows = [];
  for (let w = 0; w < weeks; w++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      const idx = w * 7 + c;
      if (idx < firstDow || dayNum > totalDays) row.push(null);
      else { row.push(new Date(first.getFullYear(), first.getMonth(), dayNum)); dayNum++; }
    }
    rows.push(row);
  }
  const head = `<div class="cal-weekdays">${WEEKDAY_HEADERS.map((h) => `<span class="cal-weekday">${h}</span>`).join("")}</div>`;
  const grid = rows.map((row) => `<div class="cal-row">${row.map((d) => {
    if (!d) return `<span class="cal-cell cal-empty"></span>`;
    const fecha = toDateString(d);
    const hasPlan = Object.keys(planByKey).some((k) => k.endsWith("_" + fecha));
    const hasAmas = !!amasByDate[fecha];
    return `<button class="cal-cell cal-day ${fecha === selectedDate ? "active" : ""} ${isToday(fecha) ? "is-today" : ""}" data-date="${fecha}"><span class="cal-day-num">${d.getDate()}</span>${(hasPlan || hasAmas) ? `<span class="cal-badge ${hasAmas ? "amas" : ""}"></span>` : ""}</button>`;
  }).join("")}</div>`).join("");
  calGrid.innerHTML = head + grid;
  renderDayDetail(selectedDate, products, planByKey, amasByDate);
  calGrid.querySelectorAll(".cal-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDate = btn.dataset.date;
      calGrid.querySelectorAll(".cal-day").forEach((b) => b.classList.toggle("active", b === btn));
      renderDayDetail(selectedDate, products, planByKey, amasByDate);
    });
  });
}

function renderDayDetail(fecha, products, planByKey, amasByDate) {
  const items = [];
  (products || []).forEach((p) => { const e = planByKey[`${p.id}_${fecha}`]; const total = dayTotal(e); if (total) items.push({ tipo: "plan", nombre: p.nombre, total, unidad: p.unidad || "uds." }); });
  (amasByDate[fecha] || []).forEach((a) => { const def = produccionTipo(a.tipo || "MASAS"); const lc = getProduccionLifecycle(a); items.push({ tipo: "amas", nombre: a.producto?.nombre || a.nombre || def.label, hora: a.horaInicio || "", stage: lc.stage.key }); });
  const title = `<h4>${escapeHtml(formatDateES(fecha, { weekday: "long", day: "numeric", month: "long" }))}</h4>`;
  if (!items.length) { calDayDetail.innerHTML = title + `<p class="empty">Sin planificación ni producciones este día</p>`; return; }
  const list = items.map((it) => {
    if (it.tipo === "plan") return `<div class="cal-detail-item plan"><span>${escapeHtml(it.nombre)}</span><strong>${it.total} ${escapeHtml(it.unidad)}</strong></div>`;
    return `<div class="cal-detail-item amas"><span>${escapeHtml(it.nombre)}${it.hora ? ` · ${escapeHtml(it.hora)}` : ""}</span><em>${it.stage}</em></div>`;
  }).join("");
  calDayDetail.innerHTML = title + `<div class="cal-detail-list">${list}</div>`;
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
