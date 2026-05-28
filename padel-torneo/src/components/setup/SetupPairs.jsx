// src/components/setup/SetupPairs.jsx
import { useState, useRef } from "react";
import { B } from "../../logic/constants";
import { shuffle } from "../../logic/utils";
import { buildBracket } from "../../logic/relampago";
import { buildGroups } from "../../logic/mundialito";
import { buildPozoRound } from "../../logic/pozo";

export default function SetupPairs({ t, code, isAdmin, persist, copyCode, typeInfo }) {
  const [newP1, setNewP1] = useState("");
  const [newP2, setNewP2] = useState("");
  const deb = useRef(null);
  const ds = (nt) => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => persist(nt), 600);
  };
  const pairs = t.pairInputs || [];
  const ok = pairs.length >= 2 && pairs.every((p) => p.p1.trim() && p.p2.trim());
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
    const pairsToStart = t.pairInputs.map((p, i) => ({
      ...p,
      id: i,
      pts: 0,
      gf: 0,
      gc: 0,
    }));
    
    // Si no eligieron formato, por defecto es 'games'
    const finalConfig = { ...t.config, scoringFormat: t.config.scoringFormat || "games" };

    if (t.type === "relampago") {
      const bracket = buildBracket(pairsToStart);
      await persist({
        ...t,
        config: finalConfig,
        bracket,
        pairs: pairsToStart,
        phase: "bracket",
        status: "playing",
      });
    } else if (t.type === "mundialito") {
      const groups = buildGroups(pairsToStart, t.config.groupCount || 2);
      await persist({
        ...t,
        config: finalConfig,
        groups,
        pairs: pairsToStart,
        phase: "groups",
        status: "playing",
      });
    } else if (t.type === "pozo") {
      const sorted = shuffle(pairsToStart);
      const courtAssign = buildPozoRound(
        sorted.map((p, i) => ({ ...p, courtLevel: i })),
        t.config.courts,
      );
      await persist({
        ...t,
        config: finalConfig,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: typeInfo?.color || "#38bdf8" }}>
              {typeInfo?.icon} {typeInfo?.name} — Configuración
            </h1>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Código: <b style={{ color: "#fbbf24", fontSize: 15, letterSpacing: 3 }}>{code}</b>
            </div>
          </div>
          <button
            onClick={copyCode}
            style={B("#1e293b", { border: "1px solid #334155", color: "#94a3b8", fontSize: 12 })}
          >
            📤 Compartir
          </button>
        </div>

        {isAdmin && (
          <>
            <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Nombre del torneo
            </label>
            <input
              value={t.config.name}
              onChange={(e) => ds({ ...t, config: { ...t.config, name: e.target.value } })}
              style={{ ...inp, width: "100%", marginBottom: 12 }}
            />
            
            <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Número de pistas
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => persist({ ...t, config: { ...t.config, courts: n } })}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: 16,
                    background: t.config.courts === n ? (typeInfo?.color || "#0284c7") : "#1e293b",
                    color: t.config.courts === n ? "#fff" : "#94a3b8",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* 👇 NUEVA SECCIÓN: FORMATO DE PUNTUACIÓN (Solo para Relámpago y Mundialito) */}
            {t.type !== "pozo" && (
              <>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Formato de puntuación
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => persist({ ...t, config: { ...t.config, scoringFormat: "games" } })}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 13,
                      background: (t.config.scoringFormat || "games") === "games" ? (typeInfo?.color || "#0284c7") : "#1e293b",
                      color: (t.config.scoringFormat || "games") === "games" ? "#fff" : "#94a3b8",
                    }}
                  >
                    🔢 Por Juegos
                  </button>
                  <button
                    onClick={() => persist({ ...t, config: { ...t.config, scoringFormat: "sets3" } })}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 13,
                      background: t.config.scoringFormat === "sets3" ? (typeInfo?.color || "#0284c7") : "#1e293b",
                      color: t.config.scoringFormat === "sets3" ? "#fff" : "#94a3b8",
                    }}
                  >
                    🎾 Al mejor de 3
                  </button>
                </div>
              </>
            )}

            {t.type === "mundialito" && (
              <>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Número de grupos
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => persist({ ...t, config: { ...t.config, groupCount: n } })}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 16,
                        background: t.config.groupCount === n ? typeInfo.color : "#1e293b",
                        color: t.config.groupCount === n ? "#fff" : "#94a3b8",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Parejas que avanzan por grupo
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => persist({ ...t, config: { ...t.config, advancePerGroup: n } })}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 16,
                        background: t.config.advancePerGroup === n ? typeInfo.color : "#1e293b",
                        color: t.config.advancePerGroup === n ? "#fff" : "#94a3b8",
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
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Duración de ronda (minutos)
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <button
                      key={n}
                      onClick={() => persist({ ...t, timerSeconds: n * 60 })}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 13,
                        background: t.timerSeconds === n * 60 ? typeInfo.color : "#1e293b",
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

        <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>
          Parejas ({pairs.length})
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
          {pairs.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <div
                style={{ width: 28, height: 28, borderRadius: 6, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8", flexShrink: 0 }}
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
              <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>/</span>
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
                  onClick={() => persist({ ...t, pairInputs: t.pairInputs.filter((_, idx) => idx !== i) })}
                  style={B("#dc2626", { padding: "4px 8px", fontSize: 11, flexShrink: 0 })}
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
              <span style={{ color: "#475569", fontSize: 12, fontWeight: 700, alignSelf: "center" }}>/</span>
              <input
                value={newP2}
                onChange={(e) => setNewP2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    persist({
                      ...t,
                      pairInputs: [
                        ...t.pairInputs,
                        { id: t.pairInputs.length, p1: newP1.trim() || `Jugador ${t.pairInputs.length * 2 + 1}`, p2: newP2.trim() || `Jugador ${t.pairInputs.length * 2 + 2}`, pts: 0, gf: 0, gc: 0 },
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
                      { id: t.pairInputs.length, p1: newP1.trim() || `Jugador ${t.pairInputs.length * 2 + 1}`, p2: newP2.trim() || `Jugador ${t.pairInputs.length * 2 + 2}`, pts: 0, gf: 0, gc: 0 },
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
              style={B(ok ? (typeInfo?.color || "#10b981") : "#334155", {
                width: "100%", padding: 16, fontSize: 17, borderRadius: 14, opacity: ok ? 1 : 0.4, cursor: ok ? "pointer" : "not-allowed",
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