import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, getProductos } from "./data.js";
import { formatDateES, toDateString, addCalendarDays } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { productOption } from "./components.js";
import { renderAmasadorasInto } from "./amasadoras-ui.js";

renderNav("amasadoras.html");

const ESTADOS = { EN_FERMENTACION: "En fermentación", PENDIENTE_CONFIRMAR: "Pendiente confirmar", COMPLETADA: "Completada" };

let cachedPendientes = [];
let isConfirming = false;

async function handleConfirm(id, piezas, btn) {
  const pzs = parseInt(piezas);
  if (!pzs || pzs <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
  isConfirming = true;
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await confirmarAmasadora({ amasadoraId: id, piezas: pzs });
    toast("Amasadora registrada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Registrar";
  } finally {
    isConfirming = false;
  }
}

document.getElementById("nueva-btn").addEventListener("click", async () => {
  document.getElementById("nueva-form").hidden = false;
  document.getElementById("fecha-input").value = toDateString(addCalendarDays(new Date(), 1));
  const select = document.getElementById("producto-select");
  if (!select.options.length) {
    const productos = (await getProductos()).filter((p) => p.activo !== false);
    select.innerHTML = productos.map(productOption).join("");
  }
});

document.getElementById("cancelar-btn").addEventListener("click", () => {
  document.getElementById("nueva-form").hidden = true;
});

document.getElementById("crear-btn").addEventListener("click", async () => {
  const productoId = document.getElementById("producto-select").value;
  const fechaInicio = document.getElementById("fecha-input").value;
  if (!productoId) { toast("Selecciona un producto", "error"); return; }
  try {
    await createAmasadora({ productoId, fechaInicio });
    document.getElementById("nueva-form").hidden = true;
    toast("Amasadora programada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error al crear: " + err.message, "error");
  }
});

async function load() {
  const amasadoras = await getAmasadoras();
  cachedPendientes = amasadoras.filter((a) => a.estado !== "COMPLETADA");
  const historial = amasadoras.filter((a) => a.estado === "COMPLETADA");

  renderAmasadorasInto(document.getElementById("pendientes-list"), cachedPendientes, new Date(), handleConfirm);

  document.getElementById("historial-body").innerHTML =
    historial
      .map(
        (a) => `<tr>
          <td data-label="Producto">${escapeHtml(a.producto?.nombre || "—")}</td>
          <td data-label="Fecha inicio">${formatDateES(a.fechaInicio)}</td>
          <td data-label="Estado">${ESTADOS[a.estado] || a.estado}</td>
          <td data-label="Piezas">${a.piezasProducidas ?? "—"}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="4" class="empty">Sin historial todavía</td></tr>`;
}

loadWithState(document.getElementById("page-status"), load);

// Refresca el avance de la barra sin volver a pedir datos a Firestore.
setInterval(() => {
  if (!isConfirming && cachedPendientes.length) {
    renderAmasadorasInto(document.getElementById("pendientes-list"), cachedPendientes, new Date(), handleConfirm);
  }
}, 30000);
