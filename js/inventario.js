import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getInventario, addMovimiento } from "./data.js";
import { calcCoverageDays, getStockStatus, formatDateES } from "./utils.js";

requireSession();
renderNav("inventario.html");

const TIPOS = { AMASADA: "Amasada", AJUSTE: "Ajuste", CONSUMO: "Consumo", CORRECCION: "Corrección", COMPRA: "Compra" };

async function load() {
  const { products, movimientos } = await getInventario();

  document.getElementById("productos-body").innerHTML = products
    .map((p) => {
      const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
      const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
      return `<tr>
        <td data-label="Producto">${p.nombre}</td>
        <td data-label="Stock">${p.stockActual ?? 0}</td>
        <td data-label="Cobertura"><span class="badge ${status}">${coverageDays} días</span></td>
        <td data-label="Ajustar">
          <div class="row">
            <input type="number" placeholder="+/- cantidad" style="width:110px; margin:0;" id="qty-${p.id}" />
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
          <td data-label="Producto">${m.producto?.nombre || "—"}</td>
          <td data-label="Cantidad">${m.cantidad > 0 ? "+" : ""}${m.cantidad}</td>
          <td data-label="Tipo">${TIPOS[m.tipo] || m.tipo}</td>
          <td data-label="Notas">${m.notas || "—"}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="5" class="empty">Sin movimientos todavía</td></tr>`;

  document.querySelectorAll(".ajustar-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`qty-${id}`);
      const cantidad = parseInt(input.value);
      if (!cantidad) {
        alert("Introduce una cantidad válida (positiva o negativa)");
        return;
      }
      btn.disabled = true;
      try {
        await addMovimiento({ productoId: id, cantidad, tipo: "AJUSTE" });
        input.value = "";
        load();
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

load();
