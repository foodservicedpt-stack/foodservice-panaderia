import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion, getAmasadoras, getPlanDefaultRules } from "./data.js";
import { addCalendarDays, getMondayOfWeek, toDateString, parseDateString, dayFull, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { getProduccionLifecycle, produccionTipo, defaultPlanAmount } from "./domain.js";

renderNav("planificacion.html");

const weekLabelEl = document.getElementById("week-label");
const overviewEl = document.getElementById("plan-overview");
const detailEl = document.getElementById("plan-detail");
const detailDateEl = document.getElementById("detail-date");
const detailPanesEl = document.getElementById("detail-panes");
const detailProdsEl = document.getElementById("detail-productions");
const calMonth = document.getElementById("cal-month");
const calWeek = document.getElementById("cal-week");
const dayStrip = document.getElementById("plan-day-strip");

const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

let week = getMondayOfWeek(new Date());
let selectedDate = toDateString(new Date());
let monthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let detailOpen = false;
let planState = null; // { products, byKey, amasByDate, days }
let planRules = null;

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function weekdayIndex(date) { return (date.getDay() + 6) % 7; }
function isToday(fecha) { return fecha === toDateString(new Date()); }
function dayTotal(e) { return e ? (e.desayuno || 0) + (e.comida || 0) + (e.extra || 0) : ""; }
function weekDays() { return Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i)); }

function setWeek(delta) { week = addCalendarDays(week, 7 * delta); selectedDate = toDateString(week); monthDate = startOfMonth(week); loadWithState(document.getElementById("page-status"), load); }
function setToday() { week = getMondayOfWeek(new Date()); selectedDate = toDateString(new Date()); monthDate = startOfMonth(new Date()); loadWithState(document.getElementById("page-status"), load); }

document.getElementById("prev-week").addEventListener("click", () => setWeek(-1));
document.getElementById("next-week").addEventListener("click", () => setWeek(1));
document.getElementById("today-btn").addEventListener("click", setToday);

// --- Valores por defecto: cada semana nueva nace con la planificación base ---
async function ensureDefaultPlan(products, byKey, weekMonday) {
  for (let i = 0; i < 7; i++) {
    const day = addCalendarDays(weekMonday, i);
    const fecha = toDateString(day);
    for (const p of products) {
      const key = `${p.id}_${fecha}`;
      if (byKey[key]) continue;
      const def = defaultPlanAmount(p.nombre, i, planRules);
      if (def === null) continue;
      try { await savePlanificacion({ productoId: p.id, fecha, desayuno: 0, comida: def, extra: 0, esExcepcion: false }); } catch (err) { console.warn("[plan] default", err.message); }
      byKey[key] = { productoId: p.id, fecha, desayuno: 0, comida: def, extra: 0 };
    }
  }
}

async function load() {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const [planRes, amasadoras, planRulesDb] = await Promise.all([getPlanificacion(toDateString(first), toDateString(last)), getAmasadoras(), getPlanDefaultRules()]);
  planRules = planRulesDb;
  const byKey = {};
  planRes.planificaciones.forEach((p) => { byKey[`${p.productoId}_${p.fecha}`] = p; });
  const amasByDate = {};
  amasadoras.forEach((a) => { const d = a.fechaInicio; if (d) (amasByDate[d] = amasByDate[d] || []).push(a); });
  planState = { products: planRes.products || [], byKey, amasByDate, days: weekDays() };
  await ensureDefaultPlan(planState.products, byKey, week);
  renderOverview();
}

function summaryFor(fecha) {
  const panes = [];
  (planState.products || []).forEach((p) => { const t = dayTotal(planState.byKey[`${p.id}_${fecha}`]); if (t) panes.push({ nombre: p.nombre, cantidad: Number(t) }); });
  const prods = (planState.amasByDate[fecha] || []);
  const helado = prods.filter((a) => a.tipo === "HELADO").length;
  return { panes, prodCount: prods.length, helado, total: panes.reduce((s, x) => s + x.cantidad, 0) };
}

function renderOverview() {
  weekLabelEl.textContent = `Semana del ${formatDateES(week, { day: "numeric", month: "short" })} al ${formatDateES(addCalendarDays(week, 6), { day: "numeric", month: "short" })}`;
  const days = weekDays();
  dayStrip.innerHTML = days.map((d) => {
    const fecha = toDateString(d);
    return `<button class="plan-day-chip ${fecha === selectedDate ? "active" : ""} ${isToday(fecha) ? "is-today" : ""}" data-date="${fecha}"><span>${DAY_SHORT[weekdayIndex(d)]}</span><b>${d.getDate()}</b></button>`;
  }).join("");
  renderMonthGrid();
  renderWeekCards(days);
  dayStrip.querySelectorAll(".plan-day-chip").forEach((b) => b.addEventListener("click", () => selectDay(b.dataset.date)));
}

function eventsFor(fecha) {
  const ev = [];
  (planState.products || []).forEach((p) => { const t = dayTotal(planState.byKey[`${p.id}_${fecha}`]); if (t) ev.push({ text: `${t} ${p.nombre}`, kind: "pane" }); });
  (planState.amasByDate[fecha] || []).forEach((a) => { const def = produccionTipo(a.tipo || "MASAS"); ev.push({ text: def.label, kind: "prod" }); });
  return ev;
}

function renderMonthGrid() {
  const first = startOfMonth(monthDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const firstDow = weekdayIndex(first);
  const totalDays = last.getDate();
  const weeks = Math.ceil((firstDow + totalDays) / 7);
  let n = 1;
  const rows = [];
  for (let w = 0; w < weeks; w++) { const row = []; for (let c = 0; c < 7; c++) { const idx = w * 7 + c; if (idx < firstDow || n > totalDays) row.push(null); else { row.push(new Date(first.getFullYear(), first.getMonth(), n)); n++; } } rows.push(row); }
  const head = `<div class="cal-weekdays">${WEEKDAY_HEADERS.map((h) => `<span class="cal-weekday">${h}</span>`).join("")}</div>`;
  const grid = rows.map((row) => `<div class="cal-row">${row.map((d) => {
    if (!d) return `<span class="cal-cell cal-empty"></span>`;
    const fecha = toDateString(d);
    const ev = eventsFor(fecha);
    const more = ev.length > 3 ? `<span class="cal-event more">+${ev.length - 3} más</span>` : "";
    const evs = ev.slice(0, 3).map((e) => `<span class="cal-event ${e.kind}">${escapeHtml(e.text)}</span>`).join("");
    return `<button class="cal-cell cal-day ${fecha === selectedDate ? "active" : ""} ${isToday(fecha) ? "is-today" : ""}" data-date="${fecha}"><span class="cal-day-num">${d.getDate()}</span>${ev.length ? `<span class="cal-day-events">${evs}${more}</span>` : ""}</button>`;
  }).join("")}</div>`).join("");
  calMonth.innerHTML = head + grid;
  calMonth.querySelectorAll(".cal-day").forEach((btn) => btn.addEventListener("click", () => selectDay(btn.dataset.date)));
}

function renderWeekCards(days) {
  calWeek.innerHTML = days.map((d) => {
    const fecha = toDateString(d);
    const s = summaryFor(fecha);
    const panesTxt = s.panes.length ? s.panes.map((p) => `${p.cantidad} ${p.nombre}`).join(" · ") : "Sin planificación";
    const meta = s.prodCount ? `${s.prodCount} elaboraciones${s.helado ? ` · ${s.helado} helado` : ""}` : "Sin producción";
    return `<button class="plan-day-card ${fecha === selectedDate ? "active" : ""} ${isToday(fecha) ? "is-today" : ""}" data-date="${fecha}">
      <span class="plan-day-card-head"><span class="plan-day-card-name">${escapeHtml(dayFull(weekdayIndex(d)))} <b>${d.getDate()}</b></span>${isToday(fecha) ? `<span class="plan-today-tag">HOY</span>` : ""}</span>
      <span class="plan-day-card-panes">${escapeHtml(panesTxt)}</span>
      <span class="plan-day-card-meta">${escapeHtml(meta)}</span>
      <span class="plan-day-card-arrow">›</span>
    </button>`;
  }).join("");
  calWeek.querySelectorAll(".plan-day-card").forEach((btn) => btn.addEventListener("click", () => selectDay(btn.dataset.date)));
}

function selectDay(fecha) {
  selectedDate = fecha;
  week = getMondayOfWeek(parseDateString(fecha));
  monthDate = startOfMonth(parseDateString(fecha));
  openDetail();
}

let savedScroll = 0;
function openDetail() {
  detailOpen = true;
  savedScroll = window.scrollY;
  overviewEl.hidden = true;
  overviewEl.setAttribute("aria-hidden", "true");
  detailEl.hidden = false;
  detailEl.scrollTop = 0;
  renderDetail();
  try { detailEl.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
}
function closeDetail() {
  detailOpen = false;
  detailEl.hidden = true;
  overviewEl.setAttribute("aria-hidden", "false");
  overviewEl.hidden = false;
  loadWithState(document.getElementById("page-status"), load).finally(() => window.scrollTo(0, savedScroll));
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && detailOpen) closeDetail(); });

document.getElementById("detail-back").addEventListener("click", closeDetail);
async function moveDetailDay(delta) { selectedDate = toDateString(addCalendarDays(parseDateString(selectedDate), delta)); week = getMondayOfWeek(parseDateString(selectedDate)); await ensureDefaultPlan(planState.products, planState.byKey, week); detailEl.scrollTop = 0; renderDetail(); }
document.getElementById("detail-prev").addEventListener("click", () => moveDetailDay(-1));
document.getElementById("detail-next").addEventListener("click", () => moveDetailDay(1));

function renderDetail() {
  const fecha = selectedDate;
  detailDateEl.textContent = formatDateES(fecha, { weekday: "long", day: "numeric", month: "long" });
  const wd = weekdayIndex(parseDateString(fecha));
  const products = planState.products || [];
  const withPlan = products.map((p) => {
    const t = dayTotal(planState.byKey[`${p.id}_${fecha}`]);
    const value = t === "" ? 0 : Number(t);
    const primary = (t !== "" && Number(t) > 0) || defaultPlanAmount(p.nombre, wd, planRules) !== null;
    return { p, value, primary };
  });
  const paneHtml = (list) => list.map(({ p, value }) => `<div class="detail-pane"><span class="detail-pane-name">${escapeHtml(p.nombre)}</span><div class="stepper" data-prod="${p.id}" data-fecha="${fecha}"><button class="step-btn" data-step="-1" aria-label="${escapeHtml(p.nombre)}: reducir">−</button><input class="stepper-input plan-input" type="number" inputmode="numeric" min="0" value="${value}" aria-label="${escapeHtml(p.nombre)}" /><button class="step-btn" data-step="1" aria-label="${escapeHtml(p.nombre)}: aumentar">＋</button></div></div>`).join("");
  const primary = withPlan.filter((x) => x.primary);
  const rest = withPlan.filter((x) => !x.primary);
  detailPanesEl.innerHTML = paneHtml(primary) + (rest.length ? `<details class="detail-others"><summary>Otros productos (${rest.length})</summary>${paneHtml(rest)}</details>` : "");
  const prods = (planState.amasByDate[fecha] || []).map((a) => { const def = produccionTipo(a.tipo || "MASAS"); const lc = getProduccionLifecycle(a); return { nombre: a.producto?.nombre || a.nombre || def.label, hora: a.horaInicio || "", meta: lc.stage.key, label: def.label }; });
  detailProdsEl.innerHTML = prods.length ? prods.map((it) => `<div class="detail-prod"><span class="detail-prod-name">${escapeHtml(it.nombre)}</span><span class="detail-prod-meta">${it.hora ? `${escapeHtml(it.hora)} · ` : ""}${escapeHtml(it.label || it.meta)}</span></div>`).join("") : `<p class="empty">Sin producciones este día</p>`;
}

// Stepper + edición directa en el detalle (delegado).
detailPanesEl.addEventListener("change", async (e) => { const i = e.target; if (!i.matches(".plan-input")) return; const qty = parseInt(i.value) || 0; i.disabled = true; try { await savePlanificacion({ productoId: i.closest(".stepper").dataset.prod, fecha: i.closest(".stepper").dataset.fecha, desayuno: 0, comida: qty, extra: 0, esExcepcion: false }); planState.byKey[`${i.closest(".stepper").dataset.prod}_${i.closest(".stepper").dataset.fecha}`] = { desayuno: 0, comida: qty, extra: 0 }; toast("Guardado", "success"); } catch (err) { toast("Error: " + err.message, "error"); } finally { i.disabled = false; } });
detailPanesEl.addEventListener("click", async (e) => { const b = e.target.closest(".step-btn"); if (!b) return; const step = parseInt(b.dataset.step); const stepper = b.closest(".stepper"); const input = stepper.querySelector(".plan-input"); const val = (parseInt(input.value) || 0) + step; if (val < 0) return; input.value = val; input.dispatchEvent(new Event("change", { bubbles: true })); });

loadWithState(document.getElementById("page-status"), load);
