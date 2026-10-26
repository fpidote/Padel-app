// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithCustomToken } from "firebase/auth";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "app-padel-torneo.firebaseapp.com",
  projectId: "app-padel-torneo",
  storageBucket: "app-padel-torneo.firebasestorage.app",
  messagingSenderId: "1088235384207",
  appId: "1:1088235384207:web:1aa32f459a841ec71a6ffa",
  measurementId: "G-RJ6C32F26R",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch (_) {
    // Already connected (HMR reload)
  }
  // Exposed for e2e tests: window.__e2eSignIn(customToken)
  window.__e2eSignIn = (token) => signInWithCustomToken(auth, token);
}

// Analytics no funciona en SSR/emuladores/navegadores sin soporte (ej. Safari privado) — se inicializa async.
let analytics = null;
if (import.meta.env.VITE_USE_EMULATOR !== "true") {
  isSupported()
    .then((supported) => {
      if (supported) analytics = getAnalytics(app);
    })
    .catch(() => {});
}

export function trackEvent(name, params) {
  if (analytics) logEvent(analytics, name, params);
}