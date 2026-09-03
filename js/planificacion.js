import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getPlanificacion, savePlanificacion } from "./data.js";
import { getMondayOfWeek, toDateString, dayAbbr, formatDateES } from "./utils.js";

requireSession();
renderNav("planificacion.html");

let monday = getMondayOfWeek(new Date());

document.getElementById("prev-week").addEventListener("click", () => {
  monday = new Date(monday.getTime() - 7 * 86400000);
  load();
});
document.getElementById("next-week").addEventListener("click", () => {
  monday = new Date(monday.getTime() + 7 * 86400000);
  load();
});

function weekDays() {
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
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
    <table>
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
            <td data-label="Producto"><strong>${p.nombre}</strong></td>
            ${days
              .map((d) => {
                const fecha = toDateString(d);
                const key = `${p.id}_${fecha}`;
                const existing = byKey[key];
                const total = existing ? (existing.desayuno || 0) + (existing.comida || 0) + (existing.extra || 0) : "";
                return `<td data-label="${formatDateES(d, { weekday: "short" })}">
                  <input type="number" min="0" value="${total}" data-prod="${p.id}" data-fecha="${fecha}" class="plan-input" style="width:70px; margin:0;" />
                </td>`;
              })
              .join("")}
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <p style="color:#7a6a58; font-size:0.85rem; margin-top:10px;">Introduce la cantidad total planificada para cada día. Los cambios se guardan automáticamente al salir del campo.</p>
  `;

  wrap.querySelectorAll(".plan-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const productoId = input.dataset.prod;
      const fecha = input.dataset.fecha;
      const cantidad = parseInt(input.value) || 0;
      input.disabled = true;
      try {
        await savePlanificacion({ productoId, fecha, desayuno: 0, comida: cantidad, extra: 0, esExcepcion: false });
      } catch (err) {
        alert("Error al guardar: " + err.message);
      } finally {
        input.disabled = false;
      }
    });
  });
}

load();
