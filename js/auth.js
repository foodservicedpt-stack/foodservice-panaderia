import { db, doc, getDoc, setDoc } from "./firebase-config.js";
import { sha256Hex } from "./utils.js";

const SESSION_KEY = "foodservice-session";
const CONFIG_DOC = doc(db, "config", "team");

// Llama esto al principio de cada página protegida (todas menos index.html)
export function requireSession() {
  if (sessionStorage.getItem(SESSION_KEY) !== "ok") {
    window.location.href = "index.html";
  }
}

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === "ok";
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

// Devuelve { success: true } o { error: '...' }
export async function login(password) {
  if (!password) return { error: "Introduce la contraseña" };

  const snap = await getDoc(CONFIG_DOC);
  const hash = await sha256Hex(password);

  if (!snap.exists()) {
    // Primera vez: no hay contraseña configurada todavía -> la contraseña
    // introducida ahora se convierte en la contraseña del equipo.
    await setDoc(CONFIG_DOC, { passwordHash: hash });
    sessionStorage.setItem(SESSION_KEY, "ok");
    return { success: true, bootstrapped: true };
  }

  if (snap.data().passwordHash !== hash) {
    return { error: "Contraseña incorrecta" };
  }

  sessionStorage.setItem(SESSION_KEY, "ok");
  return { success: true };
}

export async function changePassword(currentPassword, newPassword) {
  const snap = await getDoc(CONFIG_DOC);
  if (!snap.exists()) return { error: "Configuración no encontrada" };

  const currentHash = await sha256Hex(currentPassword);
  if (snap.data().passwordHash !== currentHash) {
    return { error: "Contraseña actual incorrecta" };
  }

  const newHash = await sha256Hex(newPassword);
  await setDoc(CONFIG_DOC, { passwordHash: newHash });
  return { success: true };
}
