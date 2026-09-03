import { renderNav } from "./nav.js";
import { getProductos, saveProducto } from "./data.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";

renderNav("configuracion.html");

const CATEGORIAS = { STOCK: "Stock", SEMANAL: "Semanal", OTRO: "Otro" };

async function load() {
  const productos = await getProductos();
  const list = document.getElementById("productos-list");
  list.innerHTML = productos
    .map(
      (p) => `
    <div class="list-row product-row">
      <div class="row product-main-fields">
        <input type="text" value="${escapeHtml(p.nombre)}" data-field="nombre" data-id="${p.id}" class="product-name-input" aria-label="Nombre del producto" />
        <select data-field="categoria" data-id="${p.id}" class="category-select" aria-label="Categoría">
          ${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}" ${p.categoria === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
        <label class="checkbox-row compact-checkbox">
          <input type="checkbox" data-field="activo" data-id="${p.id}" ${p.activo !== false ? "checked" : ""} />
          <span>Activo</span>
        </label>
      </div>
      <div class="row product-settings">
        <div class="setting-field">
          <label class="field-label" for="consumo-${p.id}">Consumo diario</label>
          <input type="number" id="consumo-${p.id}" value="${p.consumoDiarioDefecto ?? 10}" data-field="consumoDiarioDefecto" data-id="${p.id}" aria-label="Consumo diario (unidades por día)" />
        </div>
        <div class="setting-field">
          <label class="field-label" for="margen-${p.id}">Margen seguridad</label>
          <input type="number" id="margen-${p.id}" value="${p.margenSeguridadDias ?? 2}" data-field="margenSeguridadDias" data-id="${p.id}" aria-label="Margen de seguridad (días)" />
        </div>
        <div class="setting-field setting-unit">
          <label class="field-label" for="unidad-${p.id}">Unidad</label>
          <input type="text" id="unidad-${p.id}" value="${escapeHtml(p.unidad || "uds.")}" data-field="unidad" data-id="${p.id}" aria-label="Unidad" maxlength="12" />
        </div>
        <button data-id="${p.id}" class="save-btn secondary">Guardar</button>
      </div>
    </div>`
    )
    .join("") || `<p class="empty">No hay productos todavía</p>`;

  list.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const fields = list.querySelectorAll(`[data-id="${id}"]`);
      const body = { id };
      fields.forEach((f) => {
        const key = f.dataset.field;
        if (!key) return;
        body[key] = f.type === "checkbox" ? f.checked : f.value;
      });
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await saveProducto(body);
        btn.textContent = "Guardado ✓";
        setTimeout(() => (btn.textContent = "Guardar"), 1200);
      } catch (err) {
        toast("Error: " + err.message, "error");
        btn.textContent = "Guardar";
      } finally {
        btn.disabled = false;
      }
    });
  });
}

const nuevoForm = document.getElementById("nuevo-producto");
const nuevoBtn = document.getElementById("nuevo-producto-btn");
const cancelBtn = document.getElementById("cancelar-producto-btn");

nuevoBtn.addEventListener("click", () => {
  nuevoForm.hidden = false;
  nuevoBtn.hidden = true;
  document.getElementById("nuevo-nombre").focus();
});

cancelBtn.addEventListener("click", () => {
  nuevoForm.hidden = true;
  nuevoBtn.hidden = false;
});

document.getElementById("crear-producto-btn").addEventListener("click", async () => {
  const nombre = document.getElementById("nuevo-nombre").value.trim();
  if (!nombre) {
    toast("Escribe un nombre para el producto", "error");
    return;
  }
  const btn = document.getElementById("crear-producto-btn");
  btn.disabled = true;
  btn.textContent = "Creando...";
  try {
    await saveProducto({ nombre, categoria: "STOCK" });
    document.getElementById("nuevo-nombre").value = "";
    nuevoForm.hidden = true;
    nuevoBtn.hidden = false;
    toast(`Producto "${nombre}" creado`, "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear";
  }
});

loadWithState(document.getElementById("page-status"), load);
