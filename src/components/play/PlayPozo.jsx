import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { TOURNAMENT_RULES } from "../../logic/constants";
import {
  buildPozoRound,
  applyPozoRoundResults,
  shufflePlayers,
  distributePairLevelToPlayers,
} from "../../logic/pozo";
import { calculateStats } from "../../logic/stats";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

function resultBadge(won, isTop, isBottom, hasSittingOut) {
  if (won) {
    return isTop
      ? { text: "👑 REY",      cls: "text-yellow-400" }
      : { text: "↑ SUBE",     cls: "text-green-400"  };
  }
  if (isBottom) {
    return hasSittingOut
      ? { text: "↓ SALE",     cls: "text-red-400"    }
      : { text: "↓ SE QUEDA", cls: "text-orange-400" };
  }
  return { text: "↓ BAJA", cls: "text-red-400" };
}

export default function PlayPozo({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});
  const [localTimer, setLocalTimer] = useState(0);
  const [matches, setMatches] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [search, setSearch] = useState(null);
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
    await persist({ ...t, currentPozoRound: updated, scoringStarted: true });
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
      scoringStarted:   true,
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
      scoringStarted:   true,
    });
  }

  const allSaved   = t.currentPozoRound?.every((c) => c.saved);
  const isFinished = t.status === "finished";

  const isMixer = t.config?.pozoMode === "mixer";
  const allPozoEntities = isMixer
    ? [...(t.players || [])].sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ id: p.id, label: p.name }))
    : [...(t.pairs || [])].sort((a, b) => `${a.p1} ${a.p2}`.localeCompare(`${b.p1} ${b.p2}`))
        .map((p) => ({ id: p.id, label: `${p.p1} / ${p.p2}` }));

  function matchesPozoSearch(court) {
    if (!search) return true;
    if (isMixer) {
      return (court.pairA?._playerIds || []).map(String).includes(String(search)) ||
             (court.pairB?._playerIds || []).map(String).includes(String(search));
    }
    return String(court.pairA?.id) === String(search) || String(court.pairB?.id) === String(search);
  }
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
            {/* ── Filtro por jugador ── */}
            <div className="w-full sm:max-w-xs">
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">
                {isMixer ? "🔍 Filtrar por jugador" : "🔍 Filtrar por pareja"}
              </label>
              <select
                value={search ?? ""}
                onChange={(e) => setSearch(e.target.value === "" ? null : e.target.value)}
                className="w-full bg-[#1f2937] border border-gray-700 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="">{isMixer ? "👥 Todos los jugadores" : "👥 Todas las parejas"}</option>
                {allPozoEntities.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {search ? (
              <PozoAllRoundsView
                t={t}
                isAdmin={isAdmin}
                ls={ls}
                setLs={setLs}
                onSaveCourt={onSaveCourt}
                onEditCourt={onEditCourt}
                matchesSearch={matchesPozoSearch}
                highlightId={search}
              />
            ) : (
              <>
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
                      <button
                        onClick={toggleTimer}
                        className="font-bold rounded-lg px-6 py-2 text-base text-white cursor-pointer border-0 transition-colors"
                        style={{ background: t.timerRunning ? "#f59e0b" : "#10b981" }}
                      >
                        {t.timerRunning ? "⏸ Pausar" : "▶️ Iniciar"}
                      </button>
                      <button
                        onClick={() => persist({ ...t, timerRunning: false, timerElapsed: 0, timerStartedAt: null })}
                        className="bg-[#334155] text-white font-bold rounded-lg px-3.5 py-2 cursor-pointer border-0"
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
                  const isTop         = court.courtNum === 1;
                  const isBottom      = court.courtNum === t.config.courts;
                  const hasSittingOut = (t.sittingOut?.length ?? 0) > 0;

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
                              className="text-xs font-semibold text-gray-500 hover:text-sky-400 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                            >
                              ✏️ Editar
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Body — grid 3 columnas */}
                      <div className="grid px-4 py-4" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
                        {/* Pareja A — derecha */}
                        <div className="flex flex-col items-end self-center">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pareja A</div>
                          <div className="text-sm font-bold text-gray-50 text-right">
                            {court.pairA ? `${court.pairA.p1} / ${court.pairA.p2}` : "TBD"}
                          </div>
                          {court.saved && (() => {
                            const { text, cls } = resultBadge(
                              parseInt(court.scoreA) > parseInt(court.scoreB),
                              isTop, isBottom, hasSittingOut
                            );
                            return <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>;
                          })()}
                        </div>

                        {/* Score centro */}
                        <div className="flex items-center gap-1.5 self-center">
                          {court.saved ? (
                            <>
                              <div
                                onClick={() => isAdmin && onEditCourt(ci)}
                                title={isAdmin ? "Click para editar" : undefined}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(court.scoreA) > parseInt(court.scoreB) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                              >
                                {court.scoreA}
                              </div>
                              <span className="text-gray-600 font-black text-lg">-</span>
                              <div
                                onClick={() => isAdmin && onEditCourt(ci)}
                                title={isAdmin ? "Click para editar" : undefined}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(court.scoreB) > parseInt(court.scoreA) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                              >
                                {court.scoreB}
                              </div>
                            </>
                          ) : isAdmin ? (
                            <>
                              <input
                                type="number" min="0"
                                value={sA}
                                onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                                onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))}
                                className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-gray-600 font-black text-lg">-</span>
                              <input
                                type="number" min="0"
                                value={sB}
                                onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                                onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))}
                                className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </>
                          ) : (
                            <span className="text-gray-600 font-black text-lg">–</span>
                          )}
                        </div>

                        {/* Pareja B — izquierda */}
                        <div className="flex flex-col items-start self-center">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pareja B</div>
                          <div className="text-sm font-bold text-gray-50">
                            {court.pairB ? `${court.pairB.p1} / ${court.pairB.p2}` : "TBD"}
                          </div>
                          {court.saved && (() => {
                            const { text, cls } = resultBadge(
                              parseInt(court.scoreB) > parseInt(court.scoreA),
                              isTop, isBottom, hasSittingOut
                            );
                            return <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>;
                          })()}
                        </div>
                      </div>

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
                    className="w-full bg-[#10b981] text-white font-bold rounded-lg py-4 text-base cursor-pointer border-0"
                  >
                    Rotar Pistas - Siguiente Ronda ➔
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={onForceEnd}
                    className="w-full mt-1 bg-[#334155] text-white font-bold rounded-lg py-3 text-sm cursor-pointer border-0"
                  >
                    🏁 Finalizar Torneo
                  </button>
                )}
                {!isAdmin && !allSaved && (
                  <div style={{ textAlign: "center", color: "#64748b", padding: 20, fontSize: 14 }}>
                    👀 Modo vista · Esperando resultados
                  </div>
                )}
              </>
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

function PozoAllRoundsView({ t, isAdmin, ls, setLs, onSaveCourt, onEditCourt, matchesSearch, highlightId }) {
  const isMixer = t.config?.pozoMode === "mixer";

  function renderPair(pair, highlight) {
    const name = pair ? `${pair.p1} / ${pair.p2}` : "TBD";
    return (
      <span className={`text-sm leading-snug ${highlight ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
        {name}
      </span>
    );
  }

  function getHighlight(pair) {
    if (!highlightId) return false;
    if (isMixer) return (pair?._playerIds || []).map(String).includes(String(highlightId));
    return String(pair?.id) === String(highlightId);
  }

  function renderHistoricalCourt(court, ci) {
    const a = parseInt(court.scoreA), b = parseInt(court.scoreB);
    const wonA = !isNaN(a) && !isNaN(b) && a > b;
    const wonB = !isNaN(a) && !isNaN(b) && b > a;
    return (
      <div className="px-4 py-4 border-t border-gray-800 first:border-0">
        <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
          <div className="flex flex-col items-end self-center">
            {renderPair(court.pairA, getHighlight(court.pairA))}
          </div>
          <div className="flex items-center gap-1.5 self-center">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>{court.scoreA}</div>
            <span className="text-gray-600 font-black text-lg">-</span>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>{court.scoreB}</div>
          </div>
          <div className="flex flex-col items-start self-center">
            {renderPair(court.pairB, getHighlight(court.pairB))}
          </div>
        </div>
      </div>
    );
  }

  function renderCurrentCourt(court, ci) {
    const sA = ls[`${ci}_A`] ?? (court.scoreA != null ? String(court.scoreA) : "");
    const sB = ls[`${ci}_B`] ?? (court.scoreB != null ? String(court.scoreB) : "");
    const a = parseInt(sA), b = parseInt(sB);
    const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
    const wonA = court.saved && parseInt(court.scoreA) > parseInt(court.scoreB);
    const wonB = court.saved && parseInt(court.scoreB) > parseInt(court.scoreA);
    return (
      <div className="px-4 py-4 border-t border-gray-800 first:border-0">
        <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
          <div className="flex flex-col items-end self-center">
            {renderPair(court.pairA, getHighlight(court.pairA))}
          </div>
          <div className="flex items-center gap-1.5 self-center">
            {court.saved ? (
              <>
                <div onClick={() => isAdmin && onEditCourt(ci)} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}>{court.scoreA}</div>
                <span className="text-gray-600 font-black text-lg">-</span>
                <div onClick={() => isAdmin && onEditCourt(ci)} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}>{court.scoreB}</div>
              </>
            ) : isAdmin ? (
              <>
                <input type="number" min="0" value={sA} onKeyDown={(e) => ["-","e",".",","].includes(e.key) && e.preventDefault()} onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))} className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-gray-600 font-black text-lg">-</span>
                <input type="number" min="0" value={sB} onKeyDown={(e) => ["-","e",".",","].includes(e.key) && e.preventDefault()} onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))} className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </>
            ) : (
              <span className="text-gray-600 font-black text-lg">–</span>
            )}
          </div>
          <div className="flex flex-col items-start self-center">
            {renderPair(court.pairB, getHighlight(court.pairB))}
          </div>
        </div>
        {isAdmin && !court.saved && valid && (
          <div className="pt-3">
            <button onClick={() => onSaveCourt(ci)} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#d97706] hover:bg-[#b45309] text-white cursor-pointer transition-colors">
              Guardar resultado
            </button>
          </div>
        )}
      </div>
    );
  }

  const pastRounds = t.pozoRounds || [];
  const hasAnyContent = pastRounds.length > 0 || (t.currentPozoRound?.length > 0);

  if (!hasAnyContent) {
    return <div className="text-center text-gray-600 py-8 text-sm">Aún no hay rondas</div>;
  }

  return (
    <div className="space-y-3">
      {pastRounds.map((round, ri) => {
        const filteredCourts = (round.courts || [])
          .map((court, ci) => ({ court, ci }))
          .filter(({ court }) => matchesSearch(court));
        return (
          <div key={ri} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700">
              <span className="text-xs font-bold text-gray-500 tracking-widest">RONDA {round.num}</span>
              <span className="ml-2 text-xs text-green-400 font-semibold">✓ completada</span>
            </div>
            {filteredCourts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">⏳ Descansó</div>
            ) : (
              filteredCourts.map(({ court, ci }) => (
                <React.Fragment key={ci}>{renderHistoricalCourt(court, ci)}</React.Fragment>
              ))
            )}
          </div>
        );
      })}

      {t.currentPozoRound?.length > 0 && (() => {
        const filteredCourts = (t.currentPozoRound || [])
          .map((court, ci) => ({ court, ci }))
          .filter(({ court }) => matchesSearch(court));
        return (
          <div className="bg-[#1f2937] rounded-2xl border border-sky-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
              <span className="text-xs font-bold text-sky-400 tracking-widest">RONDA {t.roundNum}</span>
              <span className="text-xs text-sky-400 font-semibold">● EN CURSO</span>
            </div>
            {filteredCourts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">⏳ Descansa esta ronda</div>
            ) : (
              filteredCourts.map(({ court, ci }) => (
                <React.Fragment key={ci}>{renderCurrentCourt(court, ci)}</React.Fragment>
              ))
            )}
          </div>
        );
      })()}
    </div>
  );
}
