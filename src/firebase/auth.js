// ==========================================
// HOSTLY — Autenticación, registro de hotel y empleados
// ==========================================

import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfig, usarEmulador, URL_EMULADOR_AUTH } from "./config";

export const ROLES = ["admin", "recepcionista", "servicio", "contador", "vigilante"];

export const login = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const logout = () => signOut(auth);

export const escucharSesion = (callback) => onAuthStateChanged(auth, callback);

// Perfil del usuario (usuarios/{uid}): rol, hotelId, activo…
// Se ignoran las versiones locales aún no guardadas en el servidor: al registrar
// un hotel, el perfil aparece aquí antes de existir para las reglas de seguridad.
export const escucharPerfil = (uid, callback, onError) =>
  onSnapshot(
    doc(db, "usuarios", uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      callback(snap.exists() ? { uid, ...snap.data() } : null);
    },
    onError
  );

export const escucharHotel = (hotelId, callback) =>
  onSnapshot(doc(db, "hoteles", hotelId), (snap) =>
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );

/**
 * Registro de un hotel nuevo: crea la cuenta del dueño, el hotel y su perfil de admin.
 * Las reglas de Firestore solo permiten esto si el hotel queda a nombre del mismo usuario.
 */
export const registrarHotel = async ({ nombreHotel, ciudad, nombre, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const hotelRef = doc(collection(db, "hoteles"));

  const batch = writeBatch(db);
  batch.set(hotelRef, {
    nombre: nombreHotel.trim(),
    ciudad: ciudad?.trim() || "",
    ownerUid: uid,
    plan: "prueba",
    creadoEn: serverTimestamp(),
  });
  batch.set(doc(db, "usuarios", uid), {
    nombre: nombre.trim(),
    email,
    rol: "admin",
    area: "Dirección",
    hotelId: hotelRef.id,
    activo: true,
    creadoEn: serverTimestamp(),
  });
  await batch.commit();
  return { uid, hotelId: hotelRef.id };
};

/**
 * Crea un empleado SIN cerrar la sesión del admin.
 * La cuenta se crea en una instancia secundaria de Firebase, que luego se descarta;
 * el perfil lo escribe el admin con su propia sesión.
 */
export const crearEmpleado = async ({ email, password, rol, nombre, area, hotelId }) => {
  const secundaria = initializeApp(firebaseConfig, `alta-${Date.now()}`);
  try {
    const authSec = getAuth(secundaria);
    if (usarEmulador) connectAuthEmulator(authSec, URL_EMULADOR_AUTH, { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(authSec, email, password);
    await signOut(authSec);

    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nombre,
      email,
      rol,
      area: area || "",
      hotelId,
      activo: true,
      creadoEn: serverTimestamp(),
    });
    return cred.user.uid;
  } finally {
    await deleteApp(secundaria);
  }
};

export const actualizarEmpleado = (uid, datos) =>
  updateDoc(doc(db, "usuarios", uid), { ...datos, actualizadoEn: serverTimestamp() });
