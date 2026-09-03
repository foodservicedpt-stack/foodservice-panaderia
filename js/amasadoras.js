import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, cancelarProduccion, eliminarProduccion, getProductos } from "./data.js";
import { formatDateES, toDateString, addCalendarDays } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { productOption } from "./components.js";
import { renderAmasadorasInto } from "./amasadoras-ui.js";
import { PRODUCCION_TIPOS, produccionTipo, isProduccionVisible } from "./domain.js";

renderNav("amasadoras.html");

const ESTADOS = { EN_FERMENTACION: "En fermentación", PENDIENTE_CONFIRMAR: "Pendiente confirmar", COMPLETADA: "Completada", CANCELADA: "Cancelada" };

let cachedActive = [];
let isBusy = false;

const tipoSelect = document.getElementById("tipo-select");
tipoSelect.innerHTML = PRODUCCION_TIPOS.map((t) => `<option value="${t.tipo}">${t.label}</option>`).join("");

function syncFields() {
  const def = produccionTipo(tipoSelect.value);
  document.getElementById("producto-field").hidden = !def.tracksStock;
  document.getElementById("nombre-field").hidden = def.tracksStock;
}

async function handleConfirm(id, piezas, btn) {
  const pzs = parseInt(piezas);
  if (!pzs || pzs <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
  isBusy = true;
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
    isBusy = false;
  }
}

async function handleCancel(id, btn) {
  isBusy = true;
  btn.disabled = true;
  try {
    await cancelarProduccion({ produccionId: id });
    toast("Producción cancelada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
  } finally {
    isBusy = false;
  }
}

async function handleDelete(id, btn) {
  if (!btn.classList.contains("confirming")) {
    btn.classList.add("confirming");
    btn.textContent = "¿Seguro?";
    setTimeout(() => { if (btn && btn.isConnected) { btn.classList.remove("confirming"); btn.textContent = "Eliminar"; } }, 3000);
    return;
  }
  isBusy = true;
  btn.disabled = true;
  try {
    await eliminarProduccion({ produccionId: id });
    toast("Producción eliminada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
  } finally {
    isBusy = false;
  }
}

document.getElementById("tipo-select").addEventListener("change", syncFields);
document.getElementById("nueva-btn").addEventListener("click", async () => {
  document.getElementById("nueva-form").hidden = false;
  document.getElementById("fecha-input").value = toDateString(addCalendarDays(new Date(), 1));
  syncFields();
  const select = document.getElementById("producto-select");
  if (!select.options.length) {
    const productos = (await getProductos()).filter((p) => p.activo !== false);
    select.innerHTML = productos.map(productOption).join("");
  }
});
document.getElementById("cancelar-btn").addEventListener("click", () => { document.getElementById("nueva-form").hidden = true; });
document.getElementById("crear-btn").addEventListener("click", async () => {
  const tipo = tipoSelect.value;
  const def = produccionTipo(tipo);
  const fechaInicio = document.getElementById("fecha-input").value;
  const nombre = document.getElementById("nombre-input").value.trim();
  const productoId = document.getElementById("producto-select").value;
  if (def.tracksStock && !productoId) { toast("Selecciona un producto", "error"); return; }
  if (!def.tracksStock && !nombre) { toast("Pon un nombre a la producción", "error"); return; }
  try {
    await createAmasadora({ productoId, fechaInicio, tipo, nombre });
    document.getElementById("nueva-form").hidden = true;
    document.getElementById("nombre-input").value = "";
    toast("Producción programada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error al crear: " + err.message, "error");
  }
});

async function load() {
  const amasadoras = await getAmasadoras();
  const now = new Date();
  const active = amasadoras.filter((a) => a.estado !== "COMPLETADA" && isProduccionVisible(a, produccionTipo(a.tipo || "MASAS"), now));
  cachedActive = active;
  const historial = amasadoras.filter((a) => a.estado === "COMPLETADA");
  renderAmasadorasInto(document.getElementById("pendientes-list"), active, now, { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
  document.getElementById("historial-body").innerHTML =
    historial
      .map(
        (a) => {
          const def = produccionTipo(a.tipo || "MASAS");
          const nombre = escapeHtml(a.producto?.nombre || a.nombre || "—");
          return `<tr>
            <td data-label="Tipo">${escapeHtml(def.label)}</td>
            <td data-label="Nombre">${nombre}</td>
            <td data-label="Fecha">${formatDateES(a.fechaInicio)}</td>
            <td data-label="Estado">${def.tracksStock ? (a.piezasProducidas ?? "—") : "Completada"}</td>
          </tr>`;
        }
      )
      .join("") || `<tr><td colspan="4" class="empty">Sin historial todavía</td></tr>`;
}

loadWithState(document.getElementById("page-status"), load);

setInterval(() => {
  if (!isBusy && cachedActive.length) {
    renderAmasadorasInto(document.getElementById("pendientes-list"), cachedActive, new Date(), { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
  }
}, 30000);

