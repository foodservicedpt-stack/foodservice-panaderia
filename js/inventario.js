import { renderNav } from "./nav.js";
import { getInventario, addMovimiento, getPlanificacion } from "./data.js";
import { calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES, toDateString, addCalendarDays } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { quantityInput } from "./components.js";
import { forecastStock } from "./domain.js";

renderNav("inventario.html");

const TIPOS = { AMASADA: "Amasada", AJUSTE: "Ajuste", CONSUMO: "Consumo", CORRECCION: "Corrección", COMPRA: "Compra" };
const STATUS_LABELS = { ok: "En stock", warning: "Bajo", danger: "Crítico", info: "Sin datos" };
const HORIZON = 45;

function coverageText(coverageDays) {
  return coverageDays === null ? "Sin datos" : formatCoverageDays(coverageDays);
}

async function buildForecast(products) {
  const today = new Date();
  const start = toDateString(today);
  const end = toDateString(addCalendarDays(today, HORIZON));
  const { planificaciones } = await getPlanificacion(start, end);
  const planByKey = {};
  planificaciones.forEach((p) => { planByKey[`${p.productoId}_${p.fecha}`] = p; });
  const map = {};
  products.forEach((p) => {
    map[p.id] = forecastStock({
      stockActual: p.stockActual || 0,
      consumoDiarioDefecto: p.consumoDiarioDefecto || 0,
      planByKey,
      productoId: p.id,
      todayStr: start,
      horizonDays: HORIZON,
    });
  });
  return map;
}

function productCard(p, fore) {
  const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
  const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
  const rate = p.consumoDiarioDefecto || 0;
  const unidad = escapeHtml(p.unidad || "uds.");
  const rateLabel = rate > 0 ? `a ${rate}/día` : "";
  const hasta = fore && fore.lastCovered ? formatDateES(fore.lastCovered, { weekday: "short", day: "numeric", month: "short" }) : "más allá";
  const manana = fore ? `${fore.projectedTomorrow}` : "—";
  const short = fore && fore.shortTomorrow;
  return `<article class="product-card" data-status="${status}">
    <div class="product-card-head">
      <h3 class="product-card-name">${escapeHtml(p.nombre)}</h3>
      <span class="badge ${status}">${STATUS_LABELS[status]}</span>
    </div>
    <div class="product-card-body">
      <div class="product-card-stock">
        <span class="product-stock-value">${p.stockActual ?? 0}</span>
        <span class="product-stock-unit">${unidad}</span>
      </div>
      <div class="product-card-meta">
        <span class="coverage-meta">Cobertura <strong>${coverageText(coverageDays)}</strong></span>
        ${rateLabel ? `<span class="rate-meta">${rateLabel}</span>` : ""}
      </div>
      <div class="product-card-forecast">
        <div class="forecast-item"><span class="forecast-label">Hasta</span><strong>${hasta}</strong>${short ? `<span class="badge danger">no llega</span>` : ""}</div>
        <div class="forecast-item"><span class="forecast-label">Mañana</span><strong>${manana} ${unidad}</strong>${short ? `<span class="badge danger">faltan</span>` : ""}</div>
      </div>
    </div>
    <div class="product-card-action">
      ${quantityInput({ id: `qty-${p.id}`, label: `Cantidad a ajustar para ${p.nombre}`, min: "", className: "quantity-input product-qty-input", placeholder: "+/- cantidad" })}
      <button class="ajustar-btn" data-id="${p.id}">Ajustar</button>
    </div>
  </article>`;
}

async function load() {
  const { products, movimientos } = await getInventario();
  const forecast = await buildForecast(products);
  document.getElementById("productos-list").innerHTML = products.length
    ? products.map((p) => productCard(p, forecast[p.id])).join("")
    : `<p class="empty">No hay productos de tipo STOCK activos</p>`;
  document.getElementById("movimientos-body").innerHTML =
    movimientos
      .map((m) => `<tr>
          <td data-label="Fecha">${formatDateES(m.fecha)}</td>
          <td data-label="Producto">${escapeHtml(m.producto?.nombre || "—")}</td>
          <td data-label="Cantidad">${m.cantidad > 0 ? "+" : ""}${m.cantidad}</td>
          <td data-label="Tipo">${escapeHtml(TIPOS[m.tipo] || m.tipo)}</td>
          <td data-label="Notas">${escapeHtml(m.notas || "—")}</td>
        </tr>`)
      .join("") || `<tr><td colspan="5" class="empty">Sin movimientos todavía</td></tr>`;
  document.querySelectorAll(".ajustar-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`qty-${id}`);
      const cantidad = Number(input.value);
      if (!cantidad) { toast("Introduce una cantidad válida (positiva o negativa)", "error"); return; }
      const notas = document.getElementById("ajuste-notas").value.trim();
      if (!notas) { toast("Indica el motivo del ajuste", "error"); return; }
      btn.disabled = true;
      try {
        await addMovimiento({ productoId: id, cantidad, tipo: "AJUSTE", notas });
        toast("Stock actualizado", "success");
        input.value = "";
        document.getElementById("ajuste-notas").value = "";
        loadWithState(document.getElementById("page-status"), load);
      } catch (err) {
        toast("Error: " + err.message, "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

loadWithState(document.getElementById("page-status"), load);

