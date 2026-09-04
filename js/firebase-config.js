// Configuración de Firebase — datos públicos del proyecto, no son secretos.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
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
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcucKJ5IDV_z9mN0xSkNPIU5X_rIqYkL4",
  authDomain: "foodservice-panaderia.firebaseapp.com",
  databaseURL: "https://foodservice-panaderia-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "foodservice-panaderia",
  storageBucket: "foodservice-panaderia.firebasestorage.app",
  messagingSenderId: "885840178305",
  appId: "1:885840178305:web:54893c3b23e64e07e2f180",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Clave VAPID del "Web Push certificate" del proyecto (Project Settings → Cloud Messaging).
// Es pública y necesaria para registrar el token de notificaciones en el navegador.
export const VAPID_KEY = "BD4_rnVknqnyu4JAYxzmjezGVixkIoQPM9r3wdTlsv3nC6Yyemd2lmGrZbJi87h4B_Klf4i6aDerodSbx3pMrew"; // <-- Reemplázala por la de tu proyecto

export {
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
  Timestamp,
};
