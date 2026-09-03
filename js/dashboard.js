import { requireSession } from "./auth.js";
import { renderNav } from "./nav.js";
import { getProductosStock, getAmasadoras, confirmarAmasadora } from "./data.js";
import { getGreeting, calcCoverageDays, getStockStatus, formatDateES } from "./utils.js";

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
      .join("");

    list.querySelectorAll(".confirm-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const piezas = document.getElementById(`piezas-${id}`).value;
        if (!piezas || parseInt(piezas) <= 0) {
          alert("Introduce un número válido de piezas");
          return;
        }
        btn.disabled = true;
        btn.textContent = "Guardando...";
        try {
          await confirmarAmasadora({ amasadoraId: id, piezas });
          load();
        } catch (err) {
          alert("Error al confirmar: " + err.message);
          btn.disabled = false;
          btn.textContent = "Confirmar";
        }
      });
    });
  }
}

load();
