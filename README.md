# Panadería — Inventario, Planificación y Amasadoras

App estática (HTML/CSS/JS, sin build ni servidor) para GitHub Pages, con **Firebase Firestore** como base de datos.

## Estructura
- `index.html` — entrada/redirección a la aplicación
- `dashboard.html`, `inventario.html`, `planificacion.html`, `amasadoras.html`, `orden-trabajo.html`, `configuracion.html` — páginas de la app
- `js/firebase-config.js` — configuración de Firebase (datos públicos del proyecto)
- `js/data.js` — acceso a Firestore (equivalente a las antiguas rutas API)
- `js/utils.js` — utilidades de fechas y cálculo de cobertura de stock
- `js/components.js` — componentes HTML reutilizables para controles comunes
- `js/domain.js` — validación y tipos JSDoc del dominio
- `firestore.rules` — reglas de seguridad de Firestore (ver nota de seguridad dentro del archivo)

## Diseño (pautas Apple HIG)

La interfaz sigue las pautas de las Human Interface Guidelines de Apple, adaptadas a la web:

- Colores semánticos con variables CSS, con soporte de modo claro/oscuro mediante prefers-color-scheme.
- Contraste accesible: botones, textos y badges cumplen WCAG AA (4.5:1).
- Tipografía del sistema (SF Pro / -apple-system).
- Iconografía SVG uniforme (estilo SF Symbols) en lugar de emojis, definida en js/ui.js.
- Superficies translúcidas (glass) sutiles con sombras suaves y radios generosos.
- Feedback no intrusivo: notificaciones toast() en lugar de alert()/prompt().

## Cálculo de cobertura (días)

La cobertura indica cuántos días durará el stock actual de un producto:

**Cobertura = stock actual ÷ consumo diario del producto**

- El **consumo diario** se configura por producto en **Configuración** (campo "Consumo diario"). Al crear un producto nuevo se usa un valor por defecto de 10 unidades/día.
- Ejemplo: con 500 unidades y consumo diario 10 → 50 días; con consumo diario 50 → 10 días.
- Si el producto no tiene consumo diario definido (0), la app muestra "Sin datos" en lugar de dar una alarma falsa.
- En Inventario y en el Inicio se muestra el ritmo usado (ej. "a 50/día") junto a los días, para que siempre sepas con qué dato se calcula.

## Acceso

La aplicación no requiere contraseña ni sesión: cualquier persona con acceso a la URL
puede utilizarla directamente.

Las operaciones que modifican stock se ejecutan en transacciones de Firestore para
evitar actualizaciones parciales y no permiten que el stock quede por debajo de cero.

## Verificación

Las reglas de negocio puras se validan con Node mediante `npm test`.

La auditoría visual mantiene una única escala de espaciado y colores semánticos,
incluye foco visible, reducción de movimiento, fallback sin `backdrop-filter` y
una tabla de planificación navegable horizontalmente en móvil.

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