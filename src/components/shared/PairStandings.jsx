// src/components/shared/PairStandings.jsx

export default function PairStandings({ pairs, title, extra, scoringFormat = "games" }) {
  const sorted = [...(pairs || [])].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gf - b.gc !== a.gf - a.gc) return b.gf - b.gc - (a.gf - a.gc);
    return (
      (b.gamesFor || 0) - (b.gamesAgainst || 0) -
      ((a.gamesFor || 0) - (a.gamesAgainst || 0))
    );
  });

  return (
    <div className="bg-[#0f172a] rounded-xl overflow-hidden mb-4">
      <div className="px-4 pt-3.5 pb-2.5 text-base font-black text-[#f1f5f9]">
        🏆 {title}
      </div>
      {extra && <div className="px-4 pb-2.5">{extra}</div>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#0a1120]">
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">#</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-left">Jugador</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">PTS</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">GF</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">GC</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">DIF</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const d = p.gf - p.gc;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <tr
                key={p.id}
                className="border-b border-[#1e293b]"
                style={{ background: i % 2 === 0 ? "#1e293b" : "#172033" }}
              >
                <td className="px-2.5 py-2.5 text-center">
                  {medal || <span className="text-[#64748b] text-sm">{i + 1}</span>}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-[#f1f5f9]">
                  {p.name || `${p.p1} / ${p.p2}`}
                </td>
                <td className="px-2.5 py-2.5 text-center text-sm font-black text-[#38bdf8]">{p.pts}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gf}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gc}</td>
                <td
                  className="px-2.5 py-2.5 text-center text-sm font-bold"
                  style={{ color: d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#64748b" }}
                >
                  {d > 0 ? `+${d}` : d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
