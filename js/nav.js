import { icon } from "./ui.js";

const LINKS = [
  { href: "dashboard.html", label: "Inicio", icon: "home" },
  { href: "inventario.html", label: "Inventario", icon: "box" },
  { href: "planificacion.html", label: "Planificación", icon: "calendar" },
  { href: "amasadoras.html", label: "Amasadoras", icon: "wheat" },
  { href: "orden-trabajo.html", label: "Orden de trabajo", icon: "task" },
  { href: "configuracion.html", label: "Configuración", icon: "gear" },
];

// En móvil mostramos 4 accesos directos + "Más"; el resto se abre en la hoja inferior.
const BOTTOM = [
  { href: "dashboard.html", label: "Inicio", icon: "home" },
  { href: "inventario.html", label: "Inventario", icon: "box" },
  { href: "planificacion.html", label: "Planificación", icon: "calendar" },
  { href: "amasadoras.html", label: "Amasadoras", icon: "wheat" },
];

const MORE = [
  { href: "orden-trabajo.html", label: "Orden de trabajo", icon: "task" },
  { href: "configuracion.html", label: "Configuración", icon: "gear" },
];

export function renderNav(current) {
  const current_ = current || location.pathname.split("/").pop();

  // ---- Barra superior (escritorio / tablet) ----
  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="Panadería — Inicio">
      <span class="brand-mark">${icon("wheat")}</span>
      <h1>Panadería</h1>
    </a>
    <nav class="app-nav" aria-label="Navegación principal">
      ${LINKS.map(
        (l) => `<a href="${l.href}" class="${l.href === current_ ? "active" : ""}">${icon(l.icon)}${l.label}</a>`
      ).join("")}
    </nav>`;
  document.body.prepend(header);

  // ---- Barra inferior (móvil / PWA) ----
  const bottom = document.createElement("nav");
  bottom.className = "bottom-nav";
  bottom.setAttribute("aria-label", "Navegación principal");
  bottom.innerHTML = `
    ${BOTTOM.map((l) => `<a href="${l.href}" class="bottom-link ${l.href === current_ ? "active" : ""}" aria-label="${l.label}">${icon(l.icon)}<span>${l.label}</span></a>`).join("")}
    <button class="bottom-link more-btn" id="bottom-more" aria-label="Más opciones" aria-expanded="false">${icon("more")}<span>Más</span></button>
  `;
  document.body.appendChild(bottom);

  // ---- Hoja inferior "Más" ----
  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";
  sheet.setAttribute("aria-hidden", "true");
  sheet.innerHTML = `
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Más opciones">
      <div class="sheet-grabber"></div>
      <div class="sheet-title">Más opciones</div>
      <div class="sheet-list">
        ${MORE.map((l) => `<a class="sheet-link" href="${l.href}">${icon(l.icon)}<span>${l.label}</span></a>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(sheet);

  const moreBtn = bottom.querySelector("#bottom-more");
  const openSheet = () => { sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false"); moreBtn.setAttribute("aria-expanded", "true"); };
  const closeSheet = () => { sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true"); moreBtn.setAttribute("aria-expanded", "false"); };
  moreBtn.addEventListener("click", openSheet);
  sheet.querySelector("#sheet-backdrop").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
}
