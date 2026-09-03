import { logout } from "./auth.js";

const LINKS = [
  { href: "dashboard.html", label: "Inicio" },
  { href: "inventario.html", label: "Inventario" },
  { href: "planificacion.html", label: "Planificación" },
  { href: "amasadoras.html", label: "Amasadoras" },
  { href: "orden-trabajo.html", label: "Orden de trabajo" },
  { href: "configuracion.html", label: "Configuración" },
];

export function renderNav(current) {
  const header = document.createElement("header");
  header.className = "app-header";
  const current_ = current || location.pathname.split("/").pop();

  header.innerHTML = `
    <h1>🥖 Panadería</h1>
    <nav class="app-nav">
      ${LINKS.map(
        (l) => `<a href="${l.href}" class="${l.href === current_ ? "active" : ""}">${l.label}</a>`
      ).join("")}
      <button class="logout-btn" id="logout-btn">Salir</button>
    </nav>
  `;
  document.body.prepend(header);
  document.getElementById("logout-btn").addEventListener("click", logout);
}
