// src/hooks/useHelpers.js
// Ayudantes de un torneo (subcolección torneos/{code}/helpers/{correo}). Solo lo usa el dueño. Se lee con
// getDocs (una vez, sin listener): la lista solo cambia cuando el dueño la edita desde esta pantalla.
import { useState, useEffect } from "react";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { showToast } from "../logic/toast";
import { normalizeEmail, validateNewHelper } from "../logic/helpers";

export function useHelpers(code, enabled) {
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(!!enabled);

  useEffect(() => {
    if (!enabled || !code) return undefined;
    let cancelled = false;
    getDocs(collection(db, "torneos", code, "helpers"))
      .then((snap) => {
        if (!cancelled) setHelpers(snap.docs.map((d) => d.id).sort());
      })
      .catch((err) => {
        console.error("Error al leer los ayudantes:", err);
        showToast("No se pudo cargar la lista de ayudantes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, enabled]);

  // Devuelve el motivo si no se pudo añadir, o null si quedó añadido
  async function add(raw) {
    const error = validateNewHelper(raw, helpers);
    if (error) return error;
    const email = normalizeEmail(raw);
    try {
      await setDoc(doc(db, "torneos", code, "helpers", email), { addedAt: serverTimestamp() });
      setHelpers((prev) => [...prev, email].sort());
      return null;
    } catch (err) {
      console.error("Error al añadir ayudante:", err);
      return "No se pudo añadir. Inténtalo de nuevo.";
    }
  }

  async function remove(email) {
    try {
      await deleteDoc(doc(db, "torneos", code, "helpers", email));
      setHelpers((prev) => prev.filter((e) => e !== email));
    } catch (err) {
      console.error("Error al quitar ayudante:", err);
      showToast("No se pudo quitar al ayudante. Inténtalo de nuevo.");
    }
  }

  return { helpers, loading, add, remove };
}
