import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatCoverageDays, formatDateES } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { renderAmasadorasInto } from "./amasadoras-ui.js";

renderNav("dashboard.html");

document.getElementById("saludo").textContent = `${getGreeting()}, equipo`;
document.getElementById("fecha").textContent = formatDateES(new Date(), {
  weekday: "long",
  day: "numeric",
  month: "long",
});

let cachedPendientes = [];
let isConfirming = false;

async function handleConfirm(id, piezas, btn) {
  const pzs = parseInt(piezas);
  if (!pzs || pzs <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
  isConfirming = true;
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await confirmarAmasadora({ amasadoraId: id, piezas: pzs });
    toast("Amasadora registrada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error al confirmar: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Registrar";
  } finally {
    isConfirming = false;
  }
}

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

  // Amasadoras en curso (planificada → horneado)
  const pendientes = amasadoras.filter((a) => a.estado !== "COMPLETADA");
  cachedPendientes = pendientes;
  if (pendientes.length) {
    document.getElementById("amasadoras-card").hidden = false;
    renderAmasadorasInto(document.getElementById("amasadoras-list"), pendientes, new Date(), handleConfirm);
  }

  // Estado vacío (nada que atender)
  const focus = document.getElementById("dashboard-focus");
  if (!alerts.length && !pendientes.length) {
    focus.hidden = false;
    focus.innerHTML = `<div class="empty-state-ok">
      <span class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      <div><strong>Todo en orden</strong><p>No hay productos bajo mínimos ni amasadoras pendientes.</p></div>
    </div>`;
  } else {
    focus.hidden = true;
  }
}

loadWithState(document.getElementById("page-status"), load);

// Refresca el avance de la barra sin volver a pedir datos a Firestore.
setInterval(() => {
  if (!isConfirming && cachedPendientes.length) {
    renderAmasadorasInto(document.getElementById("amasadoras-list"), cachedPendientes, new Date(), handleConfirm);
  }
}, 30000);
