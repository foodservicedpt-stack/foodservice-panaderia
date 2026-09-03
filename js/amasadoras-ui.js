import { escapeHtml, icon } from "./ui.js";
import { getAmasadoraStage } from "./domain.js";
import { formatDateES } from "./utils.js";

const STEP_LABELS = {
  PLANIFICADA: "Planificada",
  AMASADO: "Amasado",
  FERMENTANDO: "Fermentando",
  HORNEADO: "Horneado",
};
const STEPS = ["PLANIFICADA", "AMASADO", "FERMENTANDO", "HORNEADO"];

function seg(i, key, index, progress) {
  const state = i < index ? "is-done" : i === index ? "is-current" : "is-pending";
  const fill = i < index ? 100 : i === index ? Math.round(progress * 100) : 0;
  return `<div class="amasadora-step ${state}">
    <span class="amasadora-seg"><span class="amasadora-seg-fill" style="width:${fill}%"></span></span>
    <span class="amasadora-step-label">${i < index ? `<span class="amasadora-step-ico">${icon("check")}</span>` : ""}${STEP_LABELS[key]}</span>
  </div>`;
}

function ovenSvg() {
  return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <g stroke="#a54a26" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.55">
      <path class="oven-steam" d="M70 62 c-7 -9 -7 -19 0 -29 c7 -10 7 -19 0 -27"/>
      <path class="oven-steam s2" d="M100 58 c-7 -9 -7 -19 0 -29 c7 -10 7 -19 0 -27"/>
      <path class="oven-steam s3" d="M130 62 c-7 -9 -7 -19 0 -29 c7 -10 7 -19 0 -27"/>
    </g>
    <g class="oven-loaf">
      <path d="M30 152 q0 -74 70 -74 q70 0 70 74 z" fill="#d9a066"/>
      <path d="M30 152 h140" stroke="#ba8b4f" stroke-width="6" stroke-linecap="round"/>
      <path d="M62 106 l74 -28" stroke="#7a4a1f" stroke-width="7" stroke-linecap="round"/>
      <path d="M80 90 l56 -22" stroke="#7a4a1f" stroke-width="7" stroke-linecap="round"/>
      <circle cx="52" cy="140" r="5" fill="#fff" opacity="0.5"/>
      <circle cx="148" cy="140" r="5" fill="#fff" opacity="0.5"/>
    </g>
    <circle cx="100" cy="100" r="10" fill="#a54a26" opacity="0.12"/>
  </svg>`;
}

function bakeBlock(a) {
  return `<div class="amasadora-bake">
    <div class="amasadora-oven">${ovenSvg()}</div>
    <div class="amasadora-bake-form">
      <label class="field-label" for="piezas-${escapeHtml(a.id)}">Piezas salidas (guardadas en el congelador)</label>
      <div class="row">
        <input type="number" id="piezas-${escapeHtml(a.id)}" class="quantity-input" min="1" placeholder="Cantidad" aria-label="Piezas producidas" />
        <button class="confirm-btn" data-id="${escapeHtml(a.id)}">Registrar</button>
      </div>
    </div>
  </div>`;
}

export function amasadoraCardHtml(a, now) {
  const s = getAmasadoraStage(a, now);
  const nombre = escapeHtml(a.producto?.nombre || "Producto");
  const fecha = a.fechaInicio ? formatDateES(a.fechaInicio, { day: "numeric", month: "short", year: "numeric" }) : "";
  const meta = s.key === "PLANIFICADA" ? `Planificada para ${fecha}` : `Iniciada ${fecha}`;
  const completed = s.key === "COMPLETADA";
  const steps = STEPS.map((k, i) => seg(i, k, s.index, s.progress)).join("");
  return `
  <div class="amasadora-card" data-key="${s.key}" data-id="${escapeHtml(a.id)}">
    <div class="amasadora-head">
      <div>
        <div class="amasadora-name">${nombre}</div>
        <div class="amasadora-meta">${escapeHtml(meta)}</div>
      </div>
      <span class="amasadora-chip ${s.key.toLowerCase()}">${escapeHtml(s.label)}</span>
    </div>
    <div class="amasadora-stepper" role="progressbar" aria-valuenow="${s.overall}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de ${nombre}">
      <div class="amasadora-step-bar">${steps}</div>
      <div class="amasadora-progress-hint"><span>${escapeHtml(s.label)}</span><strong>${s.overall}%</strong></div>
    </div>
    ${s.key === "HORNEADO" && !completed ? bakeBlock(a) : ""}
  </div>`;
}

export function renderAmasadorasInto(container, amasadoras, now, onConfirm) {
  if (!amasadoras || !amasadoras.length) {
    container.innerHTML = `<p class="empty">No hay amasadoras en curso</p>`;
    return;
  }
  // Conserva los valores escritos al refrescar la vista (no perder lo tecleado).
  const saved = {};
  container.querySelectorAll("input[type=number]").forEach((i) => { saved[i.id] = i.value; });

  container.innerHTML = amasadoras.map((a) => amasadoraCardHtml(a, now)).join("");

  Object.entries(saved).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  });

  container.querySelectorAll(".confirm-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`#piezas-${CSS.escape(id)}`);
      onConfirm && onConfirm(id, input ? input.value : "", btn);
    });
  });
}
