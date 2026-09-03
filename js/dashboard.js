import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora, cancelarProduccion, eliminarProduccion, getPlanificacion } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES, toDateString, addCalendarDays } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { renderAmasadorasInto } from "./amasadoras-ui.js";
import { forecastStock, isProduccionVisible, produccionTipo } from "./domain.js";

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

async function buildForecastFor(products) {
  const today = new Date();
  const start = toDateString(today);
  const end = toDateString(addCalendarDays(today, 45));
  const { planificaciones } = await getPlanificacion(start, end);
  const planByKey = {};
  planificaciones.forEach((p) => { planByKey[`${p.productoId}_${p.fecha}`] = p; });
  return products.reduce((acc, p) => {
    acc[p.id] = forecastStock({ stockActual: p.stockActual || 0, consumoDiarioDefecto: p.consumoDiarioDefecto || 0, planByKey, productoId: p.id, todayStr: start, horizonDays: 45 });
    return acc;
  }, {});
}

async function load() {
  const [products, amasadoras] = await Promise.all([getProductosStock(), getAmasadoras()]);
  const forecast = await buildForecastFor(products);
  const withStatus = products.map((p) => {
    const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
    const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
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
  const pendientes = amasadoras.filter((a) => a.estado !== "COMPLETADA" && isProduccionVisible(a, produccionTipo(a.tipo || "MASAS"), now));
  cachedPendientes = pendientes;
  if (pendientes.length) {
    document.getElementById("amasadoras-card").hidden = false;
    renderAmasadorasInto(document.getElementById("amasadoras-list"), pendientes, now, { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
  }

  const focus = document.getElementById("dashboard-focus");
  if (!alerts.length && !pendientes.length) {
    focus.hidden = false;
    focus.innerHTML = `<div class="empty-state-ok"><span class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><strong>Todo en orden</strong><p>No hay productos bajo mínimos, ni faltan existencias para mañana ni producciones pendientes.</p></div></div>`;
  } else { focus.hidden = true; }
}

loadWithState(document.getElementById("page-status"), load);

setInterval(() => {
  if (!isBusy && cachedPendientes.length) renderAmasadorasInto(document.getElementById("amasadoras-list"), cachedPendientes, new Date(), { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
}, 30000);