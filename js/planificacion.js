import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion, getAmasadoras } from "./data.js";
import { addCalendarDays, getMondayOfWeek, toDateString, parseDateString, dayFull, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { getProduccionLifecycle, produccionTipo, defaultPlanAmount } from "./domain.js";

renderNav("planificacion.html");

const monthLabelEl = document.getElementById("month-label");
const calMonth = document.getElementById("cal-month");
const calWeek = document.getElementById("cal-week");
const calDayDetail = document.getElementById("cal-day-detail");

let monthDate = startOfMonth(new Date());
let selectedDate = toDateString(new Date());
let planState = null; // { products, byKey, amasByDate }

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function weekdayIndex(date) { return (date.getDay() + 6) % 7; }
function isToday(fecha) { return fecha === toDateString(new Date()); }
function dayTotal(e) { return e ? (e.desayuno || 0) + (e.comida || 0) + (e.extra || 0) : ""; }
const WEEKDAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

function moveMonth(delta) { monthDate = addMonths(monthDate, delta); selectedDate = toDateString(startOfMonth(monthDate)); loadWithState(document.getElementById("page-status"), load); }

document.getElementById("prev-month").addEventListener("click", () => moveMonth(-1));
document.getElementById("next-month").addEventListener("click", () => moveMonth(1));
document.getElementById("today-btn").addEventListener("click", () => { monthDate = startOfMonth(new Date()); selectedDate = toDateString(new Date()); loadWithState(document.getElementById("page-status"), load); });

// Valores por defecto: cada semana nueva nace con la planificación base (L-V etc.) si el
// día/producto aún no tiene planificación. Se escribe únicamente cuando falta (idempotente).
async function ensureDefaultPlan(products, byKey, weekMonday) {
  for (let i = 0; i < 7; i++) {
    const day = addCalendarDays(weekMonday, i);
    const fecha = toDateString(day);
    for (const p of products) {
      const key = `${p.id}_${fecha}`;
      if (byKey[key]) continue;
      const def = defaultPlanAmount(p.nombre, i);
      if (def === null) continue;
      try { await savePlanificacion({ productoId: p.id, fecha, desayuno: 0, comida: def, extra: 0, esExcepcion: false }); } catch (err) { console.warn("[plan] default", err.message); }
      byKey[key] = { productoId: p.id, fecha, desayuno: 0, comida: def, extra: 0 };
    }
  }
}

async function load() {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const startStr = toDateString(first);
  const endStr = toDateString(last);
  monthLabelEl.textContent = formatDateES(first, { month: "long", year: "numeric" });
  const [planRes, amasadoras] = await Promise.all([getPlanificacion(startStr, endStr), getAmasadoras()]);
  const byKey = {};
  planRes.planificaciones.forEach((p) => { byKey[`${p.productoId}_${p.fecha}`] = p; });
  const amasByDate = {};
  amasadoras.forEach((a) => { const d = a.fechaInicio; if (d) (amasByDate[d] = amasByDate[d] || []).push(a); });
  const products = planRes.products || [];
  planState = { products, byKey, amasByDate, days: Array.from({ length: 7 }, (_, i) => addCalendarDays(getMondayOfWeek(parseDateString(selectedDate)), i)) };
  await ensureDefaultPlan(products, byKey, getMondayOfWeek(parseDateString(selectedDate)));
  planState.days = Array.from({ length: 7 }, (_, i) => addCalendarDays(getMondayOfWeek(parseDateString(selectedDate)), i));
  render();
}

function summaryFor(fecha) {
  let panes = 0;
  let total = 0;
  (planState.products || []).forEach((p) => { const t = dayTotal(planState.byKey[`${p.id}_${fecha}`]); if (t) { panes++; total += Number(t); } });
  const prods = (planState.amasByDate[fecha] || []).length;
  return { panes, total, prods };
}

function renderMonthGrid() {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const firstDow = weekdayIndex(first);
  const totalDays = last.getDate();
  const weeks = Math.ceil((firstDow + totalDays) / 7);
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
    const s = summaryFor(fecha);
    const sel = fecha === selectedDate ? "active" : "";
    const today = isToday(fecha) ? "is-today" : "";
    return `<button class="cal-cell cal-day ${sel} ${today}" data-date="${fecha}"><span class="cal-day-num">${d.getDate()}</span>${(s.panes || s.prods) ? `<span class="cal-cell-summary">${s.panes ? `${s.panes} pan` : ""}${s.panes && s.prods ? " · " : ""}${s.prods ? `${s.prods} elab` : ""}</span>` : ""}</button>`;
  }).join("")}</div>`).join("");
  calMonth.innerHTML = head + grid;
  calMonth.querySelectorAll(".cal-day").forEach((btn) => {
    btn.addEventListener("click", () => { selectedDate = btn.dataset.date; planState.days = Array.from({ length: 7 }, (_, i) => addCalendarDays(getMondayOfWeek(parseDateString(selectedDate)), i)); render(); });
  });
}

function renderWeekList() {
  const days = planState.days;
  const rows = days.map((d, i) => {
    const fecha = toDateString(d);
    const s = summaryFor(fecha);
    const sel = fecha === selectedDate ? "active" : "";
    const today = isToday(fecha) ? "is-today" : "";
    return `<button class="cal-week-row ${sel} ${today}" data-date="${fecha}">
      <span class="cal-week-day">${escapeHtml(dayFull((d.getDay() + 6) % 7))} <b>${d.getDate()}</b></span>
      <span class="cal-week-summary">${s.panes ? `${s.panes} panes · ${s.total} uds` : "Sin producción"}${s.prods ? ` · ${s.prods} elab` : ""}</span>
      <span class="cal-week-arrow">›</span>
    </button>`;
  }).join("");
  calWeek.innerHTML = `<div class="cal-week-label">Semana del ${escapeHtml(formatDateES(days[0], { day: "numeric", month: "short" }))} al ${escapeHtml(formatDateES(days[6], { day: "numeric", month: "short" }))}</div>` + rows;
  calWeek.querySelectorAll(".cal-week-row").forEach((btn) => {
    btn.addEventListener("click", () => { selectedDate = btn.dataset.date; planState.days = Array.from({ length: 7 }, (_, i) => addCalendarDays(getMondayOfWeek(parseDateString(selectedDate)), i)); render(); });
  });
}

function renderDayDetail() {
  const fecha = selectedDate;
  const { products, byKey, amasByDate } = planState;
  const paneItems = products.map((p) => { const t = dayTotal(byKey[`${p.id}_${fecha}`]); return { p, value: t === "" ? 0 : Number(t) }; });
  const prodItems = (amasByDate[fecha] || []).map((a) => { const def = produccionTipo(a.tipo || "MASAS"); const lc = getProduccionLifecycle(a); return { nombre: a.producto?.nombre || a.nombre || def.label, hora: a.horaInicio || "", stage: lc.stage.key, label: def.label }; });
  const title = `<h4>${escapeHtml(formatDateES(fecha, { weekday: "long", day: "numeric", month: "long" }))}</h4>`;
  const panes = `<div class="cal-detail-section"><h5>Panes de consumo</h5>${paneItems.map(({ p, value }) => `<div class="cal-detail-item pane"><span>${escapeHtml(p.nombre)} <small>${escapeHtml(p.unidad || "uds.")}</small></span><input type="number" min="0" value="${value}" data-prod="${p.id}" data-fecha="${fecha}" class="plan-input" aria-label="${escapeHtml(p.nombre)}" /></div>`).join("")}</div>`;
  const prods = `<div class="cal-detail-section"><h5>Producciones</h5>${prodItems.length ? prodItems.map((it) => `<div class="cal-detail-item amas"><span>${escapeHtml(it.nombre)}${it.hora ? ` · ${escapeHtml(it.hora)}` : ""}</span><em>${escapeHtml(it.label || it.stage)}</em></div>`).join("") : `<p class="empty">Sin producciones este día</p>`}</div>`;
  calDayDetail.innerHTML = title + panes + prods;
}

function render() {
  renderMonthGrid();
  renderWeekList();
  renderDayDetail();
}

// Guardar cantidades editadas en el detalle del día.
calDayDetail.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.matches(".plan-input")) return;
  const cantidad = parseInt(input.value) || 0;
  input.disabled = true;
  try {
    await savePlanificacion({ productoId: input.dataset.prod, fecha: input.dataset.fecha, desayuno: 0, comida: cantidad, extra: 0, esExcepcion: false });
    toast("Guardado", "success");
  } catch (err) {
    toast("Error: " + err.message, "error");
  } finally {
    input.disabled = false;
  }
});

loadWithState(document.getElementById("page-status"), load);
