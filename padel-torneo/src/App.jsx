// 1. Dependencias del núcleo de React
import { useState, useEffect, useRef } from "react";

// 2. Componente de la pantalla de bienvenida
import Home from "./Home.jsx";

// 3. Constantes, estilos compartidos y utilidades de algoritmo
import { B, TOURNAMENT_TYPES } from "./logic/constants";
import { shuffle, pk, genCode } from "./logic/utils";

// 5. Motores de emparejamiento de los torneos
import {
  buildFirstRoundAmericano,
  buildRoundAmericano,
} from "./logic/americano";
import { buildBracket, advanceBracket } from "./logic/relampago";
import { buildGroups, buildKnockoutFromGroups } from "./logic/mundialito";
import { buildPozoRound } from "./logic/pozo";

// 6. Componentes visuales compartidos de la interfaz
import {
  THeader,
  Tabs,
  PTag,
  PName,
  PairName,
} from "./components/shared/Components";

// ── Firebase SDK ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const PROJECT = "app-padel-torneo";

const firebaseConfig = {
  apiKey: API_KEY,
  projectId: PROJECT,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── App ──────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [code, setCode] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [t, setT] = useState(null);
  const [joinVal, setJoinVal] = useState("");
  const verRef = useRef(null);
  const codeRef = useRef(null);
  const tRef = useRef(null);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Firebase Realtime Listener (onSnapshot)
  useEffect(() => {
    if (!code) return;
    const unsubscribe = onSnapshot(
      doc(db, "torneos", code),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = JSON.parse(docSnap.data().data);
        if (!data || data.ver <= verRef.current) return;
        verRef.current = data.ver;
        setT(data);
        setScreen(data.status === "setup" ? "setup" : "play");
      },
      (error) => {
        console.error("Error en Firebase Listener:", error);
      },
    );
    return () => unsubscribe();
  }, [code]);

  async function persist(newT) {
    newT.ver = (newT.ver || 0) + 1;
    verRef.current = newT.ver;
    setT(newT);
    await setDoc(doc(db, "torneos", codeRef.current), {
      data: JSON.stringify(newT),
    });
  }

  async function onCreate(type) {
    const c = genCode();
    const base = {
      ver: 1,
      status: "setup",
      type,
      config: {
        name: `Torneo ${TOURNAMENT_TYPES.find((x) => x.id === type).name}`,
        courts: 2,
      },
    };
    let init = { ...base };
    if (type === "americano") {
      init = {
        ...init,
        config: { ...init.config, courts: 3 },
        playerInputs: Array(12)
          .fill(null)
          .map((_, i) => ({
            name: `Jugador ${i + 1}`,
            level: i % 2 === 0 ? 1 : 2,
          })),
        players: [],
        rounds: [],
        currentRound: null,
        sittingOut: [],
        partnerHistory: {},
        sitOutHistory: {},
        roundNum: 1,
      };
    } else if (type === "relampago") {
      init = {
        ...init,
        pairInputs: Array(8)
          .fill(null)
          .map((_, i) => ({
            id: i,
            p1: `Jugador ${i * 2 + 1}`,
            p2: `Jugador ${i * 2 + 2}`,
            pts: 0,
            gf: 0,
            gc: 0,
          })),
        bracket: null,
        phase: "setup",
      };
    } else if (type === "mundialito") {
      init = {
        ...init,
        config: { ...init.config, groupCount: 2, advancePerGroup: 2 },
        pairInputs: Array(8)
          .fill(null)
          .map((_, i) => ({
            id: i,
            p1: `Jugador ${i * 2 + 1}`,
            p2: `Jugador ${i * 2 + 2}`,
            pts: 0,
            gf: 0,
            gc: 0,
          })),
        groups: null,
        knockoutBracket: null,
        phase: "setup",
      };
    } else if (type === "pozo") {
      init = {
        ...init,
        pairInputs: Array(8)
          .fill(null)
          .map((_, i) => ({
            id: i,
            p1: `Jugador ${i * 2 + 1}`,
            p2: `Jugador ${i * 2 + 2}`,
            pts: 0,
            gf: 0,
            gc: 0,
            courtLevel: 0,
          })),
        pozoRounds: [],
        currentPozoRound: null,
        roundNum: 1,
        phase: "setup",
        timerSeconds: 600,
        timerRunning: false,
        timerStartedAt: null,
        timerElapsed: 0,
      };
    }
    await setDoc(doc(db, "torneos", c), { data: JSON.stringify(init) });
    localStorage.setItem(`admin_${c}`, "1");
    setCode(c);
    setIsAdmin(true);
    setT(init);
    setScreen("setup");
    verRef.current = 1;
  }

  async function onJoin() {
    const c = joinVal.trim().toUpperCase();
    if (!c) return;
    const docSnap = await getDoc(doc(db, "torneos", c));
    if (!docSnap.exists()) {
      alert("Código no encontrado");
      return;
    }
    const admin = !!localStorage.getItem(`admin_${c}`);
    const data = JSON.parse(docSnap.data().data);
    setCode(c);
    setIsAdmin(admin);
    setT(data);
    verRef.current = data.ver;
    setScreen(data.status === "setup" ? "setup" : "play");
  }

  function copyCode() {
    const msg = `Código del torneo: ${code}\n\nUsá este código en la app para seguirlo en tiempo real 🏓`;
    navigator.clipboard
      .writeText(msg)
      .catch(() => {})
      .finally(() => alert(`Código: ${code}\n\n¡Compartilo con todos!`));
  }

  if (screen === "home")
    return (
      <Home
        joinVal={joinVal}
        setJoinVal={setJoinVal}
        onCreate={onCreate}
        onJoin={onJoin}
      />
    );
  if (!t)
    return (
      <div
        style={{
          color: "#64748b",
          textAlign: "center",
          marginTop: 80,
          fontFamily: "system-ui",
        }}
      >
        Cargando...
      </div>
    );

  const typeInfo =
    TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];

  if (screen === "setup") {
    if (t.type === "americano")
      return (
        <SetupAmericano
          t={t}
          code={code}
          isAdmin={isAdmin}
          persist={persist}
          copyCode={copyCode}
        />
      );
    return (
      <SetupPairs
        t={t}
        code={code}
        isAdmin={isAdmin}
        persist={persist}
        copyCode={copyCode}
        typeInfo={typeInfo}
      />
    );
  }

  // Play screens
  if (t.type === "americano")
    return (
      <PlayAmericano
        t={t}
        code={code}
        isAdmin={isAdmin}
        persist={persist}
        copyCode={copyCode}
      />
    );
  if (t.type === "relampago")
    return (
      <PlayRelampago
        t={t}
        code={code}
        isAdmin={isAdmin}
        persist={persist}
        copyCode={copyCode}
      />
    );
  if (t.type === "mundialito")
    return (
      <PlayMundialito
        t={t}
        code={code}
        isAdmin={isAdmin}
        persist={persist}
        copyCode={copyCode}
      />
    );
  if (t.type === "pozo")
    return (
      <PlayPozo
        t={t}
        code={code}
        isAdmin={isAdmin}
        persist={persist}
        copyCode={copyCode}
      />
    );
  return null;
}

// ── Setup Americano ──────────────────────────────────────────
function SetupAmericano({ t, code, isAdmin, persist, copyCode }) {
  const [newName, setNewName] = useState("");
  const [newLvl, setNewLvl] = useState(1);
  const deb = useRef(null);
  const ds = (nt) => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => persist(nt), 700);
  };
  const act = t.config.courts * 4,
    tot = t.playerInputs.length;
  const sit = tot > act ? tot - act : 0,
    need = tot < act ? act - tot : 0;
  const sc = sit > 0 ? "#fbbf24" : need > 0 ? "#f87171" : "#4ade80";
  const sm =
    `${tot} jugadores · ${t.config.courts} pistas · ${act} juegan` +
    (sit > 0
      ? ` · ⏳ ${sit} descansan`
      : need > 0
        ? ` · ⚠️ faltan ${need}`
        : " · ✓");
  const ok = tot >= 4 && t.playerInputs.every((p) => p.name.trim().length > 0);
  const n1 = t.playerInputs.filter((p) => p.level === 1).length;
  const n2 = t.playerInputs.filter((p) => p.level === 2).length;
  const inp = {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 10,
    color: "#f1f5f9",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  };

  async function onStart() {
    const ps = t.playerInputs.map((p, i) => ({
      id: i,
      name: p.name.trim(),
      level: p.level,
      pts: 0,
      gf: 0,
      gc: 0,
    }));
    const { courts, sittingOut } = buildFirstRoundAmericano(
      ps,
      t.config.courts,
    );
    await persist({
      ...t,
      players: ps,
      currentRound: courts,
      sittingOut,
      status: "playing",
      roundNum: 1,
      rounds: [],
      partnerHistory: {},
      sitOutHistory: {},
    });
  }

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8" }}>
              🔄 Americano — Configuración
            </h1>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Código:{" "}
              <b style={{ color: "#fbbf24", fontSize: 15, letterSpacing: 3 }}>
                {code}
              </b>
            </div>
          </div>
          <button
            onClick={copyCode}
            style={B("#1e293b", {
              border: "1px solid #334155",
              color: "#94a3b8",
              fontSize: 12,
            })}
          >
            📤 Compartir
          </button>
        </div>

        {isAdmin ? (
          <>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Nombre del torneo
            </label>
            <input
              value={t.config.name}
              onChange={(e) =>
                ds({ ...t, config: { ...t.config, name: e.target.value } })
              }
              style={{ ...inp, marginBottom: 12 }}
            />
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Número de pistas
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    persist({ ...t, config: { ...t.config, courts: n } })
                  }
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 16,
                    background: t.config.courts === n ? "#0284c7" : "#1e293b",
                    color: t.config.courts === n ? "#fff" : "#94a3b8",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div
            style={{
              background: "#1e293b",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t.config.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {t.config.courts} pistas · Esperando al admin...
            </div>
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            marginBottom: 12,
            padding: "8px 12px",
            background: "#1e293b",
            borderRadius: 8,
            color: sc,
          }}
        >
          {sm}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Jugadores ({tot}) ·{" "}
          <span style={{ color: "#38bdf8" }}>● N1: {n1}</span> &nbsp;
          <span style={{ color: "#4ade80" }}>● N2: {n2}</span>
        </div>
        <div
          style={{
            background: "#1e293b",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 10,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <b style={{ color: "#38bdf8" }}>N1</b> Con experiencia &nbsp;·&nbsp;{" "}
          <b style={{ color: "#4ade80" }}>N2</b> Poco rodaje
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 10 }}>
          {t.playerInputs.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 6,
                alignItems: "center",
              }}
            >
              <button
                onClick={() => {
                  if (!isAdmin) return;
                  const pi = [...t.playerInputs];
                  pi[i] = { ...pi[i], level: pi[i].level === 1 ? 2 : 1 };
                  persist({ ...t, playerInputs: pi });
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  cursor: isAdmin ? "pointer" : "default",
                  fontWeight: 800,
                  fontSize: 13,
                  background: p.level === 1 ? "#0284c7" : "#16a34a",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                N{p.level}
              </button>
              <input
                value={p.name}
                disabled={!isAdmin}
                onChange={(e) => {
                  const pi = [...t.playerInputs];
                  pi[i] = { ...pi[i], name: e.target.value };
                  ds({ ...t, playerInputs: pi });
                }}
                style={{
                  ...inp,
                  flex: 1,
                  opacity: isAdmin ? 1 : 0.7,
                  padding: "8px 12px",
                }}
              />
              {isAdmin && (
                <button
                  onClick={() =>
                    persist({
                      ...t,
                      playerInputs: t.playerInputs.filter(
                        (_, idx) => idx !== i,
                      ),
                    })
                  }
                  style={B("#dc2626", {
                    padding: "6px 10px",
                    fontSize: 12,
                    flexShrink: 0,
                  })}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setNewLvl((l) => (l === 1 ? 2 : 1))}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                  background: newLvl === 1 ? "#0284c7" : "#16a34a",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                N{newLvl}
              </button>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    persist({
                      ...t,
                      playerInputs: [
                        ...t.playerInputs,
                        {
                          name:
                            newName.trim() ||
                            `Jugador ${t.playerInputs.length + 1}`,
                          level: newLvl,
                        },
                      ],
                    });
                    setNewName("");
                  }
                }}
                placeholder="Nombre del jugador..."
                style={{ ...inp, flex: 1, padding: "8px 12px" }}
              />
              <button
                onClick={() => {
                  persist({
                    ...t,
                    playerInputs: [
                      ...t.playerInputs,
                      {
                        name:
                          newName.trim() ||
                          `Jugador ${t.playerInputs.length + 1}`,
                        level: newLvl,
                      },
                    ],
                  });
                  setNewName("");
                }}
                style={B("#475569")}
              >
                +
              </button>
            </div>
            <button
              onClick={onStart}
              disabled={!ok}
              style={B(ok ? "#0284c7" : "#334155", {
                width: "100%",
                padding: 16,
                fontSize: 17,
                borderRadius: 14,
                opacity: ok ? 1 : 0.4,
                cursor: ok ? "pointer" : "not-allowed",
              })}
            >
              🎾 Iniciar Torneo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Setup Pairs (Relámpago / Mundialito / Pozo) ───────────────
function SetupPairs({ t, code, isAdmin, persist, copyCode, typeInfo }) {
  const [newP1, setNewP1] = useState("");
  const [newP2, setNewP2] = useState("");
  const deb = useRef(null);
  const ds = (nt) => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => persist(nt), 600);
  };
  const pairs = t.pairInputs || [];
  const ok =
    pairs.length >= 2 && pairs.every((p) => p.p1.trim() && p.p2.trim());
  const inp = {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "8px 10px",
    fontSize: 13,
    outline: "none",
  };

  async function onStart() {
    const pairs = t.pairInputs.map((p, i) => ({
      ...p,
      id: i,
      pts: 0,
      gf: 0,
      gc: 0,
    }));
    if (t.type === "relampago") {
      const bracket = buildBracket(pairs);
      await persist({
        ...t,
        bracket,
        pairs,
        phase: "bracket",
        status: "playing",
      });
    } else if (t.type === "mundialito") {
      const groups = buildGroups(pairs, t.config.groupCount || 2);
      await persist({
        ...t,
        groups,
        pairs,
        phase: "groups",
        status: "playing",
      });
    } else if (t.type === "pozo") {
      const sorted = shuffle(pairs);
      const courtAssign = buildPozoRound(
        sorted.map((p, i) => ({ ...p, courtLevel: i })),
        t.config.courts,
      );
      await persist({
        ...t,
        pairs: sorted.map((p, i) => ({ ...p, courtLevel: i })),
        currentPozoRound: courtAssign,
        pozoRounds: [],
        roundNum: 1,
        phase: "playing",
        status: "playing",
        timerRunning: false,
        timerElapsed: 0,
        timerStartedAt: null,
      });
    }
  }

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8" }}>
              {typeInfo.icon} {typeInfo.name} — Configuración
            </h1>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Código:{" "}
              <b style={{ color: "#fbbf24", fontSize: 15, letterSpacing: 3 }}>
                {code}
              </b>
            </div>
          </div>
          <button
            onClick={copyCode}
            style={B("#1e293b", {
              border: "1px solid #334155",
              color: "#94a3b8",
              fontSize: 12,
            })}
          >
            📤 Compartir
          </button>
        </div>

        {isAdmin && (
          <>
            <label
              style={{
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Nombre del torneo
            </label>
            <input
              value={t.config.name}
              onChange={(e) =>
                ds({ ...t, config: { ...t.config, name: e.target.value } })
              }
              style={{ ...inp, width: "100%", marginBottom: 12 }}
            />
            <label
              style={{
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Número de pistas
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    persist({ ...t, config: { ...t.config, courts: n } })
                  }
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 16,
                    background:
                      t.config.courts === n ? typeInfo.color : "#1e293b",
                    color: t.config.courts === n ? "#fff" : "#94a3b8",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            {t.type === "mundialito" && (
              <>
                <label
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Número de grupos
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        persist({
                          ...t,
                          config: { ...t.config, groupCount: n },
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 16,
                        background:
                          t.config.groupCount === n
                            ? typeInfo.color
                            : "#1e293b",
                        color: t.config.groupCount === n ? "#fff" : "#94a3b8",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Parejas que avanzan por grupo
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        persist({
                          ...t,
                          config: { ...t.config, advancePerGroup: n },
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 16,
                        background:
                          t.config.advancePerGroup === n
                            ? typeInfo.color
                            : "#1e293b",
                        color:
                          t.config.advancePerGroup === n ? "#fff" : "#94a3b8",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
            {t.type === "pozo" && (
              <>
                <label
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Duración de ronda (minutos)
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        persist({
                          ...t,
                          timerSeconds: n * 60,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                        background:
                          t.timerSeconds === n * 60
                            ? typeInfo.color
                            : "#1e293b",
                        color: t.timerSeconds === n * 60 ? "#fff" : "#94a3b8",
                      }}
                    >
                      {n}m
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Parejas ({pairs.length})
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
          {pairs.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 6,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <input
                value={p.p1}
                disabled={!isAdmin}
                onChange={(e) => {
                  const pi = [...t.pairInputs];
                  pi[i] = { ...pi[i], p1: e.target.value };
                  ds({ ...t, pairInputs: pi });
                }}
                placeholder="Jugador 1"
                style={{ ...inp, flex: 1 }}
              />
              <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>
                /
              </span>
              <input
                value={p.p2}
                disabled={!isAdmin}
                onChange={(e) => {
                  const pi = [...t.pairInputs];
                  pi[i] = { ...pi[i], p2: e.target.value };
                  ds({ ...t, pairInputs: pi });
                }}
                placeholder="Jugador 2"
                style={{ ...inp, flex: 1 }}
              />
              {isAdmin && (
                <button
                  onClick={() =>
                    persist({
                      ...t,
                      pairInputs: t.pairInputs.filter((_, idx) => idx !== i),
                    })
                  }
                  style={B("#dc2626", {
                    padding: "4px 8px",
                    fontSize: 11,
                    flexShrink: 0,
                  })}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={newP1}
                onChange={(e) => setNewP1(e.target.value)}
                placeholder="Jugador 1"
                style={{ ...inp, flex: 1 }}
              />
              <span
                style={{
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  alignSelf: "center",
                }}
              >
                /
              </span>
              <input
                value={newP2}
                onChange={(e) => setNewP2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    persist({
                      ...t,
                      pairInputs: [
                        ...t.pairInputs,
                        {
                          id: t.pairInputs.length,
                          p1:
                            newP1.trim() ||
                            `Jugador ${t.pairInputs.length * 2 + 1}`,
                          p2:
                            newP2.trim() ||
                            `Jugador ${t.pairInputs.length * 2 + 2}`,
                          pts: 0,
                          gf: 0,
                          gc: 0,
                        },
                      ],
                    });
                    setNewP1("");
                    setNewP2("");
                  }
                }}
                placeholder="Jugador 2"
                style={{ ...inp, flex: 1 }}
              />
              <button
                onClick={() => {
                  persist({
                    ...t,
                    pairInputs: [
                      ...t.pairInputs,
                      {
                        id: t.pairInputs.length,
                        p1:
                          newP1.trim() ||
                          `Jugador ${t.pairInputs.length * 2 + 1}`,
                        p2:
                          newP2.trim() ||
                          `Jugador ${t.pairInputs.length * 2 + 2}`,
                        pts: 0,
                        gf: 0,
                        gc: 0,
                      },
                    ],
                  });
                  setNewP1("");
                  setNewP2("");
                }}
                style={B("#475569")}
              >
                +
              </button>
            </div>
            <button
              onClick={onStart}
              disabled={!ok}
              style={B(ok ? typeInfo.color : "#334155", {
                width: "100%",
                padding: 16,
                fontSize: 17,
                borderRadius: 14,
                opacity: ok ? 1 : 0.4,
                cursor: ok ? "pointer" : "not-allowed",
              })}
            >
              🎾 Iniciar Torneo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Play Americano ───────────────────────────────────────────
function PlayAmericano({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});

  async function onSave(ci) {
    const court = t.currentRound[ci];
    const a = parseInt(ls[`${ci}_A`] ?? court.scoreA);
    const b = parseInt(ls[`${ci}_B`] ?? court.scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const cr = t.currentRound.map((c, i) =>
      i === ci
        ? { ...c, scoreA: String(a), scoreB: String(b), saved: true }
        : c,
    );
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
    await persist({ ...t, currentRound: cr });
  }

  async function onNext() {
    if (!t.currentRound.every((c) => c.saved)) return;
    let np = t.players.map((p) => ({ ...p }));
    const nh = { ...t.partnerHistory };
    const nso = { ...t.sitOutHistory };
    t.sittingOut.forEach((p) => {
      nso[p.id] = (nso[p.id] || 0) + 1;
    });
    t.currentRound.forEach((court) => {
      const a = parseInt(court.scoreA),
        b = parseInt(court.scoreB);
      [court.pairA, court.pairB].forEach((pair, pi) => {
        nh[pk(pair[0].id, pair[1].id)] =
          (nh[pk(pair[0].id, pair[1].id)] || 0) + 1;
        const won = pi === 0 ? a > b : b > a;
        pair.forEach(({ id }) => {
          const p = np.find((x) => x.id === id);
          p.pts += won ? 1 : 0;
          p.gf += pi === 0 ? a : b;
          p.gc += pi === 0 ? b : a;
        });
      });
    });
    const { courts: nc, sittingOut: nSit } = buildRoundAmericano(
      np,
      t.config.courts,
      nh,
      nso,
    );
    const newRounds = [
      ...t.rounds,
      { num: t.roundNum, courts: t.currentRound, sittingOut: t.sittingOut },
    ];
    setLs({});
    await persist({
      ...t,
      players: np,
      rounds: newRounds,
      currentRound: nc,
      sittingOut: nSit,
      partnerHistory: nh,
      sitOutHistory: nso,
      roundNum: t.roundNum + 1,
    });
  }

  const standings = [...t.players].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  const allSaved = t.currentRound?.every((c) => c.saved);

  return (
    <div
      style={{
        fontFamily: "system-ui,sans-serif",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
      }}
    >
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`Ronda ${t.roundNum} · ${t.config.courts} pistas · ${t.players.length} jug.`}
      />
      <Tabs
        tabs={[
          ["courts", "🎮 Ronda"],
          ["standings", "📊 Tabla"],
          ["history", "📜 Historial"],
        ]}
        active={tab}
        setActive={setTab}
      />
      <div style={{ padding: "14px 12px", maxWidth: 680, margin: "0 auto" }}>
        {tab === "courts" && (
          <CourtsAmericano
            t={t}
            isAdmin={isAdmin}
            ls={ls}
            setLs={setLs}
            allSaved={allSaved}
            onSave={onSave}
            onNext={onNext}
          />
        )}
        {tab === "standings" && (
          <StandingsAmericano rows={standings} roundNum={t.roundNum} />
        )}
        {tab === "history" && <History rounds={t.rounds} />}
      </div>
    </div>
  );
}

function CourtsAmericano({ t, isAdmin, ls, setLs, allSaved, onSave, onNext }) {
  return (
    <>
      {t.sittingOut?.length > 0 && (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>
            ⏳ Descansan:{" "}
          </span>
          <span style={{ color: "#cbd5e1" }}>
            {t.sittingOut.map((p) => p.name).join(", ")}
          </span>
        </div>
      )}
      {(t.currentRound || []).map((court, ci) => {
        const sA = ls[`${ci}_A`] ?? court.scoreA;
        const sB = ls[`${ci}_B`] ?? court.scoreB;
        const a = parseInt(sA),
          b = parseInt(sB);
        const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
        const isTie = !isNaN(a) && !isNaN(b) && a === b;
        const iStyle = (hi) => ({
          width: 52,
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          background: "#0f172a",
          border: `2px solid ${hi ? "#4ade80" : "#334155"}`,
          borderRadius: 8,
          color: "#f1f5f9",
          padding: "6px 0",
        });
        return (
          <div
            key={ci}
            style={{
              background: court.saved ? "#052e1633" : "#1e293b",
              border: `1px solid ${court.saved ? "#16a34a" : "#334155"}`,
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8" }}>
                Pista {ci + 1}
                {ci === 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      background: "#0284c722",
                      color: "#38bdf8",
                      padding: "2px 6px",
                      borderRadius: 99,
                    }}
                  >
                    ⬆ Principal
                  </span>
                )}
                {ci === t.config.courts - 1 && t.config.courts > 1 && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      background: "#dc262622",
                      color: "#f87171",
                      padding: "2px 6px",
                      borderRadius: 99,
                    }}
                  >
                    ⬇ Auxiliar
                  </span>
                )}
              </div>
              {court.saved && (
                <span style={{ color: "#4ade80", fontSize: 12 }}>
                  ✅ Guardado
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}
                >
                  Pareja A
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24" }}
                >
                  <PName pair={court.pairA} />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                {isAdmin && !court.saved ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      value={sA}
                      onChange={(e) =>
                        setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))
                      }
                      style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
                    />
                    <span
                      style={{
                        color: "#64748b",
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      –
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={sB}
                      onChange={(e) =>
                        setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))
                      }
                      style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
                    />
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#f1f5f9",
                      padding: "0 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {court.scoreA || "–"}–{court.scoreB || "–"}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                <div
                  style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}
                >
                  Pareja B
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24" }}
                >
                  <PName pair={court.pairB} />
                </div>
              </div>
            </div>
            {isTie && !court.saved && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  textAlign: "center",
                  color: "#f59e0b",
                  background: "#451a0322",
                  padding: 6,
                  borderRadius: 8,
                }}
              >
                ⚡ Empate — definir a punto de oro
              </div>
            )}
            {valid && !court.saved && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  textAlign: "center",
                  color: "#4ade80",
                }}
              >
                ✓ Ganan <PName pair={a > b ? court.pairA : court.pairB} />
              </div>
            )}
            {isAdmin && !court.saved && (
              <button
                onClick={() => onSave(ci)}
                disabled={!valid}
                style={B(valid ? "#0284c7" : "#334155", {
                  width: "100%",
                  marginTop: 10,
                  borderRadius: 8,
                  padding: 10,
                  opacity: valid ? 1 : 0.5,
                  cursor: valid ? "pointer" : "not-allowed",
                })}
              >
                Guardar resultado
              </button>
            )}
          </div>
        );
      })}
      {allSaved && isAdmin && (
        <button
          onClick={onNext}
          style={B("#16a34a", {
            width: "100%",
            padding: 14,
            fontSize: 16,
            borderRadius: 12,
            marginTop: 4,
          })}
        >
          ➡️ Siguiente Ronda
        </button>
      )}
      {!isAdmin && !allSaved && (
        <div
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          👁 Modo vista — actualizando cada 3s
        </div>
      )}
    </>
  );
}

function StandingsAmericano({ rows, roundNum }) {
  return (
    <>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        🏆 Tabla — Ronda {roundNum}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        1° Puntos · 2° Diferencia de games
      </div>
      {rows.map((p, i) => {
        const d = p.gf - p.gc;
        const m = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#1e293b",
              border: `1px solid ${
                i === 0
                  ? "#f59e0b55"
                  : i === 1
                    ? "#94a3b855"
                    : i === 2
                      ? "#92400e55"
                      : "#334155"
              }`,
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 28,
                textAlign: "center",
                fontSize: m ? 20 : 14,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              {m || i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {p.name}
                <PTag p={p} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                GF {p.gf} · GC {p.gc} · Dif {d >= 0 ? "+" : ""}
                {d}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#38bdf8",
                  lineHeight: 1,
                }}
              >
                {p.pts}
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>pts</div>
            </div>
          </div>
        );
      })}
      <div
        style={{
          background: "#1e293b",
          borderRadius: 10,
          padding: 12,
          marginTop: 8,
          fontSize: 12,
        }}
      >
        <div style={{ color: "#64748b", marginBottom: 4 }}>
          Sistema · Sin empate (punto de oro)
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <span>
            🟢 Victoria: <b style={{ color: "#4ade80" }}>1 pt</b>
          </span>
          <span>
            🔴 Derrota: <b style={{ color: "#f87171" }}>0 pts</b>
          </span>
        </div>
      </div>
    </>
  );
}

function History({ rounds }) {
  if (!rounds?.length)
    return (
      <div style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>
        Aún no hay rondas completadas.
      </div>
    );
  return (
    <>
      {[...rounds].reverse().map((r) => (
        <div
          key={r.num}
          style={{
            background: "#1e293b",
            borderRadius: 10,
            marginBottom: 10,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>
            Ronda {r.num}
          </div>
          {r.courts.map((c, i) => {
            const a = parseInt(c.scoreA),
              b = parseInt(c.scoreB),
              aw = a > b;
            return (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  color: "#cbd5e1",
                  marginBottom: 6,
                  padding: "6px 10px",
                  background: "#0f172a",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Pista {i + 1} ·{" "}
                </span>
                <span style={{ color: aw ? "#4ade80" : "#94a3b8" }}>
                  {c.pairA.map((p) => p.name).join(" & ")}
                </span>
                <span
                  style={{
                    fontWeight: 900,
                    color: "#f1f5f9",
                    margin: "0 6px",
                  }}
                >
                  {c.scoreA}–{c.scoreB}
                </span>
                <span style={{ color: !aw ? "#4ade80" : "#94a3b8" }}>
                  {c.pairB.map((p) => p.name).join(" & ")}
                </span>
              </div>
            );
          })}
          {r.sittingOut?.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              ⏳ Descansaron: {r.sittingOut.map((p) => p.name).join(", ")}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Play Relámpago ───────────────────────────────────────────
function PlayRelampago({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("bracket");
  const [ls, setLs] = useState({});

  async function onSaveMatch(matchId) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    const a = parseInt(ls[`${matchId}_A`] ?? "");
    const b = parseInt(ls[`${matchId}_B`] ?? "");
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = advanceBracket(t.bracket, matchId, a, b);
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    // Update pair stats
    const pairs = [...t.pairs];
    const wPair = a > b ? match.pairA : match.pairB;
    const lPair = a > b ? match.pairB : match.pairA;
    [wPair, lPair].forEach((pair, pi) => {
      if (!pair) return;
      const idx = pairs.findIndex((p) => p.id === pair.id);
      if (idx < 0) return;
      pairs[idx] = {
        ...pairs[idx],
        pts: pairs[idx].pts + (pi === 0 ? 1 : 0),
        gf: pairs[idx].gf + (pi === 0 ? a : b),
        gc: pairs[idx].gc + (pi === 0 ? b : a),
      };
    });
    await persist({ ...t, bracket: updated, pairs });
  }

  const winnerRounds = [
    ...new Set(
      t.bracket.filter((m) => m.bracket === "winners").map((m) => m.round),
    ),
  ].sort((a, b) => a - b);
  const consolRounds = [
    ...new Set(
      t.bracket.filter((m) => m.bracket === "consolation").map((m) => m.round),
    ),
  ].sort((a, b) => a - b);

  const champion = t.bracket.find(
    (m) => m.bracket === "winners" && !m.nextMatchId && m.saved,
  )?.winner;
  const consolChampion = t.bracket.find(
    (m) => m.bracket === "consolation" && !m.nextMatchId && m.saved,
  )?.winner;

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
      }}
    >
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`⚡ Eliminación directa · ${t.pairs?.length} parejas`}
      />
      <Tabs
        tabs={[
          ["bracket", "🏆 Cuadro"],
          ["consolation", "🥈 Consolación"],
          ["standings", "📊 Tabla"],
        ]}
        active={tab}
        setActive={setTab}
      />
      <div style={{ padding: "14px 12px", maxWidth: 680, margin: "0 auto" }}>
        {tab === "bracket" && (
          <>
            {champion && (
              <div
                style={{
                  background: "linear-gradient(135deg,#92400e,#d97706)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32 }}>🏆</div>
                <div
                  style={{ fontWeight: 900, fontSize: 18, color: "#fef3c7" }}
                >
                  ¡Campeón!
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    marginTop: 4,
                  }}
                >
                  {champion.p1} / {champion.p2}
                </div>
              </div>
            )}
            {winnerRounds.map((round) => (
              <div key={round}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#7c3aed",
                    marginBottom: 8,
                    marginTop: 4,
                  }}
                >
                  {round === Math.max(...winnerRounds)
                    ? "🏆 Final"
                    : `Ronda ${round}`}
                </div>
                {t.bracket
                  .filter((m) => m.bracket === "winners" && m.round === round)
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={() => onSaveMatch(match.id)}
                      accentColor="#7c3aed"
                    />
                  ))}
              </div>
            ))}
          </>
        )}
        {tab === "consolation" && (
          <>
            {consolChampion && (
              <div
                style={{
                  background: "linear-gradient(135deg,#1e3a5f,#0284c7)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32 }}>🥈</div>
                <div
                  style={{ fontWeight: 900, fontSize: 18, color: "#bfdbfe" }}
                >
                  Campeón Consolación
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    marginTop: 4,
                  }}
                >
                  {consolChampion.p1} / {consolChampion.p2}
                </div>
              </div>
            )}
            {consolRounds.length === 0 && (
              <div
                style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}
              >
                El cuadro de consolación se activa cuando hay primeras rondas
                jugadas.
              </div>
            )}
            {consolRounds.map((round) => (
              <div key={round}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0284c7",
                    marginBottom: 8,
                    marginTop: 4,
                  }}
                >
                  {round === Math.max(...consolRounds, 0)
                    ? "🥈 Final Consolación"
                    : `Consolación Ronda ${round}`}
                </div>
                {t.bracket
                  .filter(
                    (m) => m.bracket === "consolation" && m.round === round,
                  )
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={() => onSaveMatch(match.id)}
                      accentColor="#0284c7"
                    />
                  ))}
              </div>
            ))}
          </>
        )}
        {tab === "standings" && (
          <PairStandings pairs={t.pairs || []} title="Tabla Relámpago" />
        )}
      </div>
    </div>
  );
}

// ── Match Card (shared for bracket matches) ───────────────────
function MatchCard({
  match,
  isAdmin,
  ls,
  setLs,
  onSave,
  accentColor = "#7c3aed",
}) {
  const sA = ls[`${match.id}_A`] ?? (match.scoreA || "");
  const sB = ls[`${match.id}_B`] ?? (match.scoreB || "");
  const a = parseInt(sA),
    b = parseInt(sB);
  const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
  const isTie = !isNaN(a) && !isNaN(b) && a === b;
  const iStyle = (hi) => ({
    width: 48,
    textAlign: "center",
    fontSize: 20,
    fontWeight: 900,
    background: "#0f172a",
    border: `2px solid ${hi ? "#4ade80" : "#334155"}`,
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "5px 0",
  });

  if (!match.pairA && !match.pairB) return null;

  return (
    <div
      style={{
        background: match.saved ? "#052e1633" : "#1e293b",
        border: `1px solid ${match.saved ? "#16a34a" : accentColor + "44"}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {match.bracket === "winners"
            ? "⚡ Cuadro Principal"
            : "🥈 Consolación"}
        </div>
        {match.saved && (
          <span style={{ color: "#4ade80", fontSize: 11 }}>✅ Guardado</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color:
                match.saved && match.winner?.id === match.pairA?.id
                  ? "#4ade80"
                  : "#fbbf24",
            }}
          >
            {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD"}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {isAdmin && !match.saved && match.pairA && match.pairB ? (
            <>
              <input
                type="number"
                min="0"
                value={sA}
                onChange={(e) =>
                  setLs((p) => ({
                    ...p,
                    [`${match.id}_A`]: e.target.value,
                  }))
                }
                style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
              />
              <span style={{ color: "#64748b", fontWeight: 900 }}>–</span>
              <input
                type="number"
                min="0"
                value={sB}
                onChange={(e) =>
                  setLs((p) => ({
                    ...p,
                    [`${match.id}_B`]: e.target.value,
                  }))
                }
                style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
              />
            </>
          ) : (
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#f1f5f9",
                padding: "0 4px",
              }}
            >
              {match.saved ? `${match.scoreA}–${match.scoreB}` : "vs"}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color:
                match.saved && match.winner?.id === match.pairB?.id
                  ? "#4ade80"
                  : "#fbbf24",
            }}
          >
            {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD"}
          </div>
        </div>
      </div>
      {isTie && !match.saved && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            textAlign: "center",
            color: "#f59e0b",
          }}
        >
          ⚡ Empate — punto de oro
        </div>
      )}
      {valid && !match.saved && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            textAlign: "center",
            color: "#4ade80",
          }}
        >
          ✓ Gana{" "}
          {a > b
            ? `${match.pairA?.p1} / ${match.pairA?.p2}`
            : `${match.pairB?.p1} / ${match.pairB?.p2}`}
        </div>
      )}
      {isAdmin && !match.saved && match.pairA && match.pairB && (
        <button
          onClick={onSave}
          disabled={!valid}
          style={B(valid ? accentColor : "#334155", {
            width: "100%",
            marginTop: 8,
            borderRadius: 8,
            padding: 8,
            opacity: valid ? 1 : 0.5,
            cursor: valid ? "pointer" : "not-allowed",
          })}
        >
          Guardar resultado
        </button>
      )}
    </div>
  );
}

// ── Pair Standings (shared) ────────────────────────────────────
function PairStandings({ pairs, title, extra }) {
  const sorted = [...pairs].sort((a, b) =>
    b.pts !== a.pts
      ? b.pts - a.pts
      : b.gf - b.gc !== a.gf - a.gc
        ? b.gf - b.gc - (a.gf - a.gc)
        : 0,
  );
  return (
    <>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        🏆 {title}
      </div>
      {extra}
      {sorted.map((p, i) => {
        const d = p.gf - p.gc;
        const m = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#1e293b",
              border: `1px solid ${
                i === 0
                  ? "#f59e0b55"
                  : i === 1
                    ? "#94a3b855"
                    : i === 2
                      ? "#92400e55"
                      : "#334155"
              }`,
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 28,
                textAlign: "center",
                fontSize: m ? 18 : 13,
                fontWeight: 700,
                color: "#64748b",
              }}
            >
              {m || i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {p.p1} / {p.p2}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                GF {p.gf} · GC {p.gc} · Dif {d >= 0 ? "+" : ""}
                {d}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#38bdf8",
                  lineHeight: 1,
                }}
              >
                {p.pts}
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>pts</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Play Mundialito ──────────────────────────────────────────
function PlayMundialito({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("groups");
  const [ls, setLs] = useState({});

  async function onSaveGroupMatch(groupId, matchId) {
    const group = t.groups.find((g) => g.id === groupId);
    if (!group) return;
    const match = group.matches.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    const a = parseInt(ls[`${matchId}_A`] ?? "");
    const b = parseInt(ls[`${matchId}_B`] ?? "");
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updatedGroups = t.groups.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId
          ? { ...m, scoreA: String(a), scoreB: String(b), saved: true }
          : m,
      );
      // Recalculate standings
      const standings = g.pairs.map((p) => ({
        ...p,
        pts: 0,
        gf: 0,
        gc: 0,
        played: 0,
        wins: 0,
      }));
      updatedMatches
        .filter((m) => m.saved)
        .forEach((m) => {
          const sa = parseInt(m.scoreA),
            sb = parseInt(m.scoreB);
          const idxA = standings.findIndex((s) => s.id === m.pairA.id);
          const idxB = standings.findIndex((s) => s.id === m.pairB.id);
          if (idxA >= 0) {
            standings[idxA].played++;
            standings[idxA].gf += sa;
            standings[idxA].gc += sb;
            standings[idxA].pts += sa > sb ? 3 : sb > sa ? 0 : 1;
            if (sa > sb) standings[idxA].wins++;
          }
          if (idxB >= 0) {
            standings[idxB].played++;
            standings[idxB].gf += sb;
            standings[idxB].gc += sa;
            standings[idxB].pts += sb > sa ? 3 : sa > sb ? 0 : 1;
            if (sb > sa) standings[idxB].wins++;
          }
        });
      return { ...g, matches: updatedMatches, standings };
    });

    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, groups: updatedGroups });
  }

  const allGroupsDone =
    t.groups && t.groups.every((g) => g.matches.every((m) => m.saved));

  async function onStartKnockout() {
    if (!allGroupsDone) return;
    const bracket = buildKnockoutFromGroups(
      t.groups,
      t.config.advancePerGroup || 2,
    );
    await persist({ ...t, knockoutBracket: bracket, phase: "knockout" });
  }

  async function onSaveKnockoutMatch(matchId) {
    const match = t.knockoutBracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    const a = parseInt(ls[`${matchId}_A`] ?? "");
    const b = parseInt(ls[`${matchId}_B`] ?? "");
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = advanceBracket(t.knockoutBracket, matchId, a, b);
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, knockoutBracket: updated });
  }

  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];
  const champion = t.knockoutBracket?.find(
    (m) => !m.nextMatchId && m.saved,
  )?.winner;

  const allPairs = t.groups ? t.groups.flatMap((g) => g.standings) : [];

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
      }}
    >
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`🌍 ${t.phase === "groups" ? "Fase de grupos" : "Eliminatoria"} · ${t.pairs?.length} parejas`}
      />
      <Tabs
        tabs={[
          ["groups", "👥 Grupos"],
          ["knockout", "⚡ Eliminatoria"],
          ["standings", "📊 Global"],
        ]}
        active={tab}
        setActive={setTab}
      />
      <div style={{ padding: "14px 12px", maxWidth: 680, margin: "0 auto" }}>
        {tab === "groups" && (
          <>
            {t.groups?.map((group) => (
              <div
                key={group.id}
                style={{
                  background: "#1e293b",
                  borderRadius: 14,
                  marginBottom: 16,
                  overflow: "hidden",
                  border: "1px solid #334155",
                }}
              >
                <div
                  style={{
                    background: "#0f172a",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#059669",
                      fontSize: 15,
                    }}
                  >
                    🌍 {group.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {group.matches.filter((m) => m.saved).length}/
                    {group.matches.length} partidos
                  </div>
                </div>
                {/* Group mini-standings */}
                <div style={{ padding: "8px 12px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto auto",
                      gap: "4px 10px",
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 6,
                      paddingBottom: 6,
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    <span>Pareja</span>
                    <span>PJ</span>
                    <span>GF</span>
                    <span>GC</span>
                    <span style={{ color: "#38bdf8" }}>Pts</span>
                  </div>
                  {[...group.standings]
                    .sort((a, b) =>
                      b.pts !== a.pts
                        ? b.pts - a.pts
                        : b.gf - b.gc - (a.gf - a.gc),
                    )
                    .map((s, si) => (
                      <div
                        key={s.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto auto auto",
                          gap: "4px 10px",
                          fontSize: 12,
                          padding: "3px 0",
                          color:
                            si < (t.config.advancePerGroup || 2)
                              ? "#f1f5f9"
                              : "#64748b",
                        }}
                      >
                        <span
                          style={{
                            fontWeight:
                              si < (t.config.advancePerGroup || 2) ? 700 : 400,
                          }}
                        >
                          {si < (t.config.advancePerGroup || 2) && (
                            <span style={{ color: "#4ade80", marginRight: 4 }}>
                              ✓
                            </span>
                          )}
                          {s.p1} / {s.p2}
                        </span>
                        <span>{s.played}</span>
                        <span>{s.gf}</span>
                        <span>{s.gc}</span>
                        <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                          {s.pts}
                        </span>
                      </div>
                    ))}
                </div>
                {/* Group matches */}
                <div style={{ padding: "0 12px 12px" }}>
                  {group.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={() => onSaveGroupMatch(group.id, match.id)}
                      accentColor="#059669"
                    />
                  ))}
                </div>
              </div>
            ))}
            {allGroupsDone && t.phase === "groups" && isAdmin && (
              <button
                onClick={onStartKnockout}
                style={B("#059669", {
                  width: "100%",
                  padding: 14,
                  fontSize: 16,
                  borderRadius: 12,
                })}
              >
                ➡️ Iniciar Fase Eliminatoria
              </button>
            )}
            {!isAdmin && (
              <div
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                👁 Modo vista — actualizando cada 3s
              </div>
            )}
          </>
        )}
        {tab === "knockout" && (
          <>
            {t.phase === "groups" && (
              <div
                style={{
                  color: "#64748b",
                  textAlign: "center",
                  marginTop: 40,
                  fontSize: 14,
                }}
              >
                🌍 Completa la fase de grupos primero
              </div>
            )}
            {t.phase === "knockout" && (
              <>
                {champion && (
                  <div
                    style={{
                      background: "linear-gradient(135deg,#14532d,#059669)",
                      borderRadius: 14,
                      padding: "16px 20px",
                      marginBottom: 16,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 32 }}>🏆</div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                        color: "#d1fae5",
                      }}
                    >
                      ¡Campeón del Mundialito!
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#fff",
                        marginTop: 4,
                      }}
                    >
                      {champion.p1} / {champion.p2}
                    </div>
                  </div>
                )}
                {koRounds.map((round) => (
                  <div key={round}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#059669",
                        marginBottom: 8,
                        marginTop: 4,
                      }}
                    >
                      {round === Math.max(...koRounds)
                        ? "🏆 Final"
                        : `Ronda ${round}`}
                    </div>
                    {t.knockoutBracket
                      .filter((m) => m.round === round)
                      .map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isAdmin={isAdmin}
                          ls={ls}
                          setLs={setLs}
                          onSave={() => onSaveKnockoutMatch(match.id)}
                          accentColor="#059669"
                        />
                      ))}
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {tab === "standings" && (
          <PairStandings pairs={allPairs} title="Tabla Global — Grupos" />
        )}
      </div>
    </div>
  );
}

// ── Play El Pozo ─────────────────────────────────────────────
function PlayPozo({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});
  const [localTimer, setLocalTimer] = useState(0);
  const timerRef = useRef(null);

  // Local timer sync
  useEffect(() => {
    if (t.timerRunning && t.timerStartedAt) {
      const tick = () => {
        const elapsed = t.timerElapsed + (Date.now() - t.timerStartedAt) / 1000;
        setLocalTimer(Math.min(elapsed, t.timerSeconds));
      };
      tick();
      timerRef.current = setInterval(tick, 500);
    } else {
      setLocalTimer(t.timerElapsed || 0);
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [t.timerRunning, t.timerStartedAt, t.timerElapsed, t.timerSeconds]);

  const remaining = Math.max(0, t.timerSeconds - localTimer);
  const pct = (localTimer / t.timerSeconds) * 100;
  const timeExpired = remaining === 0 && localTimer > 0;

  async function toggleTimer() {
    if (t.timerRunning) {
      const elapsed = t.timerElapsed + (Date.now() - t.timerStartedAt) / 1000;
      await persist({
        ...t,
        timerRunning: false,
        timerElapsed: Math.min(elapsed, t.timerSeconds),
        timerStartedAt: null,
      });
    } else {
      await persist({
        ...t,
        timerRunning: true,
        timerStartedAt: Date.now(),
      });
    }
  }

  async function onSaveCourt(ci) {
    const court = t.currentPozoRound[ci];
    const a = parseInt(ls[`${ci}_A`] ?? "");
    const b = parseInt(ls[`${ci}_B`] ?? "");
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = t.currentPozoRound.map((c, i) =>
      i === ci
        ? { ...c, scoreA: String(a), scoreB: String(b), saved: true }
        : c,
    );
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
    await persist({ ...t, currentPozoRound: updated });
  }

  async function onNextRound() {
    if (!t.currentPozoRound.every((c) => c.saved)) return;
    // Update pair stats and court levels
    let updatedPairs = [...t.pairs];
    t.currentPozoRound.forEach((court) => {
      const a = parseInt(court.scoreA),
        b = parseInt(court.scoreB);
      const winner = a > b ? court.pairA : court.pairB;
      const loser = a > b ? court.pairB : court.pairA;
      if (winner) {
        const idx = updatedPairs.findIndex((p) => p.id === winner.id);
        if (idx >= 0) {
          updatedPairs[idx] = {
            ...updatedPairs[idx],
            pts: updatedPairs[idx].pts + 1,
            gf: updatedPairs[idx].gf + Math.max(a, b),
            gc: updatedPairs[idx].gc + Math.min(a, b),
            courtLevel: Math.max(0, court.courtNum - 2), // move up
          };
        }
      }
      if (loser) {
        const idx = updatedPairs.findIndex((p) => p.id === loser.id);
        if (idx >= 0) {
          updatedPairs[idx] = {
            ...updatedPairs[idx],
            gf: updatedPairs[idx].gf + Math.min(a, b),
            gc: updatedPairs[idx].gc + Math.max(a, b),
            courtLevel: court.courtNum, // move down
          };
        }
      }
    });
    const newRound = buildPozoRound(updatedPairs, t.config.courts);
    const savedRounds = [
      ...(t.pozoRounds || []),
      { num: t.roundNum, courts: t.currentPozoRound },
    ];
    setLs({});
    await persist({
      ...t,
      pairs: updatedPairs,
      currentPozoRound: newRound,
      pozoRounds: savedRounds,
      roundNum: t.roundNum + 1,
      timerRunning: false,
      timerElapsed: 0,
      timerStartedAt: null,
    });
  }

  const allSaved = t.currentPozoRound?.every((c) => c.saved);
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        fontFamily: "system-ui",
        background: "#0f172a",
        minHeight: "100vh",
        color: "#f1f5f9",
      }}
    >
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`👑 Rey de la Pista · Ronda ${t.roundNum} · ${t.pairs?.length} parejas`}
      />
      <Tabs
        tabs={[
          ["courts", "🎮 Pistas"],
          ["standings", "📊 Tabla"],
          ["history", "📜 Historial"],
        ]}
        active={tab}
        setActive={setTab}
      />
      <div style={{ padding: "14px 12px", maxWidth: 680, margin: "0 auto" }}>
        {tab === "courts" && (
          <>
            {/* Timer */}
            <div
              style={{
                background: "#1e293b",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 14,
                border: `1px solid ${timeExpired ? "#f87171" : t.timerRunning ? "#d97706" : "#334155"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}
                >
                  ⏱ Tiempo de ronda
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: timeExpired
                      ? "#f87171"
                      : remaining < 60
                        ? "#f59e0b"
                        : "#4ade80",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtTime(remaining)}
                </div>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#0f172a",
                  borderRadius: 99,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: timeExpired
                      ? "#f87171"
                      : remaining < 60
                        ? "#f59e0b"
                        : "#4ade80",
                    borderRadius: 99,
                    transition: "width .5s linear",
                  }}
                />
              </div>
              {timeExpired && (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: "#f87171",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  🔔 ¡Tiempo! Guardá los resultados y rotat
                </div>
              )}
              {isAdmin && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={toggleTimer}
                    style={B(t.timerRunning ? "#dc2626" : "#d97706", {
                      flex: 1,
                      padding: "8px 0",
                    })}
                  >
                    {t.timerRunning ? "⏸ Pausar" : "▶️ Iniciar"}
                  </button>
                  <button
                    onClick={() =>
                      persist({
                        ...t,
                        timerRunning: false,
                        timerElapsed: 0,
                        timerStartedAt: null,
                      })
                    }
                    style={B("#334155", { padding: "8px 14px" })}
                  >
                    ↺ Reset
                  </button>
                </div>
              )}
            </div>
            {/* Courts */}
            {(t.currentPozoRound || []).map((court, ci) => {
              const sA = ls[`${ci}_A`] ?? (court.scoreA || "");
              const sB = ls[`${ci}_B`] ?? (court.scoreB || "");
              const a = parseInt(sA),
                b = parseInt(sB);
              const valid =
                !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
              const isTop = court.courtNum === 1;
              const isBot = court.courtNum === t.config.courts;
              const iStyle = (hi) => ({
                width: 48,
                textAlign: "center",
                fontSize: 20,
                fontWeight: 900,
                background: "#0f172a",
                border: `2px solid ${hi ? "#4ade80" : "#334155"}`,
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "5px 0",
              });
              return (
                <div
                  key={ci}
                  style={{
                    background: court.saved ? "#052e1633" : "#1e293b",
                    border: `1px solid ${court.saved ? "#16a34a" : isTop ? "#d97706" : "#334155"}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isTop ? "#d97706" : "#38bdf8",
                      }}
                    >
                      {isTop ? "👑 " : ""}Pista {court.courtNum}
                      {isTop && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: "#d97706",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: 99,
                          }}
                        >
                          Rey
                        </span>
                      )}
                      {isBot && t.config.courts > 1 && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: "#334155",
                            color: "#94a3b8",
                            padding: "2px 6px",
                            borderRadius: 99,
                          }}
                        >
                          ⬇ Acceso
                        </span>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      {!isTop && (
                        <span style={{ fontSize: 10, color: "#4ade80" }}>
                          ⬆ Ganador sube
                        </span>
                      )}
                      {court.saved && (
                        <span style={{ color: "#4ade80", fontSize: 11 }}>
                          ✅
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        {a > b && !court.saved ? "⬆️ Sube" : "Pareja A"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fbbf24",
                        }}
                      >
                        {court.pairA
                          ? `${court.pairA.p1} / ${court.pairA.p2}`
                          : "TBD"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {isAdmin && !court.saved ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            value={sA}
                            onChange={(e) =>
                              setLs((p) => ({
                                ...p,
                                [`${ci}_A`]: e.target.value,
                              }))
                            }
                            style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
                          />
                          <span style={{ color: "#64748b", fontWeight: 900 }}>
                            –
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={sB}
                            onChange={(e) =>
                              setLs((p) => ({
                                ...p,
                                [`${ci}_B`]: e.target.value,
                              }))
                            }
                            style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
                          />
                        </>
                      ) : (
                        <span
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            color: "#f1f5f9",
                            padding: "0 4px",
                          }}
                        >
                          {court.saved
                            ? `${court.scoreA}–${court.scoreB}`
                            : "vs"}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        {b > a && !court.saved ? "⬆️ Sube" : "Pareja B"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fbbf24",
                        }}
                      >
                        {court.pairB
                          ? `${court.pairB.p1} / ${court.pairB.p2}`
                          : "TBD"}
                      </div>
                    </div>
                  </div>
                  {valid && !court.saved && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        textAlign: "center",
                        color: "#4ade80",
                      }}
                    >
                      ⬆️ Sube:{" "}
                      {a > b
                        ? `${court.pairA?.p1} / ${court.pairA?.p2}`
                        : `${court.pairB?.p1} / ${court.pairB?.p2}`}
                      {!isTop && " · ⬇️ Baja el perdedor"}
                    </div>
                  )}
                  {isAdmin && !court.saved && (
                    <button
                      onClick={() => onSaveCourt(ci)}
                      disabled={!valid}
                      style={B(valid ? "#d97706" : "#334155", {
                        width: "100%",
                        marginTop: 8,
                        borderRadius: 8,
                        padding: 8,
                        opacity: valid ? 1 : 0.5,
                        cursor: valid ? "pointer" : "not-allowed",
                      })}
                    >
                      Guardar resultado
                    </button>
                  )}
                </div>
              );
            })}
            {allSaved && isAdmin && (
              <button
                onClick={onNextRound}
                style={B("#d97706", {
                  width: "100%",
                  padding: 14,
                  fontSize: 16,
                  borderRadius: 12,
                  marginTop: 4,
                })}
              >
                ➡️ Rotar Pistas — Siguiente Ronda
              </button>
            )}
            {!isAdmin && (
              <div
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                👁 Modo vista — actualizando cada 3s
              </div>
            )}
          </>
        )}

        {tab === "standings" && (
          <PairStandings
            pairs={t.pairs || []}
            title={`Tabla — Ronda ${t.roundNum}`}
            extra={
              <div
                style={{
                  background: "#1e293b",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 12,
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                <b style={{ color: "#d97706" }}>👑 Pista 1</b> = Rey de la pista
                &nbsp;·&nbsp; Ganadores suben · Perdedores bajan
              </div>
            }
          />
        )}

        {tab === "history" && (
          <>
            {!t.pozoRounds?.length ? (
              <div
                style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}
              >
                Aún no hay rondas completadas.
              </div>
            ) : (
              [...(t.pozoRounds || [])].reverse().map((r) => (
                <div
                  key={r.num}
                  style={{
                    background: "#1e293b",
                    borderRadius: 10,
                    marginBottom: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#d97706",
                      marginBottom: 8,
                    }}
                  >
                    Ronda {r.num}
                  </div>
                  {r.courts.map((c, i) => {
                    const a = parseInt(c.scoreA),
                      b = parseInt(c.scoreB);
                    const aw = a > b;
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: 13,
                          color: "#cbd5e1",
                          marginBottom: 6,
                          padding: "6px 10px",
                          background: "#0f172a",
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          {c.courtNum === 1 ? "👑 " : ""}Pista {c.courtNum}{" "}
                          ·{" "}
                        </span>
                        <span style={{ color: aw ? "#4ade80" : "#94a3b8" }}>
                          {c.pairA?.p1} / {c.pairA?.p2}
                        </span>
                        <span
                          style={{
                            fontWeight: 900,
                            color: "#f1f5f9",
                            margin: "0 6px",
                          }}
                        >
                          {c.scoreA}–{c.scoreB}
                        </span>
                        <span style={{ color: !aw ? "#4ade80" : "#94a3b8" }}>
                          {c.pairB?.p1} / {c.pairB?.p2}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginLeft: 6,
                          }}
                        >
                          {aw ? "⬆️ sube A" : "⬆️ sube B"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
