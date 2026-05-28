// ── Setup Americano ──────────────────────────────────────────
// src/components/setup/SetupAmericano.jsx
import { useState, useRef } from "react";
import { B } from "../../logic/constants";
import { buildFirstRoundAmericano } from "../../logic/americano";

export default function SetupAmericano({
  t,
  code,
  isAdmin,
  persist,
  copyCode,
}) {
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
