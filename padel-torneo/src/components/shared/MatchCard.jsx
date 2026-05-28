// src/components/shared/MatchCard.jsx
import { B } from "../../logic/constants";

export default function MatchCard({
  match,
  isAdmin,
  ls,
  setLs,
  onSave,
  onEdit,
  accentColor = "#7c3aed",
  scoringFormat = "games",
}) {
  const isSetFormat = scoringFormat === "sets3" || scoringFormat === "sets5";
  const maxSets = scoringFormat === "sets5" ? 5 : 3;
  const setsNeededToWin = maxSets === 5 ? 3 : 2;

  // Renderizado cuando el partido ya está guardado
  const renderSavedScore = () => {
    if (isSetFormat && match.sets) {
      return (
        <div
          style={{
            display: "flex",
            gap: 8,
            fontSize: 14,
            fontWeight: 800,
            color: "#f1f5f9",
          }}
        >
          {match.sets.map((set, idx) => (
            <span
              key={idx}
              style={{
                background: "#0f172a",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              {set.a}-{set.b}
            </span>
          ))}
          <span style={{ color: "#38bdf8", marginLeft: 4 }}>
            ({match.scoreA}-{match.scoreB})
          </span>
        </div>
      );
    }
    return (
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: match.saved ? "#f1f5f9" : "#64748b",
        }}
      >
        {match.saved ? `${match.scoreA}-${match.scoreB}` : "vs"}
      </div>
    );
  };

  // Calcular en tiempo real quién va ganando mientras el usuario escribe
  const getLiveSetResults = () => {
    let setsA = 0;
    let setsB = 0;
    const setList = [];

    for (let i = 0; i < maxSets; i++) {
      const sA = ls[`${match.id}_set${i}_A`] ?? "";
      const sB = ls[`${match.id}_set${i}_B`] ?? "";
      const a = parseInt(sA);
      const b = parseInt(sB);

      if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b) {
        setList.push({ a, b });
        if (a > b) setsA++;
        else setsB++;
      }
    }

    const matchFinished =
      setsA === setsNeededToWin || setsB === setsNeededToWin;
    return { setsA, setsB, setList, matchFinished };
  };

  // Formato tradicional por juegos
  const sA_games = ls[`${match.id}_A`] ?? (match.scoreA || "");
  const sB_games = ls[`${match.id}_B`] ?? (match.scoreB || "");
  const gA = parseInt(sA_games);
  const gB = parseInt(sB_games);

  const isGamesValid =
    !isNaN(gA) && !isNaN(gB) && gA >= 0 && gB >= 0 && gA !== gB;

  const live = getLiveSetResults();
  const isValidFinal = isSetFormat ? live.matchFinished : isGamesValid;
  const finalScoreA = isSetFormat ? live.setsA : gA;
  const finalScoreB = isSetFormat ? live.setsB : gB;

  const iStyle = {
    width: 44,
    textAlign: "center",
    fontSize: 16,
    fontWeight: 900,
    background: "#0f172a",
    border: "2px solid #334155",
    borderRadius: 6,
    color: "#f1f5f9",
    padding: "4px 0",
  };

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
      {/* Cabecera */}
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
          {isSetFormat && ` · 🎾 Mejor de ${maxSets}`}
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

      {/* Inputs (Si es por sets, mostramos las filas) */}
      {!match.saved && isSetFormat && isAdmin && match.pairA && match.pairB ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: maxSets }).map((_, idx) => {
            // Lógica para ocultar el 3er set SI Y SOLO SI alguien ya ganó 2-0 en los sets anteriores
            let tempSetsA = 0;
            let tempSetsB = 0;
            for (let i = 0; i < idx; i++) {
              const pA = parseInt(ls[`${match.id}_set${i}_A`]);
              const pB = parseInt(ls[`${match.id}_set${i}_B`]);
              if (!isNaN(pA) && !isNaN(pB) && pA !== pB) {
                if (pA > pB) tempSetsA++;
                else tempSetsB++;
              }
            }
            if (tempSetsA === setsNeededToWin || tempSetsB === setsNeededToWin)
              return null;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#0f172a33",
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    width: 45,
                  }}
                >
                  SET {idx + 1}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "#94a3b8",
                    flex: 1,
                    textAlign: "right",
                    marginRight: 12,
                    fontSize: 13,
                  }}
                >
                  {match.pairA.p1} / {match.pairA.p2}
                </span>
                <input
                  type="number"
                  min="0"
                  onKeyDown={(e) =>
                    ["-", "e", ".", ","].includes(e.key) && e.preventDefault()
                  }
                  value={ls[`${match.id}_set${idx}_A`] ?? ""}
                  onChange={(e) =>
                    setLs((p) => ({
                      ...p,
                      [`${match.id}_set${idx}_A`]: e.target.value,
                    }))
                  }
                  style={iStyle}
                />
                <span
                  style={{ color: "#64748b", fontWeight: 700, margin: "0 8px" }}
                >
                  -
                </span>
                <input
                  type="number"
                  min="0"
                  onKeyDown={(e) =>
                    ["-", "e", ".", ","].includes(e.key) && e.preventDefault()
                  }
                  value={ls[`${match.id}_set${idx}_B`] ?? ""}
                  onChange={(e) =>
                    setLs((p) => ({
                      ...p,
                      [`${match.id}_set${idx}_B`]: e.target.value,
                    }))
                  }
                  style={iStyle}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: "#94a3b8",
                    flex: 1,
                    textAlign: "left",
                    marginLeft: 12,
                    fontSize: 13,
                  }}
                >
                  {match.pairB.p1} / {match.pairB.p2}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // Inputs tradicionales por games o vista de lectura
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              flex: 1,
              textAlign: "right",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD"}
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
                  value={sA_games}
                  onChange={(e) =>
                    setLs((p) => ({ ...p, [`${match.id}_A`]: e.target.value }))
                  }
                  style={{ ...iStyle, width: 48, fontSize: 20 }}
                />
                <span style={{ color: "#64748b", fontWeight: 700 }}>–</span>
                <input
                  type="number"
                  min="0"
                  onKeyDown={(e) =>
                    ["-", "e", ".", ","].includes(e.key) && e.preventDefault()
                  }
                  value={sB_games}
                  onChange={(e) =>
                    setLs((p) => ({ ...p, [`${match.id}_B`]: e.target.value }))
                  }
                  style={{ ...iStyle, width: 48, fontSize: 20 }}
                />
              </>
            ) : (
              renderSavedScore()
            )}
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "left",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD"}
          </div>
        </div>
      )}

      {/* Indicador de Ganador y Botón Guardar */}
      {isValidFinal && !match.saved && (
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
          {finalScoreA > finalScoreB
            ? `${match.pairA?.p1} / ${match.pairA?.p2}`
            : `${match.pairB?.p1} / ${match.pairB?.p2}`}
          {isSetFormat && ` (${finalScoreA} sets a ${finalScoreB})`}
        </div>
      )}

      {isAdmin && !match.saved && match.pairA && match.pairB && (
        <button
          onClick={() => {
            if (isSetFormat) {
              onSave(match.id, finalScoreA, finalScoreB, live.setList);
            } else {
              onSave(match.id, finalScoreA, finalScoreB);
            }
          }}
          style={B(isValidFinal ? "#10b981" : "#334155", {
            width: "100%",
            marginTop: 12,
            opacity: isValidFinal ? 1 : 0.5,
          })}
          disabled={!isValidFinal}
        >
          Guardar resultado
        </button>
      )}
    </div>
  );
}
