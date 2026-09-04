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
- `js/push.js` — registro de notificaciones push (FCM)
- `functions/` — Cloud Function opcional para el aviso diario
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

## Deducción diaria automática

El stock se actualiza automáticamente al abrir la app (Inicio o Inventario): se descuenta de
cada producto de tipo STOCK activo la cantidad **total planificada** (desayuno + comida +
extra) de **cada día ya pasado**.

- Se descuenta por día ya transcurrido: la planificación de **hoy** queda como previsión y se
  descuenta cuando se abre la app al día siguiente, para no contar el mismo consumo dos veces.
- Es **idempotente**: cada producto guarda `ultimaDeduccion` (el último día descontado) y aunque
  se abra la app varias veces en el mismo día no vuelve a descontar nada.
- Si la app se abre varios días después, se pone al día descontando los días intermedios en los
  que hubo planificación.
- No deja el stock en negativo: descuenta como máximo lo disponible.
- Cada descuento queda registrado en movimientos con tipo **Consumo**.

## Rendimiento

- **Caché de productos**: los productos se leen una sola vez por página (`js/data.js`) y se
  cachean ~30 s, evitando 4-5 lecturas repetidas de Firestore por carga. La caché se invalida
  tras cada escritura (ajustes, amasadoras y la propia liquidación diaria).
- **Liquidación perezosa**: `processDailyConsumption` comprueba si todos los productos ya están
  al día y, en ese caso, regresa sin consultar la planificación ni abrir transacciones.
- **Service worker**: se cachea en runtime el SDK de Firebase (gstatic) para no volver a
  descargarlo en cada página, y los assets propios se sirven desde caché.

## Notificaciones push (móvil)

La app puede avisar en el móvil con una notificación diaria. Lo que hay en el código:

- Cliente: [`js/push.js`](js/push.js) pide permiso, obtiene el token de FCM y lo guarda en la
  colección `pushSubscriptions`. Se carga solo en Configuración (no lastra las demás páginas).
- Service worker: [`sw.js`](sw.js) escucha `push` (segundo plano), muestra el aviso y con
  `notificationclick` abre la app. La caché/PWA sigue intacta (versión `panaderia-v2`).
- **Envío diario (gratuito, sin Blaze)**: workflow de GitHub Actions
  [`.github/workflows/daily-push.yml`](.github/workflows/daily-push.yml) + script
  [`.github/scripts/daily-push.mjs`](.github/scripts/daily-push.mjs). Lee Firestore, resume la
  planificación del día y los productos sin stock, y envía por FCM. Corre ~06:30 Madrid.
- Alternativa con Cloud Functions (requiere **Blaze**):
  [`functions/index.js`](functions/index.js) con `dailyPush` programada a las 06:30. Solo hace
  falta si prefieres Cloud Functions y subes a Blaze.

**Claves y secretos**: la `VAPID_KEY` es el certificado **público** de Web Push (no es un
secreto). El frontend no contiene ninguna clave privada. El **service account** (secreto) solo se
guarda como secreto del repositorio de GitHub, nunca en el código.

### Pasos manuales (una sola vez)

1. Firebase Console → proyecto `foodservice-panaderia` → **Project settings → Cloud Messaging**.
   Activa Cloud Messaging si no lo está.
2. En **Web Push certificates**, copiar la **Key pair** y pegarla como `VAPID_KEY` en
   [`js/firebase-config.js`](js/firebase-config.js).
3. En **Project settings → Service accounts**, pulsar **Generate new private key** y descargar el
   JSON del service account.
4. En GitHub → repo → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Nombre: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: pega el contenido completo del JSON.
5. En **Configuración → Notificaciones en el móvil**, pulsar **Activar notificaciones** y aceptar
   el permiso (en iOS, primero instala la app en la pantalla de inicio).

### El aviso diario (GitHub Actions)

El workflow de [`daily-push.yml`](.github/workflows/daily-push.yml) se ejecuta con el cron
(04:30 y 05:30 UTC) y el script espera a las **06:30 Madrid** y es idempotente (marca en
`pushMeta/daily` para no repetir). Puedes forzarlo con el botón **Run workflow** del tab Actions.

- **iOS**: las notificaciones solo llegan si la PWA está instalada (pantalla de inicio) y es
  iOS 16.4+.
- **Primer plano**: el aviso se muestra como toast dentro de la app.
- La deducción diaria muestra su propio toast al abrir Inicio o Inventario.

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
- La deducción diaria automática se ejecuta en el cliente al abrir la app (no hay servidor),
  por lo que se aplica al cargar Inicio o Inventario.

Si quieres afinar cualquiera de estos puntos, se puede ajustar sin rehacer nada más.
