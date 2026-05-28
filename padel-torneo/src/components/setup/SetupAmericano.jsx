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
  const [newP1, setNewP1] = useState("");
  const [newP2, setNewP2] = useState("");
  const deb = useRef(null);

  const ds = (nt) => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => persist(nt), 700);
  };

  const isPairs = t.config.mode === "pairs";
  const units = isPairs ? 2 : 4;
  const act = t.config.courts * units;
  const tot = isPairs ? t.pairInputs.length : t.playerInputs.length;
  const sit = tot > act ? tot - act : 0,
    need = tot < act ? act - tot : 0;
  const sc = sit > 0 ? "#fbbf24" : need > 0 ? "#f87171" : "#4ade80";
  const sm =
    `${tot} ${isPairs ? "parejas" : "jugadores"} · ${t.config.courts} pistas · ${act} juegan` +
    (sit > 0
      ? ` · ⏳ ${sit} descansan`
      : need > 0
        ? ` · ⚠️ faltan ${need}`
        : " · ✓");
  const ok = isPairs
    ? tot >= 2 && t.pairInputs.every((p) => p.p1.trim() && p.p2.trim())
    : tot >= 4 && t.playerInputs.every((p) => p.name.trim().length > 0);
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
    let entities;
    if (isPairs) {
      entities = t.pairInputs.map((p, i) => ({
        ...p,
        id: i,
        pts: 0,
        gf: 0,
        gc: 0,
      }));
    } else {
      entities = t.playerInputs.map((p, i) => ({
        id: i,
        name: p.name.trim(),
        level: p.level,
        pts: 0,
        gf: 0,
        gc: 0,
      }));
    }
    const { courts, sittingOut } = buildFirstRoundAmericano(
      entities,
      t.config.courts,
      t.config.mode,
    );
    await persist({
      ...t,
      [isPairs ? "pairs" : "players"]: entities,
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
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Modalidad
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() =>
                  persist({ ...t, config: { ...t.config, mode: "individual" } })
                }
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  background: !isPairs ? "#0284c7" : "#1e293b",
                  color: !isPairs ? "#fff" : "#94a3b8",
                }}
              >
                👤 Individual
              </button>
              <button
                onClick={() =>
                  persist({ ...t, config: { ...t.config, mode: "pairs" } })
                }
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  background: isPairs ? "#0284c7" : "#1e293b",
                  color: isPairs ? "#fff" : "#94a3b8",
                }}
              >
                👥 Parejas Fijas
              </button>
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
        {isPairs ? (
          <>
            <div
              style={{
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Parejas ({tot})
            </div>
            <div
              style={{ maxHeight: 260, overflowY: "auto", marginBottom: 10 }}
            >
              {t.pairInputs.map((p, i) => (
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
                    style={{
                      ...inp,
                      flex: 1,
                      opacity: isAdmin ? 1 : 0.7,
                      padding: "8px 12px",
                    }}
                  />
                  <span
                    style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}
                  >
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
                          pairInputs: t.pairInputs.filter(
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
          </>
        ) : (
          <>
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
              <b style={{ color: "#38bdf8" }}>N1</b> Con experiencia
              &nbsp;·&nbsp; <b style={{ color: "#4ade80" }}>N2</b> Poco rodaje
            </div>
            <div
              style={{ maxHeight: 260, overflowY: "auto", marginBottom: 10 }}
            >
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
          </>
        )}
        {isAdmin && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {isPairs ? (
                <>
                  <input
                    value={newP1}
                    onChange={(e) => setNewP1(e.target.value)}
                    placeholder="Jugador 1"
                    style={{ ...inp, flex: 1, padding: "8px 12px" }}
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
                    style={{ ...inp, flex: 1, padding: "8px 12px" }}
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
                </>
              ) : (
                <>
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
                </>
              )}
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
