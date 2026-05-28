// src/components/shared/MatchCard.jsx
import { B } from "../../logic/constants";

export default function MatchCard({
  match,
  isAdmin,
  ls,
  setLs,
  onSave,
  onEdit, // 👇 NUEVA PROP
  accentColor = "#7c3aed",
}) {
  const sA = ls[`${match.id}_A`] ?? (match.scoreA || "");
  const sB = ls[`${match.id}_B`] ?? (match.scoreB || "");
  const a = parseInt(sA),
    b = parseInt(sB);
  const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
  const isTie = !isNaN(a) && !isNaN(b) && a === b;

  const iStyle = (hi) => ({
    width: 48,
    textAlign: "center",
    fontSize: 20,
    fontWeight: 900,
    background: "#0f172a",
    border: `2px solid ${hi ? "#4ade80" : "#334155"}`,
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "5px 0",
  });

  if (!match.pairA && !match.pairB) return null;

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
          fontSize: 12,
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        <span>
          {match.bracket === "winners"
            ? "⚡ Cuadro Principal"
            : match.bracket === "consolation"
              ? "🥈 Consolación"
              : "⚽ Fase de Grupos"}
        </span>
        {match.saved && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#4ade80" }}>✅ Guardado</span>
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(match.id)}
                style={{
                  fontSize: 12,
                  color: "#f87171",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: 700,
                }}
              >
                Editar
              </button>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9" }}>
            {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0f172a",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          {isAdmin && !match.saved && match.pairA && match.pairB ? (
            <>
              <input
                type="number"
                min="0"
                onKeyDown={(e) =>
                  ["-", "e", ".", ","].includes(e.key) && e.preventDefault()
                }
                value={sA}
                onChange={(e) =>
                  setLs((p) => ({ ...p, [`${match.id}_A`]: e.target.value }))
                }
                style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
              />
              <span style={{ color: "#64748b", fontWeight: 700 }}>–</span>
              <input
                type="number"
                min="0"
                onKeyDown={(e) =>
                  ["-", "e", ".", ","].includes(e.key) && e.preventDefault()
                }
                value={sB}
                onChange={(e) =>
                  setLs((p) => ({ ...p, [`${match.id}_B`]: e.target.value }))
                }
                style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
              />
            </>
          ) : (
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: match.saved ? "#f1f5f9" : "#64748b",
              }}
            >
              {match.saved ? `${match.scoreA}–${match.scoreB}` : "vs"}
            </div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 700, color: "#f1f5f9" }}>
            {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD"}
          </div>
        </div>
      </div>

      {isTie && !match.saved && (
        <div
          style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: 13,
            color: "#fbbf24",
            fontWeight: 700,
          }}
        >
          ⚡ Empate — punto de oro
        </div>
      )}
      {valid && !match.saved && (
        <div
          style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: 13,
            color: "#4ade80",
            fontWeight: 700,
          }}
        >
          ✓ Gana{" "}
          {a > b
            ? `${match.pairA?.p1} / ${match.pairA?.p2}`
            : `${match.pairB?.p1} / ${match.pairB?.p2}`}
        </div>
      )}
      {isAdmin && !match.saved && match.pairA && match.pairB && (
        <button
          onClick={() => onSave(match.id, a, b)}
          style={B(valid ? "#10b981" : "#334155", {
            width: "100%",
            marginTop: 12,
            opacity: valid ? 1 : 0.5,
          })}
          disabled={!valid}
        >
          Guardar resultado
        </button>
      )}
    </div>
  );
}
