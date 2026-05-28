// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: "app-padel-torneo",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);