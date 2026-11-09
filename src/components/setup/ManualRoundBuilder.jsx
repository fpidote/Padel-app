import { useState, useMemo, useEffect, useRef } from "react";
import {
  buildEmptyRound,
  isRoundComplete,
  availablePlayersForSlot,
  calcularDescansos,
  findRepeats,
  repeatOffenders,
  repeatsToWarnings,
} from "../../logic/manualRounds";
import { precomputeAllRounds, courtLabel } from "../../logic/americano";
import { SimpleModal } from "../shared/Components";

const COLOR = "#0284c7";

const LEVELS = [
  { short: "-", color: "#64748b" },
  { short: "P", color: "#94a3b8" },
  { short: "M", color: "#38bdf8" },
  { short: "A", color: "#84cc16" },
];

function levelLabel(p) {
  const lvl = p.level || 0;
  return lvl > 0 ? `[${LEVELS[lvl].short}] ` : "";
}

export default function ManualRoundBuilder({
  players,
  courts,
  courtNames,
  rounds,
  onChange,
  onBack,
  config = {},
}) {
  const [activeRound, setActiveRound] = useState(0);
  const [pendingAutoFill, setPendingAutoFill] = useState(false);
  const [pendingReopt, setPendingReopt] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // índice de ronda a borrar
  const [lockedRounds, setLockedRounds] = useState([]); // índices de rondas que "Re-optimizar" no toca
  const [reoptMsg, setReoptMsg] = useState(null);

  // Compañeros o rivales que se repiten entre rondas (solo canchas completas)
  const repeats = useMemo(() => findRepeats(rounds), [rounds]);
  const repeatedByRound = useMemo(() => repeatOffenders(repeats), [repeats]);
  const repeatLines = useMemo(() => repeatsToWarnings(repeats).map((w) => w.message), [repeats]);
  const repeatCount = repeatLines.length;
  // La pestaña de la ronda activa siempre a la vista, aunque haya más rondas de las que caben
  const tabRefs = useRef({});
  const activeForScroll = Math.min(activeRound, Math.max(0, rounds.length - 1));
  useEffect(() => {
    tabRefs.current[activeForScroll]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeForScroll, rounds.length]);
  const hasPlayers = (r) => r.courts.some((c) => [...c.pairA, ...c.pairB].some(Boolean));
  const incompleteCount = rounds.filter((r) => !isRoundComplete(r)).length;

  // Genera las rondas dejando fijas las indicadas; entre varios intentos se queda con el de menos repetidos
  function generateBest(fixedRounds, total) {
    let best = null;
    let bestCount = Infinity;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { rounds: generated } = precomputeAllRounds(players, {
        courts,
        maxRounds: total,
        mode: "individual",
        useLevels: config.useLevels,
        fixedRounds,
      });
      const count = repeatsToWarnings(findRepeats(generated)).length;
      if (count < bestCount) { best = generated; bestCount = count; }
      if (count === 0) break;
    }
    return { best, bestCount };
  }

  function autoFillAll() {
    const numRounds =
      rounds.length > 0 ? rounds.length : (config.maxRounds ?? 4);
    const { rounds: generated } = precomputeAllRounds(players, {
      courts,
      maxRounds: numRounds,
      mode: "individual",
      useLevels: config.useLevels,
    });
    onChange(generated);
    setActiveRound(0);
    setPendingAutoFill(false);
    setLockedRounds([]);
    setReoptMsg(null);
  }

  function toggleLock(i) {
    setLockedRounds((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setReoptMsg(null);
  }

  // Regenera solo las rondas sin fijar, respetando las fijadas, y se queda con el intento con menos repetidos
  function reoptimize() {
    const fixedRounds = {};
    rounds.forEach((r, i) => {
      if (lockedRounds.includes(i) && isRoundComplete(r)) fixedRounds[i] = r;
    });
    const { best, bestCount } = generateBest(fixedRounds, rounds.length);
    if (best) onChange(best);
    setPendingReopt(false);
    setReoptMsg(
      bestCount === 0
        ? "✓ Sin repetidos."
        : `Quedan ${bestCount} ${bestCount === 1 ? "repetición" : "repeticiones"}: con estos jugadores y rondas no se puede evitar del todo.`,
    );
  }

  // Completa solo las rondas que faltan: las completas se respetan y cuentan como historial
  function completeMissing() {
    const fixedRounds = {};
    rounds.forEach((r, i) => { if (isRoundComplete(r)) fixedRounds[i] = r; });
    const { best } = generateBest(fixedRounds, rounds.length);
    if (best) onChange(best);
    setActiveRound(Math.max(0, rounds.findIndex((r) => !isRoundComplete(r))));
    setPendingComplete(false);
    setReoptMsg(null);
  }

  function handleCompleteClick() {
    if (players.length < 4) return;
    if (rounds.length === 0) { autoFillAll(); return; }
    if (incompleteCount === 0) return;
    // Una ronda a medias se regenera entera: se avisa antes de perder lo que se había puesto
    if (rounds.some((r) => !isRoundComplete(r) && hasPlayers(r))) setPendingComplete(true);
    else completeMissing();
  }

  function handleRedoAllClick() {
    if (players.length < 4) return;
    if (rounds.some(hasPlayers)) setPendingAutoFill(true);
    else autoFillAll();
  }

  function addRound() {
    // Solo las pistas que se pueden llenar con los jugadores que hay (como hace Autocompletar)
    const fillable = Math.max(1, Math.min(courts, Math.floor(players.length / 4)));
    const next = [...rounds, buildEmptyRound(fillable)];
    onChange(next);
    setActiveRound(next.length - 1);
  }

  function requestDelete(i) {
    if (hasPlayers(rounds[i])) setPendingDelete(i);
    else deleteRound(i);
  }

  function deleteRound(i) {
    setPendingDelete(null);
    const next = rounds.filter((_, ri) => ri !== i);
    onChange(next);
    setLockedRounds([]);
    setReoptMsg(null);
    setActiveRound(Math.max(0, Math.min(activeRound, next.length - 1)));
  }

  function updateSlot(roundIdx, courtIdx, pairKey, slotIdx, playerId) {
    const player = playerId
      ? (players.find((p) => String(p.id) === playerId) ?? null)
      : null;
    // Si el jugador elegido ya estaba en otro hueco de esta ronda, se intercambian: quien ocupaba
    // el hueco elegido pasa al hueco que deja libre
    const displaced = rounds[roundIdx]?.courts[courtIdx]?.[pairKey]?.[slotIdx] ?? null;
    onChange(
      rounds.map((r, ri) => {
        if (ri !== roundIdx) return r;
        const newCourts = r.courts.map((c, ci) => {
          let updated = { ...c, pairA: [...c.pairA], pairB: [...c.pairB] };
          // Slot previo del jugador: lo ocupa quien estaba en el hueco elegido (intercambio) o queda libre
          if (player) {
            ["pairA", "pairB"].forEach((pk) => {
              updated[pk] = updated[pk].map((p, si) =>
                p?.id === player.id &&
                !(ci === courtIdx && pk === pairKey && si === slotIdx)
                  ? displaced
                  : p,
              );
            });
          }
          // Asignar al nuevo slot
          if (ci === courtIdx) {
            updated[pairKey] = [...updated[pairKey]];
            updated[pairKey][slotIdx] = player;
          }
          return updated;
        });
        return { ...r, courts: newCourts };
      }),
    );
  }

  const safeActive = Math.min(activeRound, Math.max(0, rounds.length - 1));
  const round = rounds[safeActive] ?? null;

  return (
    <div
      className="min-h-screen bg-[#111827] text-gray-50"
      style={{ fontFamily: "system-ui" }}
    >
      {pendingDelete !== null && (
        <SimpleModal
          icon="🗑️"
          message={`¿Eliminar la ronda ${pendingDelete + 1}? Se pierde lo que armaste en ella.`}
          confirmLabel="Eliminar"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => deleteRound(pendingDelete)}
        />
      )}
      <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors bg-transparent border-0 p-0"
        >
          ✓ Guardar y volver al setup
        </button>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black" style={{ color: COLOR }}>
            ✏️ Armar Rondas
          </h2>
          <button
            onClick={handleCompleteClick}
            data-testid="completar-rondas"
            disabled={players.length < 4 || (rounds.length > 0 && incompleteCount === 0)}
            className="text-xs px-3 py-2 rounded-xl font-bold transition-colors bg-[#1f2937] border border-[#0284c7]/30 text-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed disabled:text-[#64748b] disabled:border-[#374151]"
          >
            {rounds.length === 0 ? `↺ Autocompletar ${config.maxRounds ?? 4} rondas` : "↺ Completar rondas faltantes"}
          </button>
        </div>

        {rounds.length > 0 && !pendingAutoFill && !pendingComplete && (
          <div className="-mt-3 mb-4 text-xs text-gray-500">
            {incompleteCount === 0
              ? "Todas las rondas están completas. "
              : "Las rondas completas no se tocan. "}
            <button
              onClick={handleRedoAllClick}
              data-testid="rehacer-todo"
              disabled={players.length < 4}
              className="font-semibold text-sky-400 underline cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50"
            >
              Rehacer todo desde cero
            </button>
          </div>
        )}

        {pendingComplete && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
            <span className="text-xs text-yellow-400 font-semibold">
              ⚠️ Las rondas a medias se rehacen enteras.
            </span>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setPendingComplete(false)} className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#374151] text-[#94a3b8]">Cancelar</button>
              <button onClick={completeMissing} data-testid="confirmar-completar" className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#b45309] text-white">Completar</button>
            </div>
          </div>
        )}

        {pendingAutoFill && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
            <span className="text-xs text-yellow-400 font-semibold">
              ⚠️ Se rehacen todas las rondas, también las completas.
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setPendingAutoFill(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#374151] text-[#94a3b8]"
              >
                Cancelar
              </button>
              <button
                onClick={autoFillAll}
                data-testid="confirmar-rehacer"
                className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#b45309] text-white"
              >
                Rehacer
              </button>
            </div>
          </div>
        )}

        {/* Tabs de rondas */}
        <div className="flex items-start gap-2 mb-6">
          <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-2">
            {rounds.map((r, i) => {
              const complete = isRoundComplete(r);
              const isActive = i === safeActive;
              return (
                <div
                  key={i}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  className={`shrink-0 flex items-center rounded-xl text-sm font-bold transition-colors border ${isActive ? "bg-[#0284c7] border-[#0284c7]" : complete ? "bg-[#1f2937] border-[#4ade8040]" : "bg-[#1f2937] border-[#374151]"}`}
                >
                  <button
                    onClick={() => setActiveRound(i)}
                    title={complete ? "Ronda completa" : "Ronda incompleta: faltan jugadores"}
                    className={`px-3 py-2 cursor-pointer bg-transparent border-0 ${isActive ? "text-white" : complete ? "text-[#4ade80]" : "text-[#64748b]"}`}
                  >
                    R{i + 1}{complete ? " ✓" : ""}{repeatedByRound.has(i + 1) ? " ⚠️" : ""}
                  </button>
                  {complete && (
                    <button
                      onClick={() => toggleLock(i)}
                      data-testid={`candado-ronda-${i + 1}`}
                      className={`pr-1.5 cursor-pointer bg-transparent border-0 text-sm leading-none transition-opacity ${lockedRounds.includes(i) ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                      title={lockedRounds.includes(i) ? "Ronda fijada: Re-optimizar no la toca" : "Fijar ronda para que Re-optimizar no la toque"}
                    >
                      {lockedRounds.includes(i) ? "🔒" : "🔓"}
                    </button>
                  )}
                  <button
                    onClick={() => requestDelete(i)}
                    className={`pr-2.5 pl-1 cursor-pointer bg-transparent border-0 text-base leading-none opacity-40 hover:opacity-100 transition-opacity ${isActive ? "text-white" : "text-[#9ca3af]"}`}
                    title="Eliminar ronda"
                    aria-label={`Eliminar ronda ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={addRound}
            data-testid="agregar-ronda"
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors bg-[#1f2937] border border-dashed border-[#374151] text-[#38bdf8]"
          >
            + Ronda
          </button>
        </div>

        {rounds.some(isRoundComplete) && (
          <p className="-mt-3 mb-4 text-[11px] text-gray-500">
            🔒 fija una ronda completa para que «Re-optimizar» no la toque.
          </p>
        )}

        {/* Repetidos entre rondas */}
        {repeatCount > 0 && (
          <div data-testid="aviso-repetidos" className="mb-5 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
            <p className="text-xs font-bold text-amber-400 mb-1.5">
              ⚠️ {repeatCount === 1 ? "Hay 1 repetición" : `Hay ${repeatCount} repeticiones`} entre rondas
            </p>
            <ul className="text-xs text-amber-200/90 space-y-0.5 mb-2.5">
              {repeatLines.slice(0, 5).map((line) => <li key={line}>{line}</li>)}
              {repeatLines.length > 5 && <li>y {repeatLines.length - 5} más</li>}
            </ul>
            <p className="text-[11px] text-amber-200/70 mb-2.5">
              ⚠️ marca la ronda donde se repite. Con 🔒 fijas una ronda completa para que Re-optimizar no la toque.
            </p>
            {pendingReopt ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-yellow-400 font-semibold">Se regenerarán las rondas sin fijar (🔓).</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setPendingReopt(false)} className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#374151] text-[#94a3b8]">Cancelar</button>
                  <button onClick={reoptimize} data-testid="confirmar-reoptimizar" className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#b45309] text-white">Re-optimizar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPendingReopt(true)}
                data-testid="reoptimizar"
                disabled={rounds.every((r, i) => lockedRounds.includes(i) && isRoundComplete(r))}
                className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#1f2937] border border-amber-400/30 text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ↺ Re-optimizar rondas sin fijar
              </button>
            )}
          </div>
        )}
        {reoptMsg && repeatCount === 0 && (
          <p data-testid="msg-reoptimizar" className="mb-5 text-xs font-semibold text-green-400">{reoptMsg}</p>
        )}
        {reoptMsg && repeatCount > 0 && (
          <p data-testid="msg-reoptimizar" className="mb-5 text-xs font-semibold text-amber-400">{reoptMsg}</p>
        )}

        {/* Estado vacío */}
        {rounds.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Toca <span className="font-bold text-sky-400">+</span> para armar la
            primera ronda
          </div>
        )}

        {/* Editor de ronda */}
        {round && (
          <div className="space-y-4">
            {round.courts.map((court, ci) => (
              <div
                key={ci}
                className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-gray-700">
                  <span className="text-xs font-bold text-gray-500 tracking-widest">
                    {courtLabel(courtNames, ci, true)}
                  </span>
                </div>
                <div
                  className="px-4 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
                >
                  {/* pairA */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const { available, assignedElsewhere } =
                        availablePlayersForSlot(
                          players,
                          round,
                          ci,
                          "pairA",
                          si,
                        );
                      return (
                        <select
                          key={si}
                          value={court.pairA[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(
                              safeActive,
                              ci,
                              "pairA",
                              si,
                              e.target.value || null,
                            )
                          }
                          className={`w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none ${court.pairA[si] ? "text-[#f1f5f9]" : "border-[#374151] text-[#64748b]"}${court.pairA[si] && repeatedByRound.get(safeActive + 1)?.has(court.pairA[si].id) ? " ring-2 ring-amber-400/70" : ""}`}
                          style={court.pairA[si] ? { borderColor: COLOR + "80" } : undefined}
                        >
                          <option value="">— elegir —</option>
                          {available.map((p) => (
                            <option key={p.id} value={p.id}>
                              {levelLabel(p)}
                              {p.name}
                            </option>
                          ))}
                          {assignedElsewhere.length > 0 && (
                            <optgroup label="Ya asignados">
                              {assignedElsewhere.map((p) => (
                                <option key={`e-${p.id}`} value={p.id}>
                                  {levelLabel(p)}
                                  {p.name} ↩
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      );
                    })}
                  </div>

                  {/* vs */}
                  <span className="text-gray-600 font-black text-base self-center">
                    vs
                  </span>

                  {/* pairB */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const { available, assignedElsewhere } =
                        availablePlayersForSlot(
                          players,
                          round,
                          ci,
                          "pairB",
                          si,
                        );
                      return (
                        <select
                          key={si}
                          value={court.pairB[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(
                              safeActive,
                              ci,
                              "pairB",
                              si,
                              e.target.value || null,
                            )
                          }
                          className={`w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none ${court.pairB[si] ? "text-[#f1f5f9]" : "border-[#374151] text-[#64748b]"}${court.pairB[si] && repeatedByRound.get(safeActive + 1)?.has(court.pairB[si].id) ? " ring-2 ring-amber-400/70" : ""}`}
                          style={court.pairB[si] ? { borderColor: COLOR + "80" } : undefined}
                        >
                          <option value="">— elegir —</option>
                          {available.map((p) => (
                            <option key={p.id} value={p.id}>
                              {levelLabel(p)}
                              {p.name}
                            </option>
                          ))}
                          {assignedElsewhere.length > 0 && (
                            <optgroup label="Ya asignados">
                              {assignedElsewhere.map((p) => (
                                <option key={`e-${p.id}`} value={p.id}>
                                  {levelLabel(p)}
                                  {p.name} ↩
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Descansos automáticos */}
            {(() => {
              const resting = calcularDescansos(players, round.courts);
              // Ronda vacía: no tiene sentido decir que descansan todos
              if (!resting.length || resting.length === players.length) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm">
                  <span>⏳</span>
                  <span className="text-yellow-400 font-semibold shrink-0">
                    {!isRoundComplete(round) ? "Sin asignar:" : resting.length === 1 ? "Descansa:" : "Descansan:"}
                  </span>
                  <span className="text-gray-400">
                    {resting.map((p) => p.name).join(" · ")}
                  </span>
                </div>
              );
            })()}

            {/* Estado de la ronda */}
            <div
              className={`px-4 py-2.5 rounded-xl text-sm font-bold ${
                isRoundComplete(round)
                  ? "bg-green-400/10 border border-green-400/20 text-green-400"
                  : "bg-red-400/10 border border-red-400/20 text-red-400"
              }`}
            >
              {isRoundComplete(round)
                ? "✓ Ronda completa"
                : "✗ Faltan jugadores por asignar"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
