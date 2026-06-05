export default function History({ rounds, matchesSearch }) {
  const filterCourt = matchesSearch ?? (() => true);
  if (!rounds?.length)
    return (
      <div className="text-center text-gray-600 py-8 text-sm">
        Aún no hay rondas completadas
      </div>
    );

  function renderNames(pair) {
    if (!pair) return [];
    if (Array.isArray(pair))
      return pair.map((p) => p.name || `${p.p1} / ${p.p2}`);
    return [`${pair.p1}`, `${pair.p2}`];
  }

  return (
    <div className="space-y-3">
      {rounds.map((round, ri) => {
        const sitting = round.sittingOut || [];
        const visibleCourts = (round.courts || [])
          .map((court, idx) => ({ court, idx }))
          .filter(({ court }) => filterCourt(court));
        if (!visibleCourts.length && matchesSearch) return null;
        return (
          <div
            key={ri}
            className="bg-[#1e293b] rounded-2xl border border-gray-700 overflow-hidden"
          >
            {/* Header de ronda */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
              <span className="text-xs font-bold text-sky-400 tracking-widest">
                RONDA {round.num || ri + 1}
              </span>
              {sitting.length > 0 && (
                <span className="text-xs text-gray-500">
                  ⏳ Descansó: {sitting.map((p) => p.name || p.p1).join(", ")}
                </span>
              )}
            </div>

            {/* Partidos */}
            {visibleCourts.map(({ court, idx }) => {
              const scoreA = parseInt(court.scoreA);
              const scoreB = parseInt(court.scoreB);
              const aWon = scoreA > scoreB;
              const namesA = renderNames(court.pairA);
              const namesB = renderNames(court.pairB);

              return (
                <div
                  key={idx}
                  className="grid items-center px-4 py-3 border-t border-gray-800 first:border-0"
                  style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}
                >
                  {/* Equipo A */}
                  <div className="flex flex-col items-end text-right">
                    {namesA.map((name, i) => (
                      <span
                        key={i}
                        className={`text-sm leading-snug font-bold ${aWon ? "text-green-400" : "text-gray-500"}`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>

                  {/* Score badge con label de pista */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-gray-600 tracking-widest">
                      PISTA {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 bg-[#0f172a] border border-gray-700 rounded-lg px-3 py-1.5">
                      <span
                        className={`text-base font-black ${aWon ? "text-green-400" : "text-gray-500"}`}
                      >
                        {court.scoreA}
                      </span>
                      <span className="text-gray-700 font-black text-sm">
                        —
                      </span>
                      <span
                        className={`text-base font-black ${!aWon ? "text-green-400" : "text-gray-500"}`}
                      >
                        {court.scoreB}
                      </span>
                    </div>
                  </div>

                  {/* Equipo B */}
                  <div className="flex flex-col items-start text-left">
                    {namesB.map((name, i) => (
                      <span
                        key={i}
                        className={`text-sm leading-snug font-bold ${!aWon ? "text-green-400" : "text-gray-500"}`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
