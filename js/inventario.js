import { renderNav } from "./nav.js";
import { getInventario, addMovimiento } from "./data.js";
import { calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { quantityInput } from "./components.js";

renderNav("inventario.html");

const TIPOS = { AMASADA: "Amasada", AJUSTE: "Ajuste", CONSUMO: "Consumo", CORRECCION: "Corrección", COMPRA: "Compra" };

async function load() {
  const { products, movimientos } = await getInventario();

  document.getElementById("productos-body").innerHTML = products
    .map((p) => {
      const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
      const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
      const rate = p.consumoDiarioDefecto || 0;
      const coverageCell = coverageDays === null
        ? `<span class="badge info">Sin datos</span>`
        : `<div>
             <span class="badge ${status}">${formatCoverageDays(coverageDays)}</span>
             ${rate > 0 ? `<small class="meta-text rate-text">a ${rate}/día</small>` : ""}
           </div>`;
      return `<tr>
        <td data-label="Producto">${escapeHtml(p.nombre)}</td>
        <td data-label="Stock">${p.stockActual ?? 0}</td>
        <td data-label="Cobertura">${coverageCell}</td>
        <td data-label="Ajustar">
          <div class="row">
            ${quantityInput({ id: `qty-${p.id}`, label: `Cantidad a ajustar para ${p.nombre}`, min: "" })}
            <button data-id="${p.id}" class="ajustar-btn">Aplicar</button>
          </div>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4" class="empty">No hay productos de tipo STOCK activos</td></tr>`;

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
      btn.disabled = true;
      try {
        const notas = document.getElementById("ajuste-notas").value.trim();
        if (!notas) {
          toast("Indica el motivo del ajuste", "error");
          return;
        }
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
