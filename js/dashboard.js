import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { quantityInput } from "./components.js";

renderNav("dashboard.html");

document.getElementById("saludo").textContent = `${getGreeting()}, equipo`;
document.getElementById("fecha").textContent = formatDateES(new Date(), {
  weekday: "long",
  day: "numeric",
  month: "long",
});

async function load() {
  const [products, amasadoras] = await Promise.all([getProductosStock(), getAmasadoras()]);

  // Alertas de stock bajo
  const withStatus = products.map((p) => {
    const coverageDays = calcCoverageDays(p.stockActual || 0, [], p.consumoDiarioDefecto || 0);
    const status = getStockStatus(coverageDays, p.margenSeguridadDias || 0);
    return { ...p, coverageDays, status };
  });
  const alerts = withStatus.filter((p) => p.status === "danger");

  if (alerts.length) {
    document.getElementById("alerts-card").hidden = false;
    document.getElementById("alerts-body").innerHTML = alerts
      .map(
        (p) => {
          const rate = p.consumoDiarioDefecto || 0;
          return `<tr>
            <td data-label="Producto">${escapeHtml(p.nombre)}</td>
            <td data-label="Stock">${p.stockActual}</td>
            <td data-label="Cobertura">
              <div>
                <span class="badge danger">${formatCoverageDays(p.coverageDays)}</span>
                ${rate > 0 ? `<small class="meta-text rate-text">a ${rate}/día</small>` : ""}
              </div>
            </td>
          </tr>`;
        }
      )
      .join("");
  }

  // Amasadoras pendientes
  const pendientes = amasadoras.filter((a) => a.estado === "EN_FERMENTACION");
  if (pendientes.length) {
    document.getElementById("amasadoras-card").hidden = false;
    const list = document.getElementById("amasadoras-list");
    list.innerHTML = pendientes
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
      .join("");

    list.querySelectorAll(".confirm-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const piezas = document.getElementById(`piezas-${id}`).value;
        if (!piezas || parseInt(piezas) <= 0) {
          toast("Introduce un número válido de piezas", "error");
          return;
        }
        btn.disabled = true;
        btn.textContent = "Guardando...";
        try {
          await confirmarAmasadora({ amasadoraId: id, piezas });
          toast("Amasadora confirmada", "success");
          loadWithState(document.getElementById("page-status"), load);
        } catch (err) {
          toast("Error al confirmar: " + err.message, "error");
          btn.disabled = false;
          btn.textContent = "Confirmar";
        }
      });
    });
  }
}

loadWithState(document.getElementById("page-status"), load);
