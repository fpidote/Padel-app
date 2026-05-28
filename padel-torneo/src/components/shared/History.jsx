// src/components/shared/History.jsx
export default function History({ rounds }) {
  if (!rounds?.length)
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
        Aún no hay rondas completadas.
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[...rounds].reverse().map((r) => (
        <div
          key={r.num}
          style={{ background: "#1e293b", padding: 12, borderRadius: 8 }}
        >
          <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 8 }}>
            Ronda {r.num}
          </div>
          {r.courts.map((c, i) => {
            const a = parseInt(c.scoreA),
              b = parseInt(c.scoreB);
            const aw = a > b;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "4px 0",
                  borderBottom: "1px solid #334155",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Pista {i + 1} · </span>
                <span
                  style={{
                    fontWeight: aw ? 700 : 400,
                    color: aw ? "#4ade80" : "#cbd5e1",
                  }}
                >
                  {Array.isArray(c.pairA)
                    ? c.pairA.map((p) => p.name).join(" & ")
                    : `${c.pairA?.p1} / ${c.pairA?.p2}`}
                </span>
                <span style={{ fontWeight: 800, margin: "0 8px" }}>
                  {c.scoreA}–{c.scoreB}
                </span>
                <span
                  style={{
                    fontWeight: !isNaN(a) && !aw && a !== b ? 700 : 400,
                    color: !isNaN(a) && !aw && a !== b ? "#4ade80" : "#cbd5e1",
                  }}
                >
                  {Array.isArray(c.pairB)
                    ? c.pairB.map((p) => p.name).join(" & ")
                    : `${c.pairB?.p1} / ${c.pairB?.p2}`}
                </span>
              </div>
            );
          })}
          {r.sittingOut?.length > 0 && (
            <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 8 }}>
              ⏳ Descansaron:{" "}
              {r.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
