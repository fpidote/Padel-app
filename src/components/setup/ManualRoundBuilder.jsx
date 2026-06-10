import { useState } from "react";
import {
  buildEmptyRound,
  isRoundComplete,
  availablePlayersForSlot,
  calcularDescansos,
} from "../../logic/manualRounds";

const COLOR = "#0284c7";

export default function ManualRoundBuilder({ players, courts, rounds, onChange, onBack }) {
  const [activeRound, setActiveRound] = useState(0);

  function addRound() {
    const next = [...rounds, buildEmptyRound(courts)];
    onChange(next);
    setActiveRound(next.length - 1);
  }

  function updateSlot(roundIdx, courtIdx, pairKey, slotIdx, playerId) {
    const player = playerId
      ? players.find((p) => String(p.id) === playerId) ?? null
      : null;
    onChange(
      rounds.map((r, ri) =>
        ri !== roundIdx
          ? r
          : {
              ...r,
              courts: r.courts.map((c, ci) => {
                if (ci !== courtIdx) return c;
                const pair = [...c[pairKey]];
                pair[slotIdx] = player;
                return { ...c, [pairKey]: pair };
              }),
            }
      )
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
          ← Volver al setup
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
              <button
                key={i}
                onClick={() => setActiveRound(i)}
                className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                style={{
                  background: isActive ? COLOR : "#1f2937",
                  color: isActive ? "#fff" : complete ? "#4ade80" : "#64748b",
                  border: `1px solid ${isActive ? COLOR : complete ? "#4ade8040" : "#374151"}`,
                }}
              >
                R{i + 1} {complete ? "✓" : "✗"}
              </button>
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
                      const options = availablePlayersForSlot(players, round, ci, "pairA", si);
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
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                  </div>

                  {/* vs */}
                  <span className="text-gray-600 font-black text-base self-center">vs</span>

                  {/* pairB */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const options = availablePlayersForSlot(players, round, ci, "pairB", si);
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
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
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
