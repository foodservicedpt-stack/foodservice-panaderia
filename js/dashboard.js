import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatDateES } from "./utils.js";
import { toast } from "./ui.js";

requireSession();
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
    document.getElementById("alerts-card").style.display = "";
    document.getElementById("alerts-body").innerHTML = alerts
      .map(
        (p) => `<tr>
          <td data-label="Producto">${p.nombre}</td>
          <td data-label="Stock">${p.stockActual}</td>
          <td data-label="Cobertura"><span class="badge danger">${p.coverageDays} días</span></td>
        </tr>`
      )
      .join("");
  }

  // Amasadoras pendientes
  const pendientes = amasadoras.filter((a) => a.estado === "EN_FERMENTACION");
  if (pendientes.length) {
    document.getElementById("amasadoras-card").style.display = "";
    const list = document.getElementById("amasadoras-list");
    list.innerHTML = pendientes
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
          load();
        } catch (err) {
          toast("Error al confirmar: " + err.message, "error");
          btn.disabled = false;
          btn.textContent = "Confirmar";
        }
      });
    });
  }
}

load();
