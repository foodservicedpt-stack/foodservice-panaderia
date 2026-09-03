import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getOrdenTrabajo, toggleOrdenTrabajo, saveNota } from "./data.js";
import { toDateString, formatDateES } from "./utils.js";
import { toast } from "./ui.js";

requireSession();
renderNav("orden-trabajo.html");

let currentDate = new Date();

document.getElementById("prev-day").addEventListener("click", () => {
  currentDate = new Date(currentDate.getTime() - 86400000);
  load();
});
document.getElementById("next-day").addEventListener("click", () => {
  currentDate = new Date(currentDate.getTime() + 86400000);
  load();
});

document.getElementById("guardar-nota-btn").addEventListener("click", async () => {
  const nota = document.getElementById("nota-input").value;
  const fecha = toDateString(currentDate);
  const btn = document.getElementById("guardar-nota-btn");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await saveNota({ fecha, nota });
    btn.textContent = "Guardado ✓";
    setTimeout(() => (btn.textContent = "Guardar nota"), 1500);
  } catch (err) {
    toast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

async function load() {
  const fecha = toDateString(currentDate);
  document.getElementById("day-label").textContent = formatDateES(currentDate, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { items, notas, products, planificaciones } = await getOrdenTrabajo(fecha, fecha);

  const itemsByProd = Object.fromEntries(items.map((i) => [i.productoId, i]));
  const planByProd = Object.fromEntries(planificaciones.filter((p) => p.fecha === fecha).map((p) => [p.productoId, p]));

  const relevantProducts = products.filter((p) => planByProd[p.id] || itemsByProd[p.id]);

  const list = document.getElementById("items-list");
  list.innerHTML =
    relevantProducts
      .map((p) => {
        const plan = planByProd[p.id];
        const cantidad = plan ? (plan.desayuno || 0) + (plan.comida || 0) + (plan.extra || 0) : 0;
        const item = itemsByProd[p.id];
        const completado = item ? item.completado : false;
        return `<label class="checkbox-row">
          <input type="checkbox" data-prod="${p.id}" ${completado ? "checked" : ""} class="toggle-check" />
          <span>${p.nombre}${cantidad ? ` — <strong>${cantidad}</strong> unidades` : ""}</span>
        </label>`;
      })
      .join("") || `<p class="empty">No hay tareas planificadas para este día</p>`;

  list.querySelectorAll(".toggle-check").forEach((cb) => {
    cb.addEventListener("change", async () => {
      try {
        await toggleOrdenTrabajo({ productoId: cb.dataset.prod, fecha, completado: cb.checked });
      } catch (err) {
        toast("Error: " + err.message, "error");
        cb.checked = !cb.checked;
      }
    });
  });

  const notaExistente = notas.find((n) => n.fecha === fecha);
  document.getElementById("nota-input").value = notaExistente?.nota || "";
}

load();
