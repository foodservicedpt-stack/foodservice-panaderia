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
import { parseDateString, toDateString } from "./utils.js";
import { validateMovementInput, validateNonNegativeInteger, validateProductInput } from "./domain.js";

// ---------- Productos ----------

export async function getProductos() {
  const q = query(collection(db, "productos"), orderBy("orden", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProductosStock() {
  const all = await getProductos();
  return all.filter((p) => p.categoria === "STOCK" && p.activo !== false);
}

export async function saveProducto(body) {
  const { id, nombre, categoria, margenSeguridadDias, consumoDiarioDefecto, diaSemanal, activo } = body;
  validateProductInput({ nombre, categoria, margenSeguridadDias, consumoDiarioDefecto });

  if (id) {
    const ref = doc(db, "productos", String(id));
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (categoria !== undefined) data.categoria = categoria;
    if (margenSeguridadDias !== undefined) data.margenSeguridadDias = Number(margenSeguridadDias);
    if (consumoDiarioDefecto !== undefined) data.consumoDiarioDefecto = Number(consumoDiarioDefecto);
    if (diaSemanal !== undefined) data.diaSemanal = diaSemanal;
    if (activo !== undefined) data.activo = activo;
    data.updatedAt = new Date().toISOString();
    await updateDoc(ref, data);
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
      diaSemanal: diaSemanal ?? null,
      orden: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(collection(db, "productos"), data);
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
    return { ...a, producto: productosById[a.productoId] };
  });
}

export async function createAmasadora({ productoId, fechaInicio }) {
  if (!productoId) throw new Error("Producto obligatorio");
  if (fechaInicio) parseDateString(fechaInicio);
  const fecha = fechaInicio ? toDateString(parseDateString(fechaInicio)) : toDateString(new Date());
  const now = new Date().toISOString();
  const data = {
    productoId: String(productoId),
    fechaInicio: fecha,
    estado: "EN_FERMENTACION",
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
