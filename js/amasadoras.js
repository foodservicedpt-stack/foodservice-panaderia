import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, getProductos } from "./data.js";
import { formatDateES, toDateString } from "./utils.js";
import { toast } from "./ui.js";

requireSession();
renderNav("amasadoras.html");

const ESTADOS = { EN_FERMENTACION: "En fermentación", PENDIENTE_CONFIRMAR: "Pendiente confirmar", COMPLETADA: "Completada" };

document.getElementById("nueva-btn").addEventListener("click", async () => {
  document.getElementById("nueva-form").style.display = "";
  document.getElementById("fecha-input").value = toDateString(new Date());
  const select = document.getElementById("producto-select");
  if (!select.options.length) {
    const productos = (await getProductos()).filter((p) => p.activo !== false);
    select.innerHTML = productos.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("");
  }
});

document.getElementById("cancelar-btn").addEventListener("click", () => {
  document.getElementById("nueva-form").style.display = "none";
});

document.getElementById("crear-btn").addEventListener("click", async () => {
  const productoId = document.getElementById("producto-select").value;
  const fechaInicio = document.getElementById("fecha-input").value;
  if (!productoId) { toast("Selecciona un producto", "error"); return; }
  try {
    await createAmasadora({ productoId, fechaInicio });
    document.getElementById("nueva-form").style.display = "none";
    toast("Amasadora creada", "success");
    load();
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
          <strong>${a.producto?.nombre || "Producto"}</strong><br/>
          <span class="meta-text">Iniciada: ${formatDateES(a.fechaInicio)}</span>
        </div>
        <div class="row">
          <input type="number" min="1" placeholder="Piezas" aria-label="Piezas producidas" style="width:90px; margin:0;" id="piezas-${a.id}" />
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
      try {
        await confirmarAmasadora({ amasadoraId: id, piezas });
        toast("Amasadora confirmada", "success");
        load();
      } catch (err) {
        toast("Error: " + err.message, "error");
        btn.disabled = false;
      }
    });
  });

  document.getElementById("historial-body").innerHTML =
    historial
      .map(
        (a) => `<tr>
          <td data-label="Producto">${a.producto?.nombre || "—"}</td>
          <td data-label="Fecha inicio">${formatDateES(a.fechaInicio)}</td>
          <td data-label="Estado">${ESTADOS[a.estado] || a.estado}</td>
          <td data-label="Piezas">${a.piezasProducidas ?? "—"}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="4" class="empty">Sin historial todavía</td></tr>`;
}

load();
