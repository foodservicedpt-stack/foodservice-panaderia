/* Shared UI helpers — toast notifications + consistent SVG icon set.
   Replaces native alert()/prompt() with Apple-style inline feedback, and
   replaces emoji glyphs with a uniform SF-Symbols-like stroke icon system. */

const ICONS = {
  home: '<path d="M3 10 12 3l9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
  wheat: '<path d="M12 22V9"/><path d="M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c3 0 5-2 5-5-3 0-5 2-5 5z"/><path d="M12 14c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  task: '<path d="m9 11 3 3 8-8"/><path d="M21 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function icon(name, extra = '') {
  const body = ICONS[name] || ICONS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

let region;
export function toast(message, type = 'info', { duration = 3400, title } = {}) {
  if (typeof document === 'undefined') return;
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    document.body.appendChild(region);
  }

  const t = document.createElement('div');
  t.className = 'toast ' + (['success', 'error', 'info', 'warning'].includes(type) ? type : 'info');
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'x' : 'info';
  t.innerHTML = `
    <span class="toast-icon">${icon(iconName)}</span>
    <div class="toast-body">
      ${title ? `<strong>${escapeHtml(title)}</strong><br/>` : ''}
      ${escapeHtml(message)}
    </div>
    <button class="toast-close" aria-label="Cerrar aviso">${icon('x')}</button>`;
  region.appendChild(t);
  const close = () => {
    if (t.classList.contains('leaving')) return;
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 260);
  };
  t.querySelector('.toast-close').addEventListener('click', close);
  if (duration && duration > 0) setTimeout(close, duration);
  return t;
}

export function setLoading(element, message = "Cargando...") {
  element.className = "loading";
  element.textContent = message;
}

export function setError(element, message = "No se han podido cargar los datos.") {
  element.className = "error-state";
  element.innerHTML = `${escapeHtml(message)} <button class="secondary retry-btn">Reintentar</button>`;
}

export async function loadWithState(element, load) {
  setLoading(element);
  try {
    await load();
    element.replaceChildren();
    element.className = "page-status";
  } catch (error) {
    console.error(error);
    setError(element, "No se han podido cargar los datos.");
    element.querySelector(".retry-btn").addEventListener("click", () => loadWithState(element, load));
  }
}

export { ICONS };
