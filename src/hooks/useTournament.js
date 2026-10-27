// src/hooks/useTournament.js
import { useState, useEffect, useRef } from "react";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../firebase";
import { buildShareMessage } from "../logic/utils";
import { showToast } from "../logic/toast";

export function useTournament(code) {
  const [authUser, setAuthUser] = useState(null);
  const [t, setT] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const isAdmin = !!(authUser?.uid && t?.ownerUid && authUser.uid === t.ownerUid);

  const verRef = useRef(null);
  const wasAdminRef = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setAuthUser(user));
  }, []);

  // ── Detección de sesión expirada ────────────────────────────
  // Si el usuario era admin y dejó de serlo porque se deslogueó (no porque
  // cambió el dueño del torneo), avisamos para que se vuelva a autenticar.
  useEffect(() => {
    if (wasAdminRef.current && !isAdmin && authUser === null) {
      setSessionExpired(true);
    } else if (isAdmin) {
      setSessionExpired(false);
    }
    wasAdminRef.current = isAdmin;
  }, [isAdmin, authUser]);

  async function reauthenticate() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Error al reautenticar:", err);
        showToast("No se pudo iniciar sesión. Inténtalo de nuevo.");
      }
    }
  }

  // ── Firebase Realtime Listener ──────────────────────────────
  useEffect(() => {
    if (!code) return;
    verRef.current = null;
    setT(null);
    setNotFound(false);
    setError(null);
    const unsub = onSnapshot(
      doc(db, "torneos", code),
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        // Hallazgo 2: JSON.parse con guard — datos corruptos en Firestore no rompen el listener
        let data;
        try {
          data = JSON.parse(snap.data().data);
        } catch {
          setNotFound(true);
          return;
        }
        if (!data || data.ver <= verRef.current) return;
        verRef.current = data.ver;
        setT(data);
      },
      // Hallazgo 4: errores del listener expuestos como estado, no solo console.error
      (err) => {
        console.error("Firebase listener:", err);
        setError(err);
      },
    );
    return () => unsub();
  }, [code]);

  // ── persist ─────────────────────────────────────────────────
  // Hallazgo 1: rollback completo si setDoc falla
  // Hallazgo 3: guard anti-concurrencia para evitar race condition de doble-click
  async function persist(newT) {
    if (saving) return;
    const prevT = t;
    const prevVer = verRef.current;
    const updated = { ...newT, ver: (newT.ver || 0) + 1 };
    setSaving(true);
    try {
      verRef.current = updated.ver;
      setT(updated);
      await setDoc(doc(db, "torneos", code), {
        data: JSON.stringify(updated),
      }, { merge: true });
    } catch (err) {
      verRef.current = prevVer;
      setT(prevT);
      console.error("Error al guardar:", err);
      showToast("No se pudieron guardar los cambios. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  // ── copyCode ─────────────────────────────────────────────────
  function copyCode() {
    const msg = buildShareMessage(t, code);
    if (navigator.share) {
      navigator.share({ title: t?.config?.name || "Torneo de Pádel", text: msg }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
  }

  return { t, notFound, isAdmin, error, saving, persist, copyCode, sessionExpired, reauthenticate };
}
