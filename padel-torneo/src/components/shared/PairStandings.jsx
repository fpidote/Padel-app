// src/components/shared/PairStandings.jsx
const thStyle = { padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" };
const tdCenter = { padding: "10px 10px", textAlign: "center" };

export default function PairStandings({
  pairs,
  title,
  extra,
  scoringFormat = "games",
}) {
  const sorted = [...pairs].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gf - b.gc !== a.gf - a.gc) return b.gf - b.gc - (a.gf - a.gc);
    return (
      (b.gamesFor || 0) -
      (b.gamesAgainst || 0) -
      ((a.gamesFor || 0) - (a.gamesAgainst || 0))
    );
  });

  return (
    <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px 10px", fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>
        🏆 {title}
      </div>
      {extra && <div style={{ padding: "0 16px 10px" }}>{extra}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0a1120" }}>
            <th style={thStyle}>#</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Jugador</th>
            <th style={thStyle}>PTS</th>
            <th style={thStyle}>GF</th>
            <th style={thStyle}>GC</th>
            <th style={thStyle}>DIF</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const d = p.gf - p.gc;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? "#1e293b" : "#172033", borderBottom: "1px solid #1e293b" }}>
                <td style={tdCenter}>{medal || <span style={{ color: "#64748b", fontSize: 13 }}>{i + 1}</span>}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                  {p.p1} / {p.p2}
                </td>
                <td style={{ ...tdCenter, color: "#38bdf8", fontWeight: 800, fontSize: 14 }}>{p.pts}</td>
                <td style={{ ...tdCenter, color: "#94a3b8", fontSize: 13 }}>{p.gf}</td>
                <td style={{ ...tdCenter, color: "#94a3b8", fontSize: 13 }}>{p.gc}</td>
                <td style={{ ...tdCenter, fontSize: 13, fontWeight: 700, color: d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#64748b" }}>
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
