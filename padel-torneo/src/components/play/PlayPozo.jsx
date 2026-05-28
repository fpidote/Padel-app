import { useState, useEffect, useRef } from "react";
import { B, TOURNAMENT_RULES } from "../../logic/constants";
import { buildPozoRound } from "../../logic/pozo";
import { THeader, Tabs } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

export default function PlayPozo({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});
  const [localTimer, setLocalTimer] = useState(0);
  const timerRef = useRef(null);

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

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

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

  async function onSaveCourt(ci, isCancel = false) {
    const court = t.currentPozoRound[ci];
    const a = parseInt(
      isCancel ? court.scoreA : (ls[`${ci}_A`] ?? (court.scoreA || "")),
    );
    const b = parseInt(
      isCancel ? court.scoreB : (ls[`${ci}_B`] ?? (court.scoreB || "")),
    );
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

  // 👇 NUESTRA NUEVA FUNCIÓN PARA EDITAR
  async function onEditCourt(ci) {
    const updated = t.currentPozoRound.map((c, i) =>
      i === ci ? { ...c, saved: false } : c,
    );
    await persist({ ...t, currentPozoRound: updated });
  }

  async function onNextRound() {
    if (!t.currentPozoRound.every((c) => c.saved)) return;
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
            courtLevel: Math.max(0, court.courtNum - 2),
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
            courtLevel: court.courtNum,
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

  // A PARTIR DE AQUÍ EMPIEZA EL "JSX" (Lo visual de la pantalla)
  return (
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`Ronda ${t.roundNum}`}
      />
      <div style={{ padding: 16 }}>
        <Tabs
          tabs={[
            ["courts", "⚔️ Pistas"],
            ["standings", "🏆 Clasificación"],
            ["history", "📜 Historial"],
            ["rules", "📖 Reglas"], // 👇 AÑADIMOS LA PESTAÑA REGLAS AQUÍ
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>

      <div style={{ padding: "0 16px" }}>
        {tab === "courts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Componente del Timer */}
            <div
              style={{
                background: "#1e293b",
                padding: 16,
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                Tiempo de ronda
              </div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  color: timeExpired ? "#ef4444" : "#f1f5f9",
                  fontFamily: "monospace",
                  lineHeight: 1,
                }}
              >
                {fmtTime(remaining)}
              </div>
              <div
                style={{
                  background: "#334155",
                  height: 4,
                  borderRadius: 2,
                  marginTop: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: timeExpired ? "#ef4444" : "#38bdf8",
                    height: "100%",
                    width: `${pct}%`,
                    transition: "width 0.5s linear",
                  }}
                />
              </div>

              {timeExpired && (
                <div
                  style={{ color: "#ef4444", fontWeight: 700, marginTop: 12 }}
                >
                  ⏳ ¡Tiempo! Guarda los resultados y rota
                </div>
              )}
              {isAdmin && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    marginTop: 16,
                  }}
                >
                  <button
                    onClick={toggleTimer}
                    style={B(t.timerRunning ? "#f59e0b" : "#10b981", {
                      padding: "8px 24px",
                      fontSize: 16,
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
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Pistas (Courts) */}
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
                    background: "#1e293b",
                    borderRadius: 12,
                    padding: 16,
                    borderLeft: isTop
                      ? "4px solid #f59e0b"
                      : "4px solid #38bdf8",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      fontSize: 13,
                      color: "#94a3b8",
                      fontWeight: 700,
                    }}
                  >
                    <span>
                      {isTop ? "👑 " : ""}Pista {court.courtNum}
                      {isTop && (
                        <span
                          style={{
                            marginLeft: 8,
                            background: "#f59e0b22",
                            color: "#fbbf24",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                        >
                          Rey
                        </span>
                      )}
                      {isBot && t.config.courts > 1 && (
                        <span
                          style={{
                            marginLeft: 8,
                            background: "#334155",
                            color: "#94a3b8",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                        >
                          Acceso
                        </span>
                      )}
                    </span>
                    <span style={{ display: "flex", gap: 8 }}>
                      {!isTop && (
                        <span style={{ color: "#38bdf8" }}>↑ Ganador sube</span>
                      )}
                      {/* 👇 AQUÍ REEMPLAZAMOS EL CHECK POR EL BLOQUE CON EL BOTÓN EDITAR */}
                      {court.saved && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <span style={{ color: "#4ade80" }}>✅ Guardado</span>
                          {isAdmin && (
                            <button
                              onClick={() => onEditCourt(ci)}
                              style={{
                                fontSize: 12,
                                color: "#f87171",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                textDecoration: "underline",
                                fontWeight: 700,
                              }}
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: a > b && !court.saved ? "#4ade80" : "#64748b",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        {a > b && !court.saved ? "↑ Sube" : "Pareja A"}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#f1f5f9",
                          fontSize: 14,
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
                        gap: 8,
                        background: "#0f172a",
                        padding: "8px 12px",
                        borderRadius: 8,
                      }}
                    >
                      {isAdmin && !court.saved ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            onKeyDown={(e) =>
                              ["-", "e", ".", ","].includes(e.key) &&
                              e.preventDefault()
                            }
                            value={sA}
                            onChange={(e) =>
                              setLs((p) => ({
                                ...p,
                                [`${ci}_A`]: e.target.value,
                              }))
                            }
                            style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
                          />
                          <span style={{ color: "#64748b", fontWeight: 700 }}>
                            -
                          </span>
                          <input
                            type="number"
                            min="0"
                            onKeyDown={(e) =>
                              ["-", "e", ".", ","].includes(e.key) &&
                              e.preventDefault()
                            }
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
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: court.saved ? "#f1f5f9" : "#64748b",
                          }}
                        >
                          {court.saved
                            ? `${court.scoreA}-${court.scoreB}`
                            : "vs"}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: b > a && !court.saved ? "#4ade80" : "#64748b",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        {b > a && !court.saved ? "↑ Sube" : "Pareja B"}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#f1f5f9",
                          fontSize: 14,
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
                        textAlign: "center",
                        marginTop: 12,
                        fontSize: 13,
                        color: "#4ade80",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Sube:{" "}
                      {a > b
                        ? `${court.pairA?.p1} / ${court.pairA?.p2}`
                        : `${court.pairB?.p1} / ${court.pairB?.p2}`}
                      {!isTop && " · Baja el perdedor"}
                    </div>
                  )}
                  {isAdmin && !court.saved && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        width: "100%",
                        marginTop: 12,
                      }}
                    >
                      {court.scoreA !== undefined && court.scoreA !== "" && (
                        <button
                          onClick={() => {
                            setLs((p) => {
                              const n = { ...p };
                              delete n[`${ci}_A`];
                              delete n[`${ci}_B`];
                              return n;
                            });
                            onSaveCourt(ci, true);
                          }}
                          style={B("#dc2626", {
                            flex: 1,
                            borderRadius: 8,
                            padding: 10,
                          })}
                        >
                          ✕ Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => onSaveCourt(ci)}
                        disabled={!valid}
                        style={B(valid ? "#d97706" : "#334155", {
                          flex:
                            court.scoreA !== undefined && court.scoreA !== ""
                              ? 1
                              : "auto",
                          width:
                            court.scoreA !== undefined && court.scoreA !== ""
                              ? "auto"
                              : "100%",
                          borderRadius: 8,
                          padding: 10,
                          opacity: valid ? 1 : 0.5,
                          cursor: valid ? "pointer" : "not-allowed",
                        })}
                      >
                        Guardar resultado
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {allSaved && isAdmin && (
              <button
                onClick={onNextRound}
                style={B("#10b981", {
                  width: "100%",
                  padding: 16,
                  fontSize: 16,
                })}
              >
                Rotar Pistas - Siguiente Ronda ➔
              </button>
            )}
            {!isAdmin && !allSaved && (
              <div
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  padding: 20,
                  fontSize: 14,
                }}
              >
                👀 Modo vista · Esperando resultados
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <PairStandings
            pairs={t.pairs}
            title="Clasificación del Pozo"
            extra={
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                👑 Pista 1 = Rey de la pista · Ganadores suben · Perdedores
                bajan
              </div>
            }
          />
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!t.pozoRounds?.length ? (
              <div
                style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}
              >
                Aún no hay rondas completadas.
              </div>
            ) : (
              [...(t.pozoRounds || [])].reverse().map((r) => (
                <div
                  key={r.num}
                  style={{
                    background: "#1e293b",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#38bdf8",
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
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          padding: "4px 0",
                          borderBottom: "1px solid #334155",
                        }}
                      >
                        <span style={{ color: "#94a3b8", width: 70 }}>
                          {c.courtNum === 1 ? "👑 " : ""}Pista {c.courtNum}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            textAlign: "right",
                            fontWeight: aw ? 700 : 400,
                            color: aw ? "#4ade80" : "#cbd5e1",
                          }}
                        >
                          {c.pairA?.p1} / {c.pairA?.p2}
                        </span>
                        <span style={{ fontWeight: 800, margin: "0 12px" }}>
                          {c.scoreA}-{c.scoreB}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            textAlign: "left",
                            fontWeight: !aw ? 700 : 400,
                            color: !aw ? "#4ade80" : "#cbd5e1",
                          }}
                        >
                          {c.pairB?.p1} / {c.pairB?.p2}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* 👇 AÑADIMOS EL BLOQUE VISUAL DE LAS REGLAS */}
        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#38bdf8",
                marginBottom: 16,
              }}
            >
              Reglas de El Pozo
            </h3>
            <ul
              style={{
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: "1.6",
                paddingLeft: 20,
                listStyleType: "disc",
              }}
            >
              {TOURNAMENT_RULES.pozo.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
