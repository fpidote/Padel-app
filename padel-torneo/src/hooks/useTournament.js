// src/hooks/useTournament.js
import { useState, useEffect, useRef } from "react";
import { onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { genCode } from "../logic/utils";
import { TOURNAMENT_TYPES } from "../logic/constants";

export function useTournament() {
  const [screen, setScreen] = useState("home");
  const [code, setCode]     = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [t, setT]           = useState(null);
  const [joinVal, setJoinVal] = useState("");

  const verRef  = useRef(null);
  const codeRef = useRef(null);
  const tRef    = useRef(null);

  useEffect(() => { tRef.current  = t;    }, [t]);
  useEffect(() => { codeRef.current = code; }, [code]);

  // ── Firebase Realtime Listener ──────────────────────────────
  useEffect(() => {
    if (!code) return;
    const unsub = onSnapshot(
      doc(db, "torneos", code),
      (snap) => {
        if (!snap.exists()) return;
        const data = JSON.parse(snap.data().data);
        if (!data || data.ver <= verRef.current) return;
        verRef.current = data.ver;
        setT(data);
        setScreen(data.status === "setup" ? "setup" : "play");
      },
      (err) => console.error("Firebase listener:", err)
    );
    return () => unsub();
  }, [code]);

  // ── persist ─────────────────────────────────────────────────
  async function persist(newT) {
    try {
      newT.ver = (newT.ver || 0) + 1;
      verRef.current = newT.ver;
      setT(newT);
      setScreen(newT.status === "setup" ? "setup" : "play");
      await setDoc(doc(db, "torneos", codeRef.current), {
        data: JSON.stringify(newT),
      });
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("No se pudieron guardar los cambios.");
    }
  }

  // ── onCreate ─────────────────────────────────────────────────
  async function onCreate(type) {
    try {
      const c    = genCode();
      const base = {
        ver: 1,
        status: "setup",
        type,
        config: {
          name: `Torneo ${TOURNAMENT_TYPES.find((x) => x.id === type).name}`,
          courts: 2,
        },
      };

      const inits = {
        americano: {
          ...base,
          config: { ...base.config, courts: 3 },
          playerInputs: Array(12).fill(null).map((_, i) => ({
            name: `Jugador ${i + 1}`,
            level: i % 2 === 0 ? 1 : 2,
          })),
          players: [], rounds: [], currentRound: null,
          sittingOut: [], partnerHistory: {}, sitOutHistory: {},
          roundNum: 1,
        },
        relampago: {
          ...base,
          pairInputs: Array(8).fill(null).map((_, i) => ({
            id: i, p1: `Jugador ${i * 2 + 1}`, p2: `Jugador ${i * 2 + 2}`,
            pts: 0, gf: 0, gc: 0,
          })),
          bracket: null, phase: "setup",
        },
        mundialito: {
          ...base,
          config: { ...base.config, groupCount: 2, advancePerGroup: 2 },
          pairInputs: Array(8).fill(null).map((_, i) => ({
            id: i, p1: `Jugador ${i * 2 + 1}`, p2: `Jugador ${i * 2 + 2}`,
            pts: 0, gf: 0, gc: 0,
          })),
          groups: null, knockoutBracket: null, phase: "setup",
        },
        pozo: {
          ...base,
          pairInputs: Array(8).fill(null).map((_, i) => ({
            id: i, p1: `Jugador ${i * 2 + 1}`, p2: `Jugador ${i * 2 + 2}`,
            pts: 0, gf: 0, gc: 0, courtLevel: 0,
          })),
          pozoRounds: [], currentPozoRound: null, roundNum: 1,
          phase: "setup", timerSeconds: 600, timerRunning: false,
          timerStartedAt: null, timerElapsed: 0,
        },
      };

      const init = inits[type];
      await setDoc(doc(db, "torneos", c), { data: JSON.stringify(init) });
      localStorage.setItem(`admin_${c}`, "1");
      setCode(c);
      setIsAdmin(true);
      setT(init);
      setScreen("setup");
      verRef.current = 1;
    } catch (err) {
      console.error("Error al crear:", err);
      alert("Error al crear el torneo. Verificá Firebase.");
    }
  }

  // ── onJoin ───────────────────────────────────────────────────
  async function onJoin() {
    try {
      const c = joinVal.trim().toUpperCase();
      if (!c) return;
      const snap = await getDoc(doc(db, "torneos", c));
      if (!snap.exists()) { alert("Código no encontrado"); return; }
      const data  = JSON.parse(snap.data().data);
      const admin = !!localStorage.getItem(`admin_${c}`);
      setCode(c);
      setIsAdmin(admin);
      setT(data);
      verRef.current = data.ver;
      setScreen(data.status === "setup" ? "setup" : "play");
    } catch (err) {
      console.error("Error al unirse:", err);
      alert("Error de conexión con Firebase.");
    }
  }

  // ── copyCode ─────────────────────────────────────────────────
  function copyCode() {
    const msg = `Código del torneo: ${code}\n\nUsá este código en la app para seguirlo en tiempo real 🏓`;
    navigator.clipboard.writeText(msg)
      .catch(() => {})
      .finally(() => alert(`Código: ${code}\n\n¡Compartilo con todos!`));
  }

  return {
    screen, code, isAdmin, t, joinVal,
    setJoinVal, persist, onCreate, onJoin, copyCode,
  };
}
