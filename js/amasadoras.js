import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, getProductos } from "./data.js";
import { formatDateES, toDateString } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { productOption, quantityInput } from "./components.js";

renderNav("amasadoras.html");

const ESTADOS = { EN_FERMENTACION: "En fermentación", PENDIENTE_CONFIRMAR: "Pendiente confirmar", COMPLETADA: "Completada" };

document.getElementById("nueva-btn").addEventListener("click", async () => {
  document.getElementById("nueva-form").hidden = false;
  document.getElementById("fecha-input").value = toDateString(new Date());
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
    toast("Amasadora creada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error al crear: " + err.message, "error");
  }
});

async function load() {
  const amasadoras = await getAmasadoras();
  const pendientes = amasadoras.filter((a) => a.estado !== "COMPLETADA");
  const historial = amasadoras.filter((a) => a.estado === "COMPLETADA");

  const list = document.getElementById("pendientes-list");
  list.innerHTML =
    pendientes
      .map(
        (a) => `
      <div class="list-row">
        <div>
          <strong>${escapeHtml(a.producto?.nombre || "Producto")}</strong><br/>
          <span class="meta-text">Iniciada: ${formatDateES(a.fechaInicio)}</span>
        </div>
        <div class="row">
          ${quantityInput({ id: `piezas-${a.id}`, label: "Piezas producidas", min: 1 })}
          <button data-id="${a.id}" class="confirm-btn" aria-label="Confirmar amasadora">Confirmar</button>
        </div>
      </div>`
      )
      .join("") || `<p class="empty">No hay amasadoras en curso</p>`;

  list.querySelectorAll(".confirm-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const piezas = document.getElementById(`piezas-${id}`).value;
      if (!piezas || parseInt(piezas) <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await confirmarAmasadora({ amasadoraId: id, piezas });
        toast("Amasadora confirmada", "success");
        loadWithState(document.getElementById("page-status"), load);
      } catch (err) {
        toast("Error: " + err.message, "error");
        btn.disabled = false;
        btn.textContent = "Confirmar";
      }
    });
  });

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
