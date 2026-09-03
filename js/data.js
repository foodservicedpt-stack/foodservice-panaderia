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
  increment,
} from "./firebase-config.js";
import { toDateString } from "./utils.js";

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

  if (id) {
    const ref = doc(db, "productos", String(id));
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (categoria !== undefined) data.categoria = categoria;
    if (margenSeguridadDias !== undefined) data.margenSeguridadDias = parseInt(margenSeguridadDias);
    if (consumoDiarioDefecto !== undefined) data.consumoDiarioDefecto = parseInt(consumoDiarioDefecto);
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
      margenSeguridadDias: parseInt(margenSeguridadDias) || 2,
      margenSeguridadUnidades: 0,
      stockActual: 0,
      consumoDiarioDefecto: parseInt(consumoDiarioDefecto) || 10,
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
  const qty = parseInt(cantidad);
  const ref = doc(db, "productos", String(productoId));
  await updateDoc(ref, { stockActual: increment(qty) });

  await addDoc(collection(db, "movimientos"), {
    productoId: String(productoId),
    fecha: toDateString(new Date()),
    cantidad: qty,
    tipo: tipo || "AJUSTE",
    notas: notas || null,
    createdAt: new Date().toISOString(),
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
  const id = `${productoId}_${fecha}`;
  const ref = doc(db, "planificacion", id);
  const data = {
    productoId: String(productoId),
    fecha,
    desayuno: parseInt(desayuno) || 0,
    comida: parseInt(comida) || 0,
    extra: parseInt(extra) || 0,
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
  const fecha = fechaInicio ? toDateString(new Date(fechaInicio)) : toDateString(new Date());
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
  const pzs = parseInt(piezas);
  if (!amasadoraId || !pzs || pzs <= 0) throw new Error("Datos inválidos");

  const ref = doc(db, "amasadoras", String(amasadoraId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Amasadora no encontrada");
  const amasadora = snap.data();

  await updateDoc(ref, { estado: "COMPLETADA", piezasProducidas: pzs, updatedAt: new Date().toISOString() });

  await updateDoc(doc(db, "productos", String(amasadora.productoId)), {
    stockActual: increment(pzs),
  });

  await addDoc(collection(db, "movimientos"), {
    productoId: String(amasadora.productoId),
    fecha: toDateString(new Date()),
    cantidad: pzs,
    tipo: "AMASADA",
    notas: `Amasadora del ${new Date(amasadora.fechaInicio).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`,
    createdAt: new Date().toISOString(),
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
  const id = `${productoId}_${fecha}`;
  await setDoc(doc(db, "ordenTrabajo", id), { productoId: String(productoId), fecha, completado }, { merge: true });
}

export async function saveNota({ fecha, nota }) {
  const ref = doc(db, "notas", fecha);
  if (!nota || !nota.trim()) {
    await deleteDoc(ref).catch(() => {});
  } else {
    await setDoc(ref, { fecha, nota });
  }
}
