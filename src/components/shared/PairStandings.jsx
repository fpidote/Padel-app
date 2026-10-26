// src/components/shared/PairStandings.jsx
import { sortStandings, winsOf } from "../../logic/standings";

const TH = "px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide";
const diffColor = (d) => (d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#64748b");
const fmtDiff = (d) => (d > 0 ? `+${d}` : d);

export default function PairStandings({ pairs, title, extra, scoringFormat = "games" }) {
  const isSetFormat = scoringFormat === "sets3" || scoringFormat === "sets5";
  const sorted = sortStandings(pairs || []);

  return (
    <div className="bg-[#0f172a] rounded-xl overflow-hidden mb-4">
      <div className="px-4 pt-3.5 pb-2.5 text-base font-black text-[#f1f5f9]">
        🏆 {title}
      </div>
      {extra && <div className="px-4 pb-2.5">{extra}</div>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#0a1120]">
            <th className={`${TH} text-center`}>#</th>
            <th className={`${TH} text-left`}>Pareja</th>
            <th className={`${TH} text-center`}>PJ</th>
            <th className={`${TH} text-center`}>PG</th>
            <th className={`${TH} text-center`}>{isSetFormat ? "SF" : "JF"}</th>
            <th className={`${TH} text-center`}>{isSetFormat ? "SC" : "JC"}</th>
            <th className={`${TH} text-center`}>{isSetFormat ? "DS" : "DJ"}</th>
            {isSetFormat && <th className={`${TH} text-center`}>DJ</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const d = p.gf - p.gc;
            const dj = (p.gamesFor || 0) - (p.gamesAgainst || 0);
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
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.played ?? "–"}</td>
                <td className="px-2.5 py-2.5 text-center text-sm font-black text-[#38bdf8]">{winsOf(p)}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gf}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gc}</td>
                <td className="px-2.5 py-2.5 text-center text-sm font-bold" style={{ color: diffColor(d) }}>
                  {fmtDiff(d)}
                </td>
                {isSetFormat && (
                  <td className="px-2.5 py-2.5 text-center text-sm font-bold" style={{ color: diffColor(dj) }}>
                    {fmtDiff(dj)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
