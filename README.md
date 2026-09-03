# Panadería — Inventario, Planificación y Amasadoras

App estática (HTML/CSS/JS, sin build ni servidor) para GitHub Pages, con **Firebase Firestore** como base de datos.

## Estructura
- `index.html` — login (contraseña de equipo)
- `dashboard.html`, `inventario.html`, `planificacion.html`, `amasadoras.html`, `orden-trabajo.html`, `configuracion.html` — páginas de la app
- `js/firebase-config.js` — configuración de Firebase (datos públicos del proyecto)
- `js/auth.js` — sesión y contraseña de equipo (hash SHA-256 guardado en Firestore)
- `js/data.js` — acceso a Firestore (equivalente a las antiguas rutas API)
- `js/utils.js` — utilidades de fechas y cálculo de cobertura de stock
- `firestore.rules` — reglas de seguridad de Firestore (ver nota de seguridad dentro del archivo)

## Primer uso
La primera vez que alguien entra en `index.html` con una contraseña, esa contraseña se
guarda como la contraseña del equipo (no hace falta configurarla a mano en Firestore).

## Publicar en GitHub Pages
Settings → Pages → Source: rama `main`, carpeta `/ (root)`.

## Notas sobre esta versión
Es una reescritura desde cero (no un port línea a línea) del proyecto original en
Next.js + Prisma + Postgres, pensada para funcionar 100% gratis en GitHub Pages sin
servidor propio. Algunas simplificaciones respecto a la versión Next.js:
- La cobertura de stock usa el consumo diario por defecto del producto (no las
  cantidades planificadas día a día).
- La planificación semanal usa un único campo de cantidad total por día y producto
  (en vez de desayuno/comida/extra por separado).

Si quieres afinar cualquiera de estos puntos, se puede ajustar sin rehacer nada más.
