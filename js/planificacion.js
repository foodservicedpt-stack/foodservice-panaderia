import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion } from "./data.js";
import { addCalendarDays, getMondayOfWeek, toDateString, dayAbbr, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";

renderNav("planificacion.html");

let monday = getMondayOfWeek(new Date());

document.getElementById("prev-week").addEventListener("click", () => {
  monday = addCalendarDays(monday, -7);
  loadWithState(document.getElementById("page-status"), load);
});
document.getElementById("next-week").addEventListener("click", () => {
  monday = addCalendarDays(monday, 7);
  loadWithState(document.getElementById("page-status"), load);
});

function weekDays() {
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(monday, i));
}

async function load() {
  const days = weekDays();
  const start = toDateString(days[0]);
  const end = toDateString(days[6]);
  document.getElementById("week-label").textContent = `${formatDateES(days[0], { day: "numeric", month: "short" })} – ${formatDateES(days[6], { day: "numeric", month: "short" })}`;

  const { planificaciones, products } = await getPlanificacion(start, end);

  const byKey = {};
  planificaciones.forEach((p) => {
    byKey[`${p.productoId}_${p.fecha}`] = p;
  });

  const wrap = document.getElementById("plan-table-wrap");
  if (!products.length) {
    wrap.innerHTML = `<p class="empty">No hay productos de tipo STOCK activos</p>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-scroll planning-table-scroll"><table class="planning-table">
      <thead>
        <tr>
          <th>Producto</th>
          ${days.map((d) => `<th>${dayAbbr(d.getDay() === 0 ? 6 : d.getDay() - 1)}<br/><small>${d.getDate()}</small></th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (p) => `
          <tr>
            <td data-label="Producto"><strong>${escapeHtml(p.nombre)}</strong></td>
            ${days
              .map((d) => {
                const fecha = toDateString(d);
                const key = `${p.id}_${fecha}`;
                const existing = byKey[key];
                const total = existing ? (existing.desayuno || 0) + (existing.comida || 0) + (existing.extra || 0) : "";
                return `<td data-label="${formatDateES(d, { weekday: "short" })}">
                  <input type="number" min="0" value="${total}" data-prod="${p.id}" data-fecha="${fecha}" class="plan-input" aria-label="${escapeHtml(p.nombre)}, ${formatDateES(d, { weekday: "long" })}" />
                </td>`;
              })
              .join("")}
          </tr>`
          )
          .join("")}
      </tbody>
    </table></div>
    <p class="meta-text planning-help">Introduce la cantidad total planificada para cada día. Los cambios se guardan automáticamente al salir del campo.</p>
  `;

  wrap.querySelectorAll(".plan-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const productoId = input.dataset.prod;
      const fecha = input.dataset.fecha;
      const cantidad = parseInt(input.value) || 0;
      const cell = input.closest("td");
      cell.classList.add("is-saving");
      input.disabled = true;
      try {
        await savePlanificacion({ productoId, fecha, desayuno: 0, comida: cantidad, extra: 0, esExcepcion: false });
        cell.classList.add("is-saved");
        setTimeout(() => cell.classList.remove("is-saved"), 1200);
      } catch (err) {
        toast("Error al guardar: " + err.message, "error");
      } finally {
        input.disabled = false;
        cell.classList.remove("is-saving");
      }
    });
  });
}

loadWithState(document.getElementById("page-status"), load);
