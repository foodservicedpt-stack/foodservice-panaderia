import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from "./firebase-config.js";
import { parseDateString, toDateString, addCalendarDays } from "./utils.js";
import { validateMovementInput, validateNonNegativeInteger, validateProductInput, produccionTipo, pendingDeductions, applyConsumptionToStock } from "./domain.js";

// ---------- Productos ----------

// Caché en memoria de productos para evitar lecturas repetidas de Firestore (la app
// consulta productos varias veces en una misma carga de página). Se invalida tras cada
// escritura que modifica productos o su stock para que las lecturas posteriores sean frescas.
let productosCache = null;
let productosCacheAt = 0;
const PRODUCTOS_TTL_MS = 30000;

export function invalidateProductosCache() {
  productosCache = null;
  productosCacheAt = 0;
}

export async function getProductos() {
  const now = Date.now();
  if (productosCache && now - productosCacheAt < PRODUCTOS_TTL_MS) return productosCache;
  const q = query(collection(db, "productos"), orderBy("orden", "asc"));
  const snap = await getDocs(q);
  productosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  productosCacheAt = now;
  return productosCache;
}

export async function getProductosStock() {
  const all = await getProductos();
  return all.filter((p) => p.categoria === "STOCK" && p.activo !== false);
}

export async function saveProducto(body) {
  const { id, nombre, categoria, margenSeguridadDias, consumoDiarioDefecto, diaSemanal, activo, unidad } = body;
  validateProductInput({ nombre, categoria, margenSeguridadDias, consumoDiarioDefecto, unidad });

  if (id) {
    const ref = doc(db, "productos", String(id));
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (categoria !== undefined) data.categoria = categoria;
    if (margenSeguridadDias !== undefined) data.margenSeguridadDias = Number(margenSeguridadDias);
    if (consumoDiarioDefecto !== undefined) data.consumoDiarioDefecto = Number(consumoDiarioDefecto);
    if (unidad !== undefined) data.unidad = String(unidad).trim();
    if (diaSemanal !== undefined) data.diaSemanal = diaSemanal;
    if (activo !== undefined) data.activo = activo;
    data.updatedAt = new Date().toISOString();
    await updateDoc(ref, data);
    invalidateProductosCache();
    return { id, ...data };
  } else {
    const all = await getProductos();
    const maxOrder = all.reduce((m, p) => Math.max(m, p.orden || 0), 0);
    const now = new Date().toISOString();
    const data = {
      nombre: nombre ?? "Nuevo producto",
      categoria: categoria ?? "STOCK",
      activo: true,
      margenSeguridadDias: margenSeguridadDias === undefined ? 2 : Number(margenSeguridadDias),
      margenSeguridadUnidades: 0,
      stockActual: 0,
      consumoDiarioDefecto: consumoDiarioDefecto === undefined ? 10 : Number(consumoDiarioDefecto),
      unidad: (unidad !== undefined && String(unidad).trim()) ? String(unidad).trim() : "uds.",
      diaSemanal: diaSemanal ?? null,
      orden: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(collection(db, "productos"), data);
    invalidateProductosCache();
    return { id: ref.id, ...data };
  }
}

// ---------- Inventario ----------

export async function getInventario() {
  const products = await getProductosStock();
  const q = query(collection(db, "movimientos"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  const productosById = Object.fromEntries((await getProductos()).map((p) => [p.id, p]));
  const movimientos = snap.docs.map((d) => {
    const mv = { id: d.id, ...d.data() };
    return { ...mv, producto: productosById[mv.productoId] };
  });
  return { products, movimientos };
}

export async function addMovimiento({ productoId, cantidad, tipo, notas }) {
  validateMovementInput({ productoId, cantidad, notas });
  const qty = Number(cantidad);
  const productRef = doc(db, "productos", String(productoId));
  const movementRef = doc(collection(db, "movimientos"));
  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error("Producto no encontrado");
    const currentStock = Number(productSnap.data().stockActual) || 0;
    if (currentStock + qty < 0) throw new Error("El stock no puede quedar en negativo");
    transaction.update(productRef, { stockActual: currentStock + qty });
    transaction.set(movementRef, {
      productoId: String(productoId), fecha: toDateString(new Date()), cantidad: qty,
      tipo: tipo || "AJUSTE", notas: notas || null, createdAt: new Date().toISOString(),
    });
  });
  invalidateProductosCache();
}

// ---------- Planificación ----------
// doc id = `${productoId}_${fecha}`

export async function getPlanificacion(start, end) {
  const q = query(collection(db, "planificacion"), where("fecha", ">=", start), where("fecha", "<=", end));
  const snap = await getDocs(q);
  const productosById = Object.fromEntries((await getProductos()).map((p) => [p.id, p]));
  const planificaciones = snap.docs.map((d) => {
    const pl = { id: d.id, ...d.data() };
    return { ...pl, producto: productosById[pl.productoId] };
  });
  const products = await getProductosStock();
  return { planificaciones, products };
}

export async function savePlanificacion({ productoId, fecha, desayuno, comida, extra, esExcepcion }) {
  if (!productoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Producto o fecha inválidos");
  parseDateString(fecha);
  validateNonNegativeInteger(desayuno, "Desayuno");
  validateNonNegativeInteger(comida, "Comida");
  validateNonNegativeInteger(extra, "Extra");
  const id = `${productoId}_${fecha}`;
  const ref = doc(db, "planificacion", id);
  const data = {
    productoId: String(productoId),
    fecha,
    desayuno: Number(desayuno),
    comida: Number(comida),
    extra: Number(extra),
    esExcepcion: !!esExcepcion,
  };
  await setDoc(ref, data, { merge: true });
  return { id, ...data };
}

// ---------- Amasadoras ----------

export async function getAmasadoras() {
  const q = query(collection(db, "amasadoras"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const productosById = Object.fromEntries((await getProductos()).map((p) => [p.id, p]));
  return snap.docs.map((d) => {
    const a = { id: d.id, ...d.data() };
    return { ...a, tipo: a.tipo || "MASAS", nombre: a.nombre || null, producto: productosById[a.productoId] };
  });
}

export async function createAmasadora({ productoId, fechaInicio, tipo, nombre }) {
  const def = produccionTipo(tipo || "MASAS");
  if (def.tracksStock && !productoId) throw new Error("Selecciona un producto");
  if (!def.tracksStock && !nombre) throw new Error("Pon un nombre a la producción");
  if (fechaInicio) parseDateString(fechaInicio);
  const fecha = fechaInicio ? toDateString(parseDateString(fechaInicio)) : toDateString(new Date());
  const now = new Date().toISOString();
  const data = {
    productoId: def.tracksStock ? String(productoId) : null,
    tipo: def.tipo,
    nombre: nombre ? String(nombre).trim() : null,
    fechaInicio: fecha,
    estado: "PLANIFICADA",
    piezasProducidas: null,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, "amasadoras"), data);
  const productosById = Object.fromEntries((await getProductos()).map((p) => [p.id, p]));
  return { id: ref.id, ...data, producto: productosById[productoId] };
}

export async function confirmarAmasadora({ amasadoraId, piezas }) {
  const pzs = Number(piezas);
  if (!amasadoraId || !Number.isInteger(pzs) || pzs <= 0) throw new Error("Datos inválidos");

  const ref = doc(db, "amasadoras", String(amasadoraId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Amasadora no encontrada");
  const amasadora = snap.data();

  const productRef = doc(db, "productos", String(amasadora.productoId));
  const movementRef = doc(collection(db, "movimientos"));
  await runTransaction(db, async (transaction) => {
    const amasadoraSnap = await transaction.get(ref);
    if (!amasadoraSnap.exists()) throw new Error("Amasadora no encontrada");
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error("Producto no encontrado");
    if (amasadoraSnap.data().estado === "COMPLETADA") throw new Error("La amasadora ya está completada");
    transaction.update(ref, { estado: "COMPLETADA", piezasProducidas: pzs, updatedAt: new Date().toISOString() });
    transaction.update(productRef, { stockActual: (Number(productSnap.data().stockActual) || 0) + pzs });
    transaction.set(movementRef, {
      productoId: String(amasadora.productoId), fecha: toDateString(new Date()), cantidad: pzs,
      tipo: "AMASADA", notas: `Amasadora del ${amasadora.fechaInicio}`,
      createdAt: new Date().toISOString(),
    });
  });
  invalidateProductosCache();
}

export async function cancelarProduccion({ produccionId }) {
  if (!produccionId) throw new Error("Producción obligatoria");
  const ref = doc(db, "amasadoras", String(produccionId));
  await updateDoc(ref, { estado: "CANCELADA", updatedAt: new Date().toISOString() });
}

export async function eliminarProduccion({ produccionId }) {
  if (!produccionId) throw new Error("Producción obligatoria");
  await deleteDoc(doc(db, "amasadoras", String(produccionId)));
}

// ---------- Orden de trabajo ----------

export async function getOrdenTrabajo(start, end) {
  const [itemsSnap, notasSnap, planSnap] = await Promise.all([
    getDocs(query(collection(db, "ordenTrabajo"), where("fecha", ">=", start), where("fecha", "<=", end))),
    getDocs(query(collection(db, "notas"), where("fecha", ">=", start), where("fecha", "<=", end))),
    getDocs(query(collection(db, "planificacion"), where("fecha", ">=", start), where("fecha", "<=", end))),
  ]);
  const products = (await getProductos()).filter((p) => p.activo !== false);
  const productosById = Object.fromEntries(products.map((p) => [p.id, p]));

  const items = itemsSnap.docs.map((d) => {
    const it = { id: d.id, ...d.data() };
    return { ...it, producto: productosById[it.productoId] };
  });
  const notas = notasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const planificaciones = planSnap.docs.map((d) => {
    const pl = { id: d.id, ...d.data() };
    return { ...pl, producto: productosById[pl.productoId] };
  });

  return { items, notas, products, planificaciones };
}

export async function toggleOrdenTrabajo({ productoId, fecha, completado }) {
  if (!productoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Producto o fecha inválidos");
  parseDateString(fecha);
  const id = `${productoId}_${fecha}`;
  await setDoc(doc(db, "ordenTrabajo", id), { productoId: String(productoId), fecha, completado }, { merge: true });
}

export async function saveNota({ fecha, nota }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida");
  parseDateString(fecha);
  if (typeof nota !== "string") throw new Error("La nota debe ser texto");
  const ref = doc(db, "notas", fecha);
  if (!nota || !nota.trim()) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { fecha, nota });
  }
}
// ---------- Liquidación diaria automática del stock según la planificación ----------

/** Descuenta cada día ya pasado, de forma idempotente, la cantidad planificada.
 *  - Solo actúa sobre productos de tipo STOCK activos.
 *  - Usa la cantidad total planificada (desayuno + comida + extra) para cada fecha.
 *  - Descuenta solo días anteriores a hoy: la planificación de hoy queda como previsión y
 *    se descuenta cuando se abra la app al día siguiente (así no se cuenta dos veces).
 *  - No deja el stock en negativo (consume como máximo lo disponible).
 *  - Marca cada producto con ultimaDeduccion = ayer y se pone al día si la app se abre
 *    varios días después, sin volver a descontar el mismo día dos veces. */
export async function processDailyConsumption(todayStr = toDateString(new Date())) {
  const today = typeof todayStr === "string" ? parseDateString(todayStr) : todayStr;
  const todayDate = toDateString(today);
  const yesterday = addCalendarDays(today, -1);
  const yesterdayStr = toDateString(yesterday);
  const endMs = yesterday.getTime();
  const products = await getProductosStock();
  if (!products.length) return { appliedDays: 0, appliedUnits: 0, deductions: [] };

  // Si todos los productos ya están liquidados hasta ayer, no hay nada que hacer:
  // evitamos consultar la planificación y, sobre todo, las transacciones.
  const needsSettlement = products.some((p) => !p.ultimaDeduccion || p.ultimaDeduccion < yesterdayStr);
  if (!needsSettlement) return { appliedDays: 0, appliedUnits: 0, deductions: [] };

  // Rango de planificación a consultar: desde el día siguiente a la última deducción
  // del producto más atrasado hasta ayer.
  let minFromMs = endMs;
  for (const p of products) {
    if (!p.ultimaDeduccion) continue;
    const fromMs = addCalendarDays(parseDateString(p.ultimaDeduccion), 1).getTime();
    if (fromMs < minFromMs) minFromMs = fromMs;
  }
  const minFromStr = toDateString(new Date(minFromMs));

  const planSnap = await getDocs(
    query(collection(db, "planificacion"), where("fecha", ">=", minFromStr), where("fecha", "<=", yesterdayStr))
  );
  const planByKey = {};
  planSnap.docs.forEach((d) => {
    const pl = d.data();
    planByKey[`${pl.productoId}_${pl.fecha}`] = pl;
  });

  const deductions = pendingDeductions({ products, planByKey, todayStr: todayDate });
  const byProduct = {};
  for (const it of deductions) {
    (byProduct[it.productoId] = byProduct[it.productoId] || []).push(it);
  }

  let appliedDays = 0;
  let appliedUnits = 0;
  let changed = false;
  for (const p of products) {
    const items = byProduct[p.id] || [];
    // Si ya está liquidado hasta ayer (o más adelante), no hace falta tocarlo.
    if (p.ultimaDeduccion && p.ultimaDeduccion >= yesterdayStr) continue;
    const ref = doc(db, "productos", p.id);
    try {
      const res = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return { advanced: false, days: 0, units: 0 };
        const prod = snap.data();
        // Releer la última deducción por si otro cliente ya liquidó (idempotencia).
        const last = prod.ultimaDeduccion ? parseDateString(prod.ultimaDeduccion) : null;
        const from = last ? addCalendarDays(last, 1) : today;
        if (last && from.getTime() > endMs) return { advanced: false, days: 0, units: 0 }; // ya está al día
        const pending = items.filter((it) => {
          const d = parseDateString(it.fecha);
          return d.getTime() >= from.getTime() && d.getTime() <= endMs;
        });
        const { stockFinal, applied: consumos } = applyConsumptionToStock(prod.stockActual, pending);
        if (consumos.length) {
          for (const c of consumos) {
            transaction.set(doc(collection(db, "movimientos")), {
              productoId: p.id, fecha: c.fecha, cantidad: -c.cantidad, tipo: "CONSUMO",
              notas: `Consumo diario ${c.fecha}`, createdAt: new Date().toISOString(),
            });
          }
        }
        transaction.update(ref, { stockActual: stockFinal, ultimaDeduccion: yesterdayStr });
        return { advanced: true, days: consumos.length, units: consumos.reduce((s, c) => s + c.cantidad, 0) };
      });
      appliedDays += res.days;
      appliedUnits += res.units;
      if (res.advanced) changed = true;
    } catch (err) {
      // No interrumpir el arranque si un producto falla; se reintentará en la próxima carga.
      console.warn(`[dailyConsumption] ${p.id}:`, err.message);
    }
  }
  if (changed) invalidateProductosCache();
  return { appliedDays, appliedUnits, deductions };
}
