import { icon } from "./ui.js";

const LINKS = [
  { href: "dashboard.html", label: "Inicio", icon: "home" },
  { href: "inventario.html", label: "Inventario", icon: "box" },
  { href: "planificacion.html", label: "Planificación", icon: "calendar" },
  { href: "amasadoras.html", label: "Amasadoras", icon: "wheat" },
  { href: "configuracion.html", label: "Configuración", icon: "gear" },
];

// En móvil mostramos 5 accesos directos (ya no hay "Más": Ord. de trabajo eliminada).
const BOTTOM = LINKS;

export function renderNav(current) {
  const current_ = current || location.pathname.split("/").pop();

  // Barra superior (escritorio / tablet)
  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="Panadería — Inicio">
      <span class="brand-mark">${icon("wheat")}</span>
      <h1>Panadería</h1>
    </a>
    <nav class="app-nav" aria-label="Navegación principal">
      ${LINKS.map((l) => `<a href="${l.href}" class="${l.href === current_ ? "active" : ""}">${icon(l.icon)}${l.label}</a>`).join("")}
    </nav>
  `;
  document.body.prepend(header);

  // Barra inferior (móvil / PWA): Configuración tiene acceso directo.
  const bottom = document.createElement("nav");
  bottom.className = "bottom-nav";
  bottom.setAttribute("aria-label", "Navegación principal");
  bottom.innerHTML = BOTTOM.map((l) => `<a href="${l.href}" class="bottom-link ${l.href === current_ ? "active" : ""}" aria-label="${l.label}">${icon(l.icon)}<span>${l.label}</span></a>`).join("");
  document.body.appendChild(bottom);
}
