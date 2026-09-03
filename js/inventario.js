import { renderNav } from "./nav.js";
import { getInventario, addMovimiento } from "./data.js";
import { calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { quantityInput } from "./components.js";

renderNav("inventario.html");

const TIPOS = { AMASADA: "Amasada", AJUSTE: "Ajuste", CONSUMO: "Consumo", CORRECCION: "Corrección", COMPRA: "Compra" };
const STATUS_LABELS = { ok: "En stock", warning: "Bajo", danger: "Crítico", info: "Sin datos" };

function coverageText(p, coverageDays) {
  return coverageDays === null ? "Sin datos" : formatCoverageDays(coverageDays);
}

function productCard(p) {
  const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
  const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
  const rate = p.consumoDiarioDefecto || 0;
  const unidad = escapeHtml(p.unidad || "uds.");
  const rateLabel = rate > 0 ? `a ${rate}/día` : "";
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
        <span class="coverage-meta">Cobertura <strong>${coverageText(p, coverageDays)}</strong></span>
        ${rateLabel ? `<span class="rate-meta">${rateLabel}</span>` : ""}
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

  document.getElementById("productos-list").innerHTML = products.length
    ? products.map(productCard).join("")
    : `<p class="empty">No hay productos de tipo STOCK activos</p>`;

  document.getElementById("movimientos-body").innerHTML =
    movimientos
      .map(
        (m) => `<tr>
          <td data-label="Fecha">${formatDateES(m.fecha)}</td>
          <td data-label="Producto">${escapeHtml(m.producto?.nombre || "—")}</td>
          <td data-label="Cantidad">${m.cantidad > 0 ? "+" : ""}${m.cantidad}</td>
          <td data-label="Tipo">${escapeHtml(TIPOS[m.tipo] || m.tipo)}</td>
          <td data-label="Notas">${escapeHtml(m.notas || "—")}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="5" class="empty">Sin movimientos todavía</td></tr>`;

  document.querySelectorAll(".ajustar-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`qty-${id}`);
      const cantidad = Number(input.value);
      if (!cantidad) {
        toast("Introduce una cantidad válida (positiva o negativa)", "error");
        return;
      }
      const notas = document.getElementById("ajuste-notas").value.trim();
      if (!notas) {
        toast("Indica el motivo del ajuste", "error");
        return;
      }
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