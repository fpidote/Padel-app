// src/components/shared/PairStandings.jsx
export default function PairStandings({ pairs, title, extra }) {
  const sorted = [...pairs].sort((a, b) =>
    b.pts !== a.pts
      ? b.pts - a.pts
      : b.gf - b.gc !== a.gf - a.gc
        ? b.gf - b.gc - (a.gf - a.gc)
        : 0,
  );

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: "#f1f5f9",
          marginBottom: 12,
        }}
      >
        🏆 {title}
      </div>
      {extra && <div style={{ marginBottom: 12 }}>{extra}</div>}
      {sorted.map((p, i) => {
        const d = p.gf - p.gc;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 0",
              borderBottom:
                i === sorted.length - 1 ? "none" : "1px solid #334155",
            }}
          >
            <div
              style={{
                width: 24,
                textAlign: "center",
                fontSize: medal ? 18 : 14,
                fontWeight: 700,
                color: "#94a3b8",
              }}
            >
              {medal || i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#f1f5f9" }}>
                {p.p1} / {p.p2}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                GF {p.gf} · GC {p.gc} · Dif {d >= 0 ? "+" : ""}
                {d}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>
                {p.pts}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  textTransform: "uppercase",
                }}
              >
                pts
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
