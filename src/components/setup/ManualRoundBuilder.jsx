import { useState } from "react";
import {
  buildEmptyRound,
  isRoundComplete,
  availablePlayersForSlot,
  calcularDescansos,
} from "../../logic/manualRounds";

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

export default function ManualRoundBuilder({ players, courts, rounds, onChange, onBack }) {
  const [activeRound, setActiveRound] = useState(0);

  function addRound() {
    const next = [...rounds, buildEmptyRound(courts)];
    onChange(next);
    setActiveRound(next.length - 1);
  }

  function deleteRound(i) {
    const next = rounds.filter((_, ri) => ri !== i);
    onChange(next);
    setActiveRound(Math.max(0, Math.min(activeRound, next.length - 1)));
  }

  function updateSlot(roundIdx, courtIdx, pairKey, slotIdx, playerId) {
    const player = playerId
      ? players.find((p) => String(p.id) === playerId) ?? null
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
                p?.id === player.id && !(ci === courtIdx && pk === pairKey && si === slotIdx)
                  ? null
                  : p
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
      })
    );
  }

  const safeActive = Math.min(activeRound, Math.max(0, rounds.length - 1));
  const round = rounds[safeActive] ?? null;

  return (
    <div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-16">

        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors bg-transparent border-none p-0"
        >
          ✓ Guardar y volver al setup
        </button>
        <h2 className="text-xl font-black mb-6" style={{ color: COLOR }}>
          ✏️ Armar Rondas
        </h2>

        {/* Tabs de rondas */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {rounds.map((r, i) => {
            const complete = isRoundComplete(r);
            const isActive = i === safeActive;
            return (
              <div
                key={i}
                className="shrink-0 flex items-center rounded-xl text-sm font-bold transition-colors"
                style={{
                  background: isActive ? COLOR : "#1f2937",
                  border: `1px solid ${isActive ? COLOR : complete ? "#4ade8040" : "#374151"}`,
                }}
              >
                <button
                  onClick={() => setActiveRound(i)}
                  className="px-3 py-2 cursor-pointer bg-transparent border-none"
                  style={{ color: isActive ? "#fff" : complete ? "#4ade80" : "#64748b" }}
                >
                  R{i + 1} {complete ? "✓" : "✗"}
                </button>
                <button
                  onClick={() => deleteRound(i)}
                  className="pr-2.5 cursor-pointer bg-transparent border-none text-base leading-none opacity-40 hover:opacity-100 transition-opacity"
                  style={{ color: isActive ? "#fff" : "#9ca3af" }}
                  title="Eliminar ronda"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            onClick={addRound}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors"
            style={{ background: "#1f2937", border: "1px dashed #374151", color: "#38bdf8" }}
          >
            +
          </button>
        </div>

        {/* Estado vacío */}
        {rounds.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Tocá <span className="font-bold text-sky-400">+</span> para armar la primera ronda
          </div>
        )}

        {/* Editor de ronda */}
        {round && (
          <div className="space-y-4">
            {round.courts.map((court, ci) => (
              <div key={ci} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-700">
                  <span className="text-xs font-bold text-gray-500 tracking-widest">PISTA {ci + 1}</span>
                </div>
                <div
                  className="px-4 py-4 grid items-center gap-3"
                  style={{ gridTemplateColumns: "1fr auto 1fr" }}
                >
                  {/* pairA */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const { available, assignedElsewhere } = availablePlayersForSlot(
                        players, round, ci, "pairA", si
                      );
                      return (
                        <select
                          key={si}
                          value={court.pairA[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(safeActive, ci, "pairA", si, e.target.value || null)
                          }
                          className="w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          style={{
                            borderColor: court.pairA[si] ? COLOR + "80" : "#374151",
                            color: court.pairA[si] ? "#f1f5f9" : "#64748b",
                          }}
                        >
                          <option value="">— elegir —</option>
                          {available.map((p) => (
                            <option key={p.id} value={p.id}>
                              {levelLabel(p)}{p.name}
                            </option>
                          ))}
                          {assignedElsewhere.length > 0 && (
                            <optgroup label="Ya asignados">
                              {assignedElsewhere.map((p) => (
                                <option key={`e-${p.id}`} value={p.id}>
                                  {levelLabel(p)}{p.name} ↩
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      );
                    })}
                  </div>

                  {/* vs */}
                  <span className="text-gray-600 font-black text-base self-center">vs</span>

                  {/* pairB */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const { available, assignedElsewhere } = availablePlayersForSlot(
                        players, round, ci, "pairB", si
                      );
                      return (
                        <select
                          key={si}
                          value={court.pairB[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(safeActive, ci, "pairB", si, e.target.value || null)
                          }
                          className="w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          style={{
                            borderColor: court.pairB[si] ? COLOR + "80" : "#374151",
                            color: court.pairB[si] ? "#f1f5f9" : "#64748b",
                          }}
                        >
                          <option value="">— elegir —</option>
                          {available.map((p) => (
                            <option key={p.id} value={p.id}>
                              {levelLabel(p)}{p.name}
                            </option>
                          ))}
                          {assignedElsewhere.length > 0 && (
                            <optgroup label="Ya asignados">
                              {assignedElsewhere.map((p) => (
                                <option key={`e-${p.id}`} value={p.id}>
                                  {levelLabel(p)}{p.name} ↩
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
                  <span className="text-yellow-400 font-semibold shrink-0">Descansan:</span>
                  <span className="text-gray-400">{resting.map((p) => p.name).join(" · ")}</span>
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
