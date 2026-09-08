import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora, cancelarProduccion, eliminarProduccion, getPlanificacion, processDailyConsumption, confirmarConsumo } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES, toDateString, addCalendarDays } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { renderAmasadorasInto } from "./amasadoras-ui.js";
import { forecastStock, isProduccionVisible, produccionTipo, stockStatusFromForecast, getProduccionLifecycle } from "./domain.js";

renderNav("dashboard.html");

document.getElementById("saludo").textContent = `${getGreeting()}, equipo`;
document.getElementById("fecha").textContent = formatDateES(new Date(), { weekday: "long", day: "numeric", month: "long" });

let cachedPendientes = [];
let isBusy = false;

async function handleConfirm(id, piezas, btn) {
  const pzs = parseInt(piezas);
  if (!pzs || pzs <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
  isBusy = true; btn.disabled = true; btn.textContent = "Guardando...";
  try {
    await confirmarAmasadora({ amasadoraId: id, piezas: pzs });
    toast("Amasadora registrada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) { toast("Error al confirmar: " + err.message, "error"); btn.disabled = false; btn.textContent = "Registrar"; }
  finally { isBusy = false; }
}

async function handleCancel(id, btn) {
  isBusy = true; btn.disabled = true;
  try { await cancelarProduccion({ produccionId: id }); toast("Producción cancelada", "success"); loadWithState(document.getElementById("page-status"), load); }
  catch (err) { toast("Error: " + err.message, "error"); btn.disabled = false; }
  finally { isBusy = false; }
}

async function handleDelete(id, btn) {
  if (!btn.classList.contains("confirming")) {
    btn.classList.add("confirming"); btn.textContent = "¿Seguro?";
    setTimeout(() => { if (btn && btn.isConnected) { btn.classList.remove("confirming"); btn.textContent = "Eliminar"; } }, 3000);
    return;
  }
  isBusy = true; btn.disabled = true;
  try { await eliminarProduccion({ produccionId: id }); toast("Producción eliminada", "success"); loadWithState(document.getElementById("page-status"), load); }
  catch (err) { toast("Error: " + err.message, "error"); btn.disabled = false; }
  finally { isBusy = false; }
}

function buildForecastFor(products, planByKey, start) {
  return products.reduce((acc, p) => {
    acc[p.id] = forecastStock({ stockActual: p.stockActual || 0, consumoDiarioDefecto: p.consumoDiarioDefecto || 0, planByKey, productoId: p.id, todayStr: start, horizonDays: 45 });
    return acc;
  }, {});
}

function renderConfirmacion(products, planByKey, todayStr) {
  const container = document.getElementById("confirm-card");
  const body = document.getElementById("confirm-body");
  if (!container || !body) return 0;
  const tomorrow = toDateString(addCalendarDays(todayStr, 1));
  const items = (products || [])
    .filter((p) => !p.ultimaDeduccion || p.ultimaDeduccion < tomorrow)
    .map((p) => {
      const pl = planByKey[`${p.id}_${tomorrow}`];
      const total = pl ? (pl.desayuno || 0) + (pl.comida || 0) + (pl.extra || 0) : 0;
      return total > 0 ? { p, total } : null;
    })
    .filter(Boolean);
  if (!items.length) { container.hidden = true; return 0; }
  container.hidden = false;
  // Un único botón "Confirmar" por producto; la cantidad se puede ajustar en el propio input.
  body.innerHTML = items.map(({ p, total }) => `
    <div class="confirm-item">
      <div class="confirm-line"><strong>${escapeHtml(p.nombre)}</strong><span>para mañana</span></div>
      <div class="confirm-row">
        <input type="number" min="0" class="confirm-input" value="${total}" aria-label="Cantidad para mañana de ${escapeHtml(p.nombre)}" />
        <span class="confirm-unit">${escapeHtml(p.unidad || "uds.")}</span>
        <button class="secondary confirm-btn" data-prod="${p.id}" data-fecha="${tomorrow}">Confirmar</button>
      </div>
    </div>
  `).join("");
  body.querySelectorAll(".confirm-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".confirm-item");
      const cantidad = Number(item.querySelector(".confirm-input").value);
      if (cantidad < 0) { toast("Cantidad inválida", "error"); return; }
      btn.disabled = true;
      try {
        await confirmarConsumo({ productoId: btn.dataset.prod, fecha: btn.dataset.fecha, cantidad });
        toast("Consumo de mañana confirmado y descontado", "success");
        loadWithState(document.getElementById("page-status"), load);
      } catch (err) { toast("Error: " + err.message, "error"); btn.disabled = false; }
    });
  });
  return items.length;
}

async function load() {
  // Descuenta automáticamente la planificación de cada día (si aún no se ha hecho).
  let settle = null;
  try { settle = await processDailyConsumption(); } catch (err) { console.warn("[dailyConsumption]", err.message); }
  if (settle && settle.appliedDays > 0) {
    toast(settle.appliedDays === 1 ? "Se descontó el consumo planificado de ayer." : `Se descontó el consumo planificado de ${settle.appliedDays} días.`, "info", { title: "Stock actualizado" });
  }
  const [products, amasadoras] = await Promise.all([getProductosStock(), getAmasadoras()]);
  const todayD = new Date();
  const start = toDateString(todayD);
  const end = toDateString(addCalendarDays(todayD, 45));
  const { planificaciones } = await getPlanificacion(start, end);
  const planByKey = {};
  planificaciones.forEach((p) => { planByKey[`${p.productoId}_${p.fecha}`] = p; });
  const forecast = buildForecastFor(products, planByKey, start);
  const withStatus = products.map((p) => {
    const f = forecast[p.id];
    const coverageDays = f && f.lastCovered ? f.daysCovered : null;
    const status = stockStatusFromForecast(f, p.margenSeguridadDias || 0);
    return { ...p, coverageDays, status, forecast: forecast[p.id] };
  });
  const alerts = withStatus.filter((p) => p.status === "danger" || (p.forecast && p.forecast.shortTomorrow));

  if (alerts.length) {
    document.getElementById("alerts-card").hidden = false;
    document.getElementById("alerts-body").innerHTML = alerts
      .map((p) => {
        const rate = p.consumoDiarioDefecto || 0;
        const f = p.forecast;
        const hasta = f && f.lastCovered ? formatDateES(f.lastCovered, { weekday: "short", day: "numeric", month: "short" }) : (f && f.shortTomorrow ? "no llega a mañana" : "más allá");
        return `<tr>
          <td data-label="Producto">${escapeHtml(p.nombre)}</td>
          <td data-label="Stock">${p.stockActual} ${escapeHtml(p.unidad || "")}</td>
          <td data-label="Cobertura"><div><span class="badge ${p.status}">${formatCoverageDays(p.coverageDays)}</span>${rate > 0 ? `<small class="meta-text rate-text">a ${rate}/día</small>` : ""}</div></td>
          <td data-label="Hasta">${escapeHtml(hasta)}${f && f.shortTomorrow ? `<span class="badge danger">no llega</span>` : ""}</td>
        </tr>`;
      })
      .join("");
  }

  const now = new Date();
  // En Inicio solo amasadoras YA iniciadas y no finalizadas/expiradas (fuente única: ciclo de vida).
  const pendientes = amasadoras.filter((a) => { const lc = getProduccionLifecycle(a, now); return lc.active && lc.started; });
  cachedPendientes = pendientes;
  if (pendientes.length) {
    document.getElementById("amasadoras-card").hidden = false;
    renderAmasadorasInto(document.getElementById("amasadoras-list"), pendientes, now, { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
  }

  const pendingConfirmaciones = renderConfirmacion(products, planByKey, start);

  const focus = document.getElementById("dashboard-focus");
  if (!alerts.length && !pendientes.length && !pendingConfirmaciones) {
    focus.hidden = false;
    focus.innerHTML = `<div class="empty-state-ok"><span class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><strong>Todo en orden</strong><p>No hay productos bajo mínimos, ni faltan existencias para mañana ni producciones pendientes.</p></div></div>`;
  } else { focus.hidden = true; }
}

loadWithState(document.getElementById("page-status"), load);

setInterval(() => {
  if (!isBusy && cachedPendientes.length) renderAmasadorasInto(document.getElementById("amasadoras-list"), cachedPendientes, new Date(), { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
}, 30000);
