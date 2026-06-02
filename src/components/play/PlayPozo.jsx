import { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { B, TOURNAMENT_RULES } from "../../logic/constants";
import {
  buildPozoRound,
  applyPozoRoundResults,
  shufflePlayers,
  distributePairLevelToPlayers,
} from "../../logic/pozo";
import { calculateStats } from "../../logic/stats";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

export default function PlayPozo({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});
  const [localTimer, setLocalTimer] = useState(0);
  const [matches, setMatches] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const timerRef = useRef(null);

  async function loadStats() {
    if (matches !== null) return;
    try {
      const snap = await getDocs(collection(db, "torneos", code, "matches"));
      setMatches(snap.docs.map((d) => d.data()));
    } catch (err) {
      console.error("Error al cargar historial de matches:", err);
      setMatches([]);
    }
  }

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

  useEffect(() => {
    if (tab === "stats") loadStats();
  }, [tab]);

  // Initialize currentPozoRound on mount for fixed mode when empty
  useEffect(() => {
    if (
      !isAdmin ||
      t.config?.pozoMode === "mixer" ||
      t.currentPozoRound?.length > 0 ||
      !t.pairs?.length
    ) return;
    const firstRound = buildPozoRound(t.pairs, t.config.courts);
    persist({ ...t, currentPozoRound: firstRound });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, t.timerSeconds - localTimer);
  const pct = (localTimer / t.timerSeconds) * 100;
  const timeExpired = remaining === 0 && localTimer > 0;

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const iStyle = (winning) => ({
    width: 44,
    height: 44,
    borderRadius: 10,
    border: `1px solid ${winning ? "#16a34a55" : "#334155"}`,
    background: "#111827",
    textAlign: "center",
    fontSize: 20,
    fontWeight: 900,
    color: winning ? "#4ade80" : "#38bdf8",
    outline: "none",
    appearance: "textfield",
    MozAppearance: "textfield",
    WebkitAppearance: "none",
  });

  async function toggleTimer() {
    if (t.timerRunning) {
      const elapsed = t.timerElapsed + (Date.now() - t.timerStartedAt) / 1000;
      await persist({
        ...t,
        timerRunning:  false,
        timerElapsed:  Math.min(elapsed, t.timerSeconds),
        timerStartedAt: null,
      });
    } else {
      await persist({ ...t, timerRunning: true, timerStartedAt: Date.now() });
    }
  }

  async function onSaveCourt(ci) {
    const court = t.currentPozoRound[ci];
    const a = parseInt(ls[`${ci}_A`] ?? (court.scoreA != null ? String(court.scoreA) : ""));
    const b = parseInt(ls[`${ci}_B`] ?? (court.scoreB != null ? String(court.scoreB) : ""));
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = t.currentPozoRound.map((c, i) =>
      i === ci ? { ...c, scoreA: String(a), scoreB: String(b), saved: true } : c,
    );
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
    await persist({ ...t, currentPozoRound: updated });
  }

  async function onEditCourt(ci) {
    const updated = t.currentPozoRound.map((c, i) =>
      i === ci ? { ...c, saved: false } : c,
    );
    await persist({ ...t, currentPozoRound: updated });
  }

  async function finishTournament() {
    await persist({
      ...t,
      status:        "finished",
      timerRunning:  false,
      timerElapsed:  0,
      timerStartedAt: null,
    });
  }

  function onForceEnd() {
    setShowFinishModal(true);
  }

  async function onNextRound() {
    if (!t.currentPozoRound.every((c) => c.saved)) return;

    const updatedPairs = applyPozoRoundResults(t.pairs, t.currentPozoRound, t.config.courts);
    const newRound     = buildPozoRound(updatedPairs, t.config.courts);

    const matchesRef = collection(db, "torneos", code, "matches");
    await Promise.all(
      t.currentPozoRound.map((court) => {
        const a    = parseInt(court.scoreA);
        const b    = parseInt(court.scoreB);
        const side = a > b ? "A" : "B";
        const pAb  = t.pairs.find((p) => p.id === court.pairA.id);
        const pBb  = t.pairs.find((p) => p.id === court.pairB.id);
        const pAa  = updatedPairs.find((p) => p.id === court.pairA.id);
        const pBa  = updatedPairs.find((p) => p.id === court.pairB.id);
        return addDoc(matchesRef, {
          roundNum:    t.roundNum,
          courtNum:    court.courtNum,
          confirmedAt: Timestamp.now(),
          mode:        "fixed",
          teamA: {
            playerIds:        [pAb.p1, pAb.p2],
            pairId:           String(pAb.id),
            courtLevelBefore: pAb.courtLevel,
            courtLevelAfter:  pAa.courtLevel,
          },
          teamB: {
            playerIds:        [pBb.p1, pBb.p2],
            pairId:           String(pBb.id),
            courtLevelBefore: pBb.courtLevel,
            courtLevelAfter:  pBa.courtLevel,
          },
          result: { scoreA: a, scoreB: b, winningSide: side },
        });
      }),
    );

    const savedRounds = [...(t.pozoRounds || []), { num: t.roundNum, courts: t.currentPozoRound }];
    const isLastRound = t.config.targetRounds && t.roundNum >= t.config.targetRounds;
    setLs({});
    await persist({
      ...t,
      pairs:            updatedPairs,
      currentPozoRound: isLastRound ? null : newRound,
      pozoRounds:       savedRounds,
      roundNum:         t.roundNum + 1,
      timerRunning:     false,
      timerElapsed:     0,
      timerStartedAt:   null,
      status:           isLastRound ? "finished" : t.status,
    });
  }

  async function onNextRoundMixer() {
    if (!t.currentPozoRound.every((c) => c.saved)) return;

    const tempPairs      = t.currentPozoRound.flatMap((c) => [c.pairA, c.pairB]);
    const updatedTemps   = applyPozoRoundResults(tempPairs, t.currentPozoRound, t.config.courts);
    const updatedPlayers = distributePairLevelToPlayers(updatedTemps, t.players, t.currentPozoRound);
    const nextProposed   = shufflePlayers(updatedPlayers, t.config.courts);

    const matchesRef = collection(db, "torneos", code, "matches");
    await Promise.all(
      t.currentPozoRound.map((court) => {
        const a   = parseInt(court.scoreA);
        const b   = parseInt(court.scoreB);
        const tpA = court.pairA;
        const tpB = court.pairB;
        const utA = updatedTemps.find((p) => p.id === tpA.id);
        const utB = updatedTemps.find((p) => p.id === tpB.id);
        return addDoc(matchesRef, {
          roundNum:    t.roundNum,
          courtNum:    court.courtNum,
          confirmedAt: Timestamp.now(),
          mode:        "mixer",
          teamA: {
            playerIds:        tpA._playerIds,
            pairId:           null,
            courtLevelBefore: tpA.courtLevel,
            courtLevelAfter:  utA.courtLevel,
          },
          teamB: {
            playerIds:        tpB._playerIds,
            pairId:           null,
            courtLevelBefore: tpB.courtLevel,
            courtLevelAfter:  utB.courtLevel,
          },
          result: { scoreA: a, scoreB: b, winningSide: a > b ? "A" : "B" },
        });
      }),
    );

    const savedRounds = [...(t.pozoRounds || []), { num: t.roundNum, courts: t.currentPozoRound }];
    const isLastRound = t.config.targetRounds && t.roundNum >= t.config.targetRounds;

    const nextRound = isLastRound ? null : (() => {
      const playerMap = Object.fromEntries(updatedPlayers.map((p) => [p.id, p]));
      return nextProposed.courts.map((court) => {
        const [pA1, pA2] = court.teamA.playerIds.map((id) => playerMap[id]);
        const [pB1, pB2] = court.teamB.playerIds.map((id) => playerMap[id]);
        return {
          courtNum: court.courtNum,
          pairA: {
            id: `tmp_${pA1.id}_${pA2.id}`, _playerIds: [pA1.id, pA2.id],
            p1: pA1.name, p2: pA2.name,
            pts: Math.round((pA1.pts + pA2.pts) / 2), gf: 0, gc: 0,
            courtLevel: Math.round((pA1.courtLevel + pA2.courtLevel) / 2),
          },
          pairB: {
            id: `tmp_${pB1.id}_${pB2.id}`, _playerIds: [pB1.id, pB2.id],
            p1: pB1.name, p2: pB2.name,
            pts: Math.round((pB1.pts + pB2.pts) / 2), gf: 0, gc: 0,
            courtLevel: Math.round((pB1.courtLevel + pB2.courtLevel) / 2),
          },
          scoreA: "", scoreB: "", saved: false,
        };
      });
    })();

    setLs({});
    await persist({
      ...t,
      players:          updatedPlayers,
      currentPozoRound: nextRound,
      sittingOut:       nextProposed?.unassigned || [],
      proposedRound:    null,
      pozoRounds:       savedRounds,
      roundNum:         t.roundNum + 1,
      timerRunning:     false,
      timerElapsed:     0,
      timerStartedAt:   null,
      status:           isLastRound ? "finished" : t.status,
    });
  }

  const allSaved   = t.currentPozoRound?.every((c) => c.saved);
  const isFinished = t.status === "finished";
  const roundLabel = t.config.targetRounds
    ? `Ronda ${isFinished ? t.roundNum - 1 : t.roundNum} / ${t.config.targetRounds}`
    : `Ronda ${isFinished ? t.roundNum - 1 : t.roundNum}`;

  return (
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={isFinished ? "🏆 Torneo Finalizado" : roundLabel}
        onEdit={isAdmin && !isFinished ? onEditTournament : undefined}
      />

      {isFinished && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            background: "#1e293b", border: "2px solid #f59e0b",
            borderRadius: 16, padding: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 48 }}>🏆</div>
            <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 20, marginTop: 8 }}>
              ¡Torneo Finalizado!
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
              {t.config.targetRounds
                ? `${t.config.targetRounds} rondas completadas`
                : `${(t.roundNum || 1) - 1} rondas jugadas`}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        <Tabs
          tabs={isFinished
            ? [
                ...(t.config?.pozoMode !== "mixer" ? [["standings", "🏆 Clasificación"]] : []),
                ["stats",   "📊 Stats"],
                ["history", "📜 Historial"],
              ]
            : [
                ["courts",  "⚔️ Pistas"],
                ...(t.config?.pozoMode !== "mixer" ? [["standings", "🏆 Clasificación"]] : []),
                ["history", "📜 Historial"],
                ["stats",   "📊 Stats"],
                ["rules",   "📖 Reglas"],
              ]
          }
          active={
            tab === "courts" && isFinished
              ? (t.config?.pozoMode === "mixer" ? "stats" : "standings")
              : tab
          }
          setActive={setTab}
        />
      </div>

      <div style={{ padding: "0 16px" }}>
        {tab === "courts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Timer */}
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, textAlign: "center" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>
                Tiempo de ronda
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: timeExpired ? "#ef4444" : "#f1f5f9", fontFamily: "monospace", lineHeight: 1 }}>
                {fmtTime(remaining)}
              </div>
              <div style={{ background: "#334155", height: 4, borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
                <div style={{
                  background: timeExpired ? "#ef4444" : "#38bdf8",
                  height: "100%", width: `${pct}%`, transition: "width 0.5s linear",
                }} />
              </div>
              {timeExpired && (
                <div style={{ color: "#ef4444", fontWeight: 700, marginTop: 12 }}>
                  ⏳ ¡Tiempo! Guarda los resultados y rota
                </div>
              )}
              {isAdmin && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                  <button onClick={toggleTimer} style={B(t.timerRunning ? "#f59e0b" : "#10b981", { padding: "8px 24px", fontSize: 16 })}>
                    {t.timerRunning ? "⏸ Pausar" : "▶️ Iniciar"}
                  </button>
                  <button
                    onClick={() => persist({ ...t, timerRunning: false, timerElapsed: 0, timerStartedAt: null })}
                    style={B("#334155", { padding: "8px 14px" })}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Jugador que descansa (mixer con impar) */}
            {t.sittingOut?.length > 0 && (
              <div style={{
                background: "#f59e0b22", border: "1px solid #f59e0b44",
                borderRadius: 10, padding: "10px 14px", fontSize: 13,
                color: "#fbbf24", fontWeight: 600,
              }}>
                ⏳ Descansa esta ronda:{" "}
                {t.sittingOut
                  .map((id) => (t.players || []).find((p) => p.id === id)?.name || id)
                  .join(", ")}
              </div>
            )}

            {/* Pistas */}
            {(t.currentPozoRound || []).map((court, ci) => {
              const sA    = ls[`${ci}_A`] ?? (court.scoreA != null ? String(court.scoreA) : "");
              const sB    = ls[`${ci}_B`] ?? (court.scoreB != null ? String(court.scoreB) : "");
              const a     = parseInt(sA);
              const b     = parseInt(sB);
              const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
              const isTop = court.courtNum === 1;

              return (
                <div
                  key={ci}
                  className="bg-[#1f2937] rounded-2xl border overflow-hidden"
                  style={{ borderColor: isTop ? "#f59e0b" : "#374151" }}
                >
                  {/* Header */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700">
                    <span className="text-xs font-bold text-gray-500 tracking-widest">
                      {isTop ? "👑 " : ""}PISTA {court.courtNum}
                      {isTop && <span className="ml-2 text-yellow-400 normal-case tracking-normal font-semibold text-xs">Rey</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isTop && <span className="text-xs text-sky-400 font-semibold">↑ Ganador sube</span>}
                      {court.saved && <span className="text-xs text-green-400 font-semibold">✅ Guardado</span>}
                      {court.saved && isAdmin && (
                        <button
                          onClick={() => onEditCourt(ci)}
                          className="text-xs font-semibold text-gray-500 hover:text-sky-400 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body — grid 3 columnas */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", padding: "12px 16px" }}>
                    {/* Pareja A — derecha */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                        Pareja A
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                        {court.pairA ? `${court.pairA.p1} / ${court.pairA.p2}` : "TBD"}
                      </div>
                      {court.saved && parseInt(court.scoreA) > parseInt(court.scoreB) && (
                        <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginTop: 2 }}>↑ SUBE</div>
                      )}
                    </div>

                    {/* Score centro */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", padding: "8px 10px", borderRadius: 8 }}>
                      {isAdmin && !court.saved ? (
                        <>
                          <input
                            type="number" min="0"
                            value={sA}
                            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                            onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))}
                            style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
                          />
                          <span style={{ color: "#64748b", fontWeight: 700 }}>-</span>
                          <input
                            type="number" min="0"
                            value={sB}
                            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                            onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))}
                            style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
                          />
                        </>
                      ) : (
                        <div style={{ fontSize: 22, fontWeight: 900, color: court.saved ? "#f1f5f9" : "#334155", minWidth: 60, textAlign: "center" }}>
                          {court.saved ? `${court.scoreA} - ${court.scoreB}` : "–"}
                        </div>
                      )}
                    </div>

                    {/* Pareja B — izquierda */}
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                        Pareja B
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                        {court.pairB ? `${court.pairB.p1} / ${court.pairB.p2}` : "TBD"}
                      </div>
                      {court.saved && parseInt(court.scoreB) > parseInt(court.scoreA) && (
                        <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginTop: 2 }}>↑ SUBE</div>
                      )}
                    </div>
                  </div>

                  {court.saved && isAdmin && (
                    <div className="text-xs text-gray-600 text-center pb-2 -mt-1">
                      ✓ guardado · toca para editar
                    </div>
                  )}

                  {isAdmin && !court.saved && valid && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => onSaveCourt(ci)}
                        className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#d97706] hover:bg-[#b45309] text-white cursor-pointer transition-colors"
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
                onClick={t.config?.pozoMode === "mixer" ? onNextRoundMixer : onNextRound}
                style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}
              >
                Rotar Pistas - Siguiente Ronda ➔
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onForceEnd}
                style={B("#334155", { width: "100%", padding: 12, fontSize: 13, marginTop: 4 })}
              >
                🏁 Finalizar Torneo
              </button>
            )}
            {!isAdmin && !allSaved && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 20, fontSize: 14 }}>
                👀 Modo vista · Esperando resultados
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <PairStandings
            pairs={t.config?.pozoMode === "mixer" ? (t.players || []) : (t.pairs || [])}
            title="Clasificación del Pozo"
            extra={
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                👑 Pista 1 = Rey de la pista · Ganadores suben · Perdedores bajan
              </div>
            }
          />
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!t.pozoRounds?.length ? (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
                Aún no hay rondas completadas.
              </div>
            ) : (
              [...(t.pozoRounds || [])].reverse().map((r) => (
                <div key={r.num} style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>
                    Ronda {r.num}
                  </div>
                  {r.courts.map((c, i) => {
                    const a = parseInt(c.scoreA), b = parseInt(c.scoreB);
                    const aw = a > b;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #334155" }}>
                        <span style={{ color: "#94a3b8", width: 70 }}>
                          {c.courtNum === 1 ? "👑 " : ""}Pista {c.courtNum}
                        </span>
                        <span style={{ flex: 1, textAlign: "right", fontWeight: aw ? 700 : 400, color: aw ? "#4ade80" : "#cbd5e1" }}>
                          {c.pairA?.p1} / {c.pairA?.p2}
                        </span>
                        <span style={{ fontWeight: 800, margin: "0 12px" }}>
                          {c.scoreA}-{c.scoreB}
                        </span>
                        <span style={{ flex: 1, textAlign: "left", fontWeight: !aw ? 700 : 400, color: !aw ? "#4ade80" : "#cbd5e1" }}>
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

        {tab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {matches === null && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>Cargando stats...</div>
            )}
            {matches !== null && matches.length === 0 && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>Aún no hay matches completados.</div>
            )}
            {matches !== null && matches.length > 0 &&
              Object.entries(calculateStats(matches))
                .sort(([, a], [, b]) => b.winRate - a.winRate || b.gamesWon - a.gamesWon)
                .map(([id, s]) => (
                  <div key={id} style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>{id}</div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#94a3b8" }}>
                      <span>🏆 {s.gamesWon}V / {s.gamesLost}D</span>
                      <span>⚡ {(s.winRate * 100).toFixed(0)}%</span>
                      <span>🎯 {s.pointsDiff > 0 ? "+" : ""}{s.pointsDiff}</span>
                      <span>🎾 {s.matchesPlayed} partidos</span>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginBottom: 16 }}>
              Reglas de El Pozo
            </h3>
            <ul style={{ color: "#cbd5e1", fontSize: 14, lineHeight: "1.6", paddingLeft: 20, listStyleType: "disc" }}>
              {TOURNAMENT_RULES.pozo.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showFinishModal && (
        <SimpleModal
          message="¿Finalizar el torneo ahora? Esta acción no se puede deshacer."
          confirmLabel="Finalizar"
          onClose={() => setShowFinishModal(false)}
          onConfirm={async () => { setShowFinishModal(false); await finishTournament(); }}
        />
      )}
    </div>
  );
}
