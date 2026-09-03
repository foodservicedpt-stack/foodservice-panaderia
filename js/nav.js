import { icon } from "./ui.js";

const LINKS = [
  { href: "dashboard.html", label: "Inicio", icon: "home" },
  { href: "inventario.html", label: "Inventario", icon: "box" },
  { href: "planificacion.html", label: "Planificación", icon: "calendar" },
  { href: "amasadoras.html", label: "Amasadoras", icon: "wheat" },
  { href: "orden-trabajo.html", label: "Orden de trabajo", icon: "task" },
  { href: "configuracion.html", label: "Configuración", icon: "gear" },
];

export function renderNav(current) {
  const header = document.createElement("header");
  header.className = "app-header";
  const current_ = current || location.pathname.split("/").pop();

  header.innerHTML = `
    <a class="brand" href="dashboard.html" aria-label="Panadería — Inicio">
      <span class="brand-mark">${icon("wheat")}</span>
      <h1>Panadería</h1>
    </a>
    <nav class="app-nav" aria-label="Navegación principal">
      ${LINKS.map(
        (l) => `<a href="${l.href}" class="${l.href === current_ ? "active" : ""}">${icon(l.icon)}${l.label}</a>`
      ).join("")}
    </nav>
  `;
  document.body.prepend(header);
}
