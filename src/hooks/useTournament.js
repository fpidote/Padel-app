// src/hooks/useTournament.js
import { useState, useEffect, useRef } from "react";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

export function useTournament(code) {
  const [authUser, setAuthUser] = useState(null);
  const [t, setT] = useState(null);

  const isAdmin = !!(authUser?.uid && t?.ownerUid && authUser.uid === t.ownerUid);

  const verRef = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setAuthUser(user));
  }, []);

  // ── Firebase Realtime Listener ──────────────────────────────
  useEffect(() => {
    if (!code) return;
    verRef.current = null;
    setT(null);
    const unsub = onSnapshot(
      doc(db, "torneos", code),
      (snap) => {
        if (!snap.exists()) return;
        const data = JSON.parse(snap.data().data);
        if (!data || data.ver <= verRef.current) return;
        verRef.current = data.ver;
        setT(data);
      },
      (err) => console.error("Firebase listener:", err),
    );
    return () => unsub();
  }, [code]);

  // ── persist ─────────────────────────────────────────────────
  async function persist(newT) {
    try {
      newT.ver = (newT.ver || 0) + 1;
      verRef.current = newT.ver;
      setT(newT);
      await setDoc(doc(db, "torneos", codeRef.current), {
        data: JSON.stringify(newT),
      }, { merge: true });
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("No se pudieron guardar los cambios.");
    }
  }

  // ── copyCode ─────────────────────────────────────────────────
  function copyCode() {
    const link = `${window.location.origin}/torneo/${code}`;
    const msg = `🏆 ¡Seguí el torneo de pádel en tiempo real!\n\nPodés entrar directo haciendo clic en este link:\n${link}\n\nO ingresando el código: *${code}* en la web.`;

    if (navigator.share) {
      navigator.share({ title: "Torneo de Pádel", text: msg }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
  }

  return { t, isAdmin, persist, copyCode };
}
