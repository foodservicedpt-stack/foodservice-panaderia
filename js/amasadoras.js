import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, getProductos } from "./data.js";
import { formatDateES, toDateString } from "./utils.js";

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
  if (!productoId) return alert("Selecciona un producto");
  try {
    await createAmasadora({ productoId, fechaInicio });
    document.getElementById("nueva-form").style.display = "none";
    load();
  } catch (err) {
    alert("Error al crear: " + err.message);
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
      <div class="row-between" style="border-bottom:1px solid var(--cream-dark); padding:10px 0;">
        <div>
          <strong>${a.producto?.nombre || "Producto"}</strong><br/>
          <span style="color:#7a6a58; font-size:0.85rem;">Iniciada: ${formatDateES(a.fechaInicio)}</span>
        </div>
        <div class="row">
          <input type="number" min="1" placeholder="Piezas" style="width:90px; margin:0;" id="piezas-${a.id}" />
          <button data-id="${a.id}" class="confirm-btn">Confirmar</button>
        </div>
      </div>`
      )
      .join("") || `<p class="empty">No hay amasadoras en curso</p>`;

  list.querySelectorAll(".confirm-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const piezas = document.getElementById(`piezas-${id}`).value;
      if (!piezas || parseInt(piezas) <= 0) return alert("Introduce un número válido de piezas");
      btn.disabled = true;
      try {
        await confirmarAmasadora({ amasadoraId: id, piezas });
        load();
      } catch (err) {
        alert("Error: " + err.message);
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
