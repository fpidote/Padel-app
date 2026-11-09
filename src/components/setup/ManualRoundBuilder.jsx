import { useState, useMemo } from "react";
import {
  buildEmptyRound,
  isRoundComplete,
  availablePlayersForSlot,
  calcularDescansos,
  findRepeats,
  repeatedIdsByRound,
  repeatsToWarnings,
} from "../../logic/manualRounds";
import { precomputeAllRounds, courtLabel } from "../../logic/americano";

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
  const [lockedRounds, setLockedRounds] = useState([]); // índices de rondas que "Re-optimizar" no toca
  const [reoptMsg, setReoptMsg] = useState(null);

  // Compañeros o rivales que se repiten entre rondas (solo canchas completas)
  const repeats = useMemo(() => findRepeats(rounds), [rounds]);
  const repeatCount = useMemo(() => repeatsToWarnings(repeats).length, [repeats]);
  const repeatedByRound = useMemo(() => repeatedIdsByRound(repeats), [repeats]);
  const repeatLines = useMemo(() => {
    const roundsText = (list) => list.map((r) => `R${r}`).join(", ");
    return [
      ...repeats.partners.map((x) => `${x.a.name} y ${x.b.name}: compañeros en ${roundsText(x.rounds)}`),
      ...repeats.opponents.map((x) => `${x.a.name} y ${x.b.name}: rivales en ${roundsText(x.rounds)}`),
    ];
  }, [repeats]);

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
    let best = null;
    let bestCount = Infinity;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { rounds: generated } = precomputeAllRounds(players, {
        courts,
        maxRounds: rounds.length,
        mode: "individual",
        useLevels: config.useLevels,
        fixedRounds,
      });
      const count = repeatsToWarnings(findRepeats(generated)).length;
      if (count < bestCount) { best = generated; bestCount = count; }
      if (count === 0) break;
    }
    if (best) onChange(best);
    setPendingReopt(false);
    setReoptMsg(
      bestCount === 0
        ? "✓ Sin repetidos."
        : `Quedan ${bestCount} ${bestCount === 1 ? "repetido" : "repetidos"}: con estos jugadores y rondas no se puede evitar del todo.`,
    );
  }

  function handleAutoFillClick() {
    if (players.length < 4) return;
    const hasData = rounds.some((r) =>
      r.courts.some((c) => [...c.pairA, ...c.pairB].some(Boolean)),
    );
    if (hasData) {
      setPendingAutoFill(true);
    } else {
      autoFillAll();
    }
  }

  function addRound() {
    // Solo las pistas que se pueden llenar con los jugadores que hay (como hace Autocompletar)
    const fillable = Math.max(1, Math.min(courts, Math.floor(players.length / 4)));
    const next = [...rounds, buildEmptyRound(fillable)];
    onChange(next);
    setActiveRound(next.length - 1);
  }

  function deleteRound(i) {
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
    onChange(
      rounds.map((r, ri) => {
        if (ri !== roundIdx) return r;
        const newCourts = r.courts.map((c, ci) => {
          let updated = { ...c, pairA: [...c.pairA], pairB: [...c.pairB] };
          // Limpiar slot previo del jugador (swap implícito)
          if (player) {
            ["pairA", "pairB"].forEach((pk) => {
              updated[pk] = updated[pk].map((p, si) =>
                p?.id === player.id &&
                !(ci === courtIdx && pk === pairKey && si === slotIdx)
                  ? null
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
            onClick={handleAutoFillClick}
            disabled={players.length < 4}
            className="text-xs px-3 py-2 rounded-xl font-bold transition-colors bg-[#1f2937] border border-[#0284c7]/30 text-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed disabled:text-[#64748b] disabled:border-[#374151]"
          >
            ↺ Autocompletar todo
          </button>
        </div>

        {pendingAutoFill && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
            <span className="text-xs text-yellow-400 font-semibold">
              ⚠️ Esto reemplazará las rondas actuales.
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
                className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer bg-[#b45309] text-white"
              >
                Reemplazar
              </button>
            </div>
          </div>
        )}

        {/* Tabs de rondas */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {rounds.map((r, i) => {
            const complete = isRoundComplete(r);
            const isActive = i === safeActive;
            return (
              <div
                key={i}
                className={`shrink-0 flex items-center rounded-xl text-sm font-bold transition-colors border ${isActive ? "bg-[#0284c7] border-[#0284c7]" : complete ? "bg-[#1f2937] border-[#4ade8040]" : "bg-[#1f2937] border-[#374151]"}`}
              >
                <button
                  onClick={() => setActiveRound(i)}
                  className={`px-3 py-2 cursor-pointer bg-transparent border-0 ${isActive ? "text-white" : complete ? "text-[#4ade80]" : "text-[#64748b]"}`}
                >
                  R{i + 1} {complete ? "✓" : "✗"}{repeatedByRound.has(i + 1) ? " ⚠️" : ""}
                </button>
                {complete && (
                  <button
                    onClick={() => toggleLock(i)}
                    data-testid={`candado-ronda-${i + 1}`}
                    className={`pr-1.5 cursor-pointer bg-transparent border-0 text-xs leading-none transition-opacity ${lockedRounds.includes(i) ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
                    title={lockedRounds.includes(i) ? "Ronda fijada: Re-optimizar no la toca" : "Fijar ronda para que Re-optimizar no la toque"}
                  >
                    {lockedRounds.includes(i) ? "🔒" : "🔓"}
                  </button>
                )}
                <button
                  onClick={() => deleteRound(i)}
                  className={`pr-2.5 cursor-pointer bg-transparent border-0 text-base leading-none opacity-40 hover:opacity-100 transition-opacity ${isActive ? "text-white" : "text-[#9ca3af]"}`}
                  title="Eliminar ronda"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            onClick={addRound}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors bg-[#1f2937] border border-dashed border-[#374151] text-[#38bdf8]"
          >
            +
          </button>
        </div>

        {/* Repetidos entre rondas */}
        {repeatCount > 0 && (
          <div data-testid="aviso-repetidos" className="mb-5 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
            <p className="text-xs font-bold text-amber-400 mb-1.5">
              ⚠️ {repeatCount === 1 ? "Hay 1 repetido" : `Hay ${repeatCount} repetidos`} entre rondas
            </p>
            <ul className="text-xs text-amber-200/90 space-y-0.5 mb-2.5">
              {repeatLines.slice(0, 5).map((line) => <li key={line}>{line}</li>)}
              {repeatLines.length > 5 && <li>y {repeatLines.length - 5} más</li>}
            </ul>
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
              if (!resting.length) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm">
                  <span>⏳</span>
                  <span className="text-yellow-400 font-semibold shrink-0">
                    Descansan:
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
