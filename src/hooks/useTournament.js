// src/hooks/useTournament.js
import { useState, useEffect, useRef } from "react";
import { onSnapshot, doc, runTransaction } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../firebase";
import { buildShareMessage } from "../logic/utils";
import { showToast } from "../logic/toast";
import { createSaveQueue } from "../logic/saveQueue";
import { applyVersionedWrite } from "../logic/saveTransaction";

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
  const codeRef = useRef(code);
  codeRef.current = code;

  // Cola de guardado: escribe de uno en uno y sin descartar cambios (ver logic/saveQueue.js)
  const queueRef = useRef(null);
  if (!queueRef.current) {
    queueRef.current = createSaveQueue({
      // Transacción que comprueba la versión: si otro organizador guardó antes, no se pisa nada (onConflict)
      write: (state, baseVer) =>
        runTransaction(db, (tx) => applyVersionedWrite(tx, doc(db, "torneos", codeRef.current), state, baseVer)),
      onConflict: (serverState) => {
        verRef.current = serverState.ver ?? 0;
        setT(serverState);
        showToast("Otro organizador guardó a la vez; se cargó la versión más reciente. Repite tu cambio.");
      },
      onFailure: (lastSaved, err) => {
        console.error("Error al guardar:", err);
        // Los cambios pendientes partían del estado que falló: se vuelve al último guardado
        if (lastSaved) {
          verRef.current = lastSaved.ver;
          setT(lastSaved);
        }
        showToast("No se pudieron guardar los cambios. Revisa la conexión e inténtalo de nuevo.");
      },
    });
  }

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
    queueRef.current.confirm(null);
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
        queueRef.current.confirm(data);
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
  // La pantalla se actualiza al instante (estado optimista) y el guardado va por la cola: si se pide
  // otro cambio mientras se guarda, no se descarta, se guarda después con el estado más reciente.
  async function persist(newT) {
    // Sin red, setDoc no responde y dejaría el guardado colgado: se avisa y no se intenta a ciegas
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showToast("No se guardaron los cambios: sin conexión. Vuelve a intentarlo cuando se recupere.");
      return;
    }
    // Sin el estado del servidor aún cargado no hay versión sobre la que comprobar: no se guarda a ciegas
    if (!queueRef.current.lastSaved()) {
      showToast("El torneo todavía se está cargando. Inténtalo de nuevo en un momento.");
      return;
    }
    const updated = { ...newT, ver: Math.max(newT.ver || 0, verRef.current ?? 0) + 1, writeId: crypto.randomUUID() };
    verRef.current = updated.ver;
    setT(updated);
    setSaving(true);
    await queueRef.current.save(updated);
    setSaving(queueRef.current.isSaving());
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
