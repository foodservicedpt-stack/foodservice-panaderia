// Amasadoras: agrupadas por día, semanas futuras plegadas e historial por tipo.
import { renderNav } from "./nav.js";
import { getAmasadoras, createAmasadora, confirmarAmasadora, cancelarProduccion, eliminarProduccion, getProductos } from "./data.js";
import { formatDateES, toDateString, addCalendarDays, getMondayOfWeek, parseDateString } from "./utils.js";
import { escapeHtml, loadWithState, toast } from "./ui.js";
import { productOption } from "./components.js";
import { renderAmasadorasGroups } from "./amasadoras-ui.js";
import { PRODUCCION_TIPOS, produccionTipo, getProduccionLifecycle, groupProductionsByDay } from "./domain.js";

renderNav("amasadoras.html");

let cachedActive = [];
let isBusy = false;

const tipoSelect = document.getElementById("tipo-select");
tipoSelect.innerHTML = PRODUCCION_TIPOS.map((t) => `<option value="${t.tipo}">${t.label}</option>`).join("");

function syncFields() {
  const def = produccionTipo(tipoSelect.value);
  document.getElementById("producto-field").hidden = !def.tracksStock;
  document.getElementById("nombre-field").hidden = def.tracksStock;
}

async function handleConfirm(id, piezas, btn) {
  const pzs = parseInt(piezas);
  if (!pzs || pzs <= 0) { toast("Introduce un número válido de piezas", "error"); return; }
  isBusy = true;
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await confirmarAmasadora({ amasadoraId: id, piezas: pzs });
    toast("Amasadora registrada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Registrar";
  } finally {
    isBusy = false;
  }
}

async function handleCancel(id, btn) {
  isBusy = true;
  btn.disabled = true;
  try {
    await cancelarProduccion({ produccionId: id });
    toast("Producción cancelada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
  } finally {
    isBusy = false;
  }
}

async function handleDelete(id, btn) {
  if (!btn.classList.contains("confirming")) {
    btn.classList.add("confirming");
    btn.textContent = "¿Seguro?";
    setTimeout(() => { if (btn && btn.isConnected) { btn.classList.remove("confirming"); btn.textContent = "Eliminar"; } }, 3000);
    return;
  }
  isBusy = true;
  btn.disabled = true;
  try {
    await eliminarProduccion({ produccionId: id });
    toast("Producción eliminada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.disabled = false;
  } finally {
    isBusy = false;
  }
}

document.getElementById("tipo-select").addEventListener("change", syncFields);
document.getElementById("nueva-btn").addEventListener("click", async () => {
  document.getElementById("nueva-form").hidden = false;
  document.getElementById("fecha-input").value = toDateString(addCalendarDays(new Date(), 1));
  syncFields();
  const select = document.getElementById("producto-select");
  if (!select.options.length) {
    const productos = (await getProductos()).filter((p) => p.activo !== false);
    select.innerHTML = productos.map(productOption).join("");
  }
});
document.getElementById("cancelar-btn").addEventListener("click", () => { document.getElementById("nueva-form").hidden = true; });
document.getElementById("crear-btn").addEventListener("click", async () => {
  const tipo = tipoSelect.value;
  const def = produccionTipo(tipo);
  const fechaInicio = document.getElementById("fecha-input").value;
  const horaInicio = document.getElementById("hora-input").value;
  const nombre = document.getElementById("nombre-input").value.trim();
  const productoId = document.getElementById("producto-select").value;
  if (def.tracksStock && !productoId) { toast("Selecciona un producto", "error"); return; }
  if (!def.tracksStock && !nombre) { toast("Pon un nombre a la producción", "error"); return; }
  try {
    await createAmasadora({ productoId, fechaInicio, horaInicio, tipo, nombre });
    document.getElementById("nueva-form").hidden = true;
    document.getElementById("nombre-input").value = "";
    toast("Producción programada", "success");
    loadWithState(document.getElementById("page-status"), load);
  } catch (err) {
    toast("Error al crear: " + err.message, "error");
  }
});

function weekLabel(start) {
  return `${formatDateES(start, { day: "numeric", month: "short" })} – ${formatDateES(addCalendarDays(start, 6), { day: "numeric", month: "short" })}`;
}

function groupFutureByWeek(items, now) {
  const weeks = {};
  const order = [];
  for (const a of items) {
    const ws = getMondayOfWeek(parseDateString(a.fechaInicio));
    const key = toDateString(ws);
    if (!weeks[key]) { weeks[key] = { key, items: [] }; order.push(key); }
    weeks[key].items.push(a);
  }
  order.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return order.map((k) => weeks[k]);
}

function renderHistorial(historial) {
  const tabs = document.getElementById("historial-tabs");
  const body = document.getElementById("historial-body");
  if (!tabs || !body) return;
  const tipos = ["ALL", ...PRODUCCION_TIPOS.map((t) => t.tipo)];
  let activeType = "ALL";
  tabs.innerHTML = tipos.map((t) => `<button class="historial-tab ${t === "ALL" ? "active" : ""}" data-tipo="${t}">${t === "ALL" ? "Todas" : escapeHtml(produccionTipo(t).label)}</button>`).join("");
  const render = () => {
    const filtered = activeType === "ALL" ? historial : historial.filter((h) => h.a.tipo === activeType);
    body.innerHTML = filtered.map(({ a, lc }) => {
      const def = produccionTipo(a.tipo || "MASAS");
      const nombre = escapeHtml(a.producto?.nombre || a.nombre || "—");
      const estado = def.tracksStock ? (a.piezasProducidas ?? "—") : (a.estado === "CANCELADA" ? "Cancelada" : "Completada");
      return `<div class="historial-item"><span class="historial-tipo">${escapeHtml(def.label)}</span><span class="historial-nombre">${nombre}</span><span class="historial-fecha">${formatDateES(a.fechaInicio, { day: "numeric", month: "short" })}${a.horaInicio ? ` · ${a.horaInicio}` : ""}</span><span class="historial-estado">${escapeHtml(String(estado))}</span></div>`;
    }).join("") || `<p class="empty">Sin historial en esta categoría</p>`;
  };
  tabs.querySelectorAll(".historial-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeType = btn.dataset.tipo;
      tabs.querySelectorAll(".historial-tab").forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  });
  render();
}

async function load() {
  const amasadoras = await getAmasadoras();
  const now = new Date();
  const weekEnd = addCalendarDays(getMondayOfWeek(now), 7);
  const active = [];
  const future = [];
  const historial = [];
  for (const a of amasadoras) {
    const lc = getProduccionLifecycle(a, now);
    if (lc.finished) { historial.push({ a, lc }); continue; }
    if (!lc.active) continue;
    if (parseDateString(a.fechaInicio).getTime() < weekEnd.getTime()) active.push(a);
    else future.push(a);
  }
  cachedActive = active;
  const handlers = { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete };
  renderAmasadorasGroups(document.getElementById("pendientes-list"), groupProductionsByDay(active), now, handlers);

  const futureEl = document.getElementById("future-weeks");
  const futureWeeks = groupFutureByWeek(future, now);
  if (futureWeeks.length) {
    futureEl.hidden = false;
    document.getElementById("future-weeks-body").innerHTML = futureWeeks.map((w) => `
      <details class="future-week-group"><summary>${escapeHtml(weekLabel(parseDateString(w.key)))}</summary><div class="future-week-days"></div></details>
    `).join("");
    futureWeeks.forEach((w, i) => {
      const div = document.querySelectorAll("#future-weeks-body .future-week-days")[i];
      renderAmasadorasGroups(div, groupProductionsByDay(w.items), now, handlers);
    });
  } else {
    futureEl.hidden = true;
  }

  renderHistorial(historial);
}

loadWithState(document.getElementById("page-status"), load);

setInterval(() => {
  if (!isBusy && cachedActive.length) {
    renderAmasadorasGroups(document.getElementById("pendientes-list"), groupProductionsByDay(cachedActive), new Date(), { onConfirm: handleConfirm, onCancel: handleCancel, onDelete: handleDelete });
  }
}, 30000);
