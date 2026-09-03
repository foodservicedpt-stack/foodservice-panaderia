import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getProductos, saveProducto } from "./data.js";
import { changePassword } from "./auth.js";
import { toast } from "./ui.js";

requireSession();
renderNav("configuracion.html");

const CATEGORIAS = { STOCK: "Stock", SEMANAL: "Semanal", OTRO: "Otro" };

async function load() {
  const productos = await getProductos();
  const list = document.getElementById("productos-list");
  list.innerHTML = productos
    .map(
      (p) => `
    <div class="list-row" style="flex-direction:column; align-items:stretch; gap:8px;">
      <div class="row" style="justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <input type="text" value="${p.nombre}" data-field="nombre" data-id="${p.id}" style="flex:1; min-width:160px; margin:0;" aria-label="Nombre del producto" />
        <select data-field="categoria" data-id="${p.id}" style="width:120px; margin:0;" aria-label="Categoría">
          ${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}" ${p.categoria === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
        <label class="checkbox-row" style="padding:0;">
          <input type="checkbox" data-field="activo" data-id="${p.id}" ${p.activo !== false ? "checked" : ""} />
          <span>Activo</span>
        </label>
      </div>
      <div class="row" style="gap:14px; align-items:flex-end; flex-wrap:wrap;">
        <div style="flex:1; min-width:150px;">
          <label class="field-label" style="margin:0 0 4px;" for="consumo-${p.id}">Consumo diario</label>
          <input type="number" id="consumo-${p.id}" value="${p.consumoDiarioDefecto ?? 10}" data-field="consumoDiarioDefecto" data-id="${p.id}" style="width:100%; margin:0;" aria-label="Consumo diario (unidades por día)" />
        </div>
        <div style="flex:1; min-width:150px;">
          <label class="field-label" style="margin:0 0 4px;" for="margen-${p.id}">Margen seguridad</label>
          <input type="number" id="margen-${p.id}" value="${p.margenSeguridadDias ?? 2}" data-field="margenSeguridadDias" data-id="${p.id}" style="width:100%; margin:0;" aria-label="Margen de seguridad (días)" />
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
  nuevoForm.style.display = "";
  nuevoBtn.style.display = "none";
  document.getElementById("nuevo-nombre").focus();
});

cancelBtn.addEventListener("click", () => {
  nuevoForm.style.display = "none";
  nuevoBtn.style.display = "";
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
    nuevoForm.style.display = "none";
    nuevoBtn.style.display = "";
    toast(`Producto "${nombre}" creado`, "success");
    load();
  } catch (err) {
    toast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear";
  }
});

document.getElementById("change-pass-btn").addEventListener("click", async () => {
  const errorEl = document.getElementById("pass-error");
  const successEl = document.getElementById("pass-success");
  errorEl.textContent = "";
  successEl.textContent = "";
  const current = document.getElementById("current-password").value;
  const next = document.getElementById("new-password").value;
  if (!current || !next) {
    errorEl.textContent = "Rellena ambos campos";
    return;
  }
  const result = await changePassword(current, next);
  if (result.error) {
    errorEl.textContent = result.error;
  } else {
    successEl.textContent = "Contraseña actualizada correctamente";
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
  }
});

load();
