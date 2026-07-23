// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithCustomToken } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "app-padel-torneo.firebaseapp.com",
  projectId: "app-padel-torneo",
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