// ==========================================
// HOSTLY — Conexión con Firebase
// Los valores vienen del archivo .env (ver .env.example y la guía de Firebase)
// ==========================================

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// true si el .env tiene al menos la clave y el proyecto
export const firebaseConfigurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = firebaseConfigurado ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Para probar sin tocar datos reales: VITE_USAR_EMULADOR=true y `npx firebase emulators:start`
export const usarEmulador = import.meta.env.VITE_USAR_EMULADOR === "true";
export const URL_EMULADOR_AUTH = "http://127.0.0.1:9099";

if (app && usarEmulador) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, URL_EMULADOR_AUTH, { disableWarnings: true });
}
export default app;
