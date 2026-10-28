// src/components/shared/MatchCard.jsx
import { analyzeSets, validateGamesScore } from "../../logic/sets";
import { scoreInputProps } from "../../logic/scoreInput";

export default function MatchCard({
  match,
  isAdmin,
  ls,
  setLs,
  onSave,
  onEdit,
  onDelete,
  locked = false,
  accentColor = "#7c3aed",
  scoringFormat = "games",
  stageLabel,
}) {
  const isSetFormat = scoringFormat === "sets3" || scoringFormat === "sets5";
  const maxSets = scoringFormat === "sets5" ? 5 : 3;
  const setsNeededToWin = maxSets === 5 ? 3 : 2;

  // Al corregir un resultado ya guardado, las casillas arrancan con los sets que había (también tras recargar)
  const hasPrevious = !match.saved && match.scoreA !== undefined && match.scoreA !== "";
  const setValue = (i, side) => ls[`${match.id}_set${i}_${side}`] ?? (hasPrevious ? String(match.sets?.[i]?.[side.toLowerCase()] ?? "") : "");

  // Analiza en tiempo real los sets que el usuario va escribiendo
  const live = analyzeSets(
    Array.from({ length: maxSets }, (_, i) => ({
      a: setValue(i, "A"),
      b: setValue(i, "B"),
    })),
    setsNeededToWin,
  );

  // Formato tradicional por juegos
  const sA_games = ls[`${match.id}_A`] ?? (match.scoreA || "");
  const sB_games = ls[`${match.id}_B`] ?? (match.scoreB || "");
  const gA = parseInt(sA_games);
  const gB = parseInt(sB_games);

  const gamesError = isSetFormat ? null : validateGamesScore(sA_games, sB_games);
  const isGamesValid =
    !gamesError && !isNaN(gA) && !isNaN(gB) && gA >= 0 && gB >= 0 && gA !== gB;

  const isValidFinal = isSetFormat ? live.finished : isGamesValid;
  const finalScoreA = isSetFormat ? live.setsA : gA;
  const finalScoreB = isSetFormat ? live.setsB : gB;
  const isEditing =
    !match.saved && match.scoreA !== undefined && match.scoreA !== "";

  if (!match.pairA && !match.pairB) return null;

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] overflow-hidden mb-3">
      {/* Cabecera */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 bg-black/15">
        <span className="text-xs font-bold text-gray-500 tracking-widest">
          {match.bracket === "consolation"
            ? "🥈 REVANCHA"
            : match.bracket === "third"
              ? "🥉 3.º Y 4.º PUESTO"
              : (stageLabel ?? (match.bracket === "winners" ? "⚡ CUADRO PRINCIPAL" : "🏁 FASE DE GRUPOS"))}
          {isSetFormat && ` · 🎾 MEJOR DE ${maxSets}`}
        </span>
        {match.saved && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-green-400 font-semibold">✅ Guardado</span>
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(match.id)}
                className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer underline transition-colors bg-transparent border-0"
              >
                Editar
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={() => onDelete(match.id)}
                className="text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer underline transition-colors bg-transparent border-0"
              >
                Eliminar
              </button>
            )}
            {locked && <span className="text-xs text-gray-500 font-semibold">🔒 Cerrado</span>}
          </div>
        )}
      </div>

      {/* Inputs (Si es por sets, mostramos las filas) */}
      {!match.saved && isSetFormat && isAdmin && match.pairA && match.pairB ? (
        <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
          <div className="flex justify-between gap-3 px-3 text-xs font-bold text-gray-400">
            <span className="flex-1 text-left">{match.pairA.p1} / {match.pairA.p2}</span>
            <span className="flex-1 text-right">{match.pairB.p1} / {match.pairB.p2}</span>
          </div>
          {Array.from({ length: maxSets }).map((_, idx) => {
            // Solo se muestran los sets ya cargados y el siguiente pendiente
            if (idx > live.sets.length || (live.finished && idx >= live.sets.length)) return null;
            const hasError = live.errorIndex === idx;

            return (
              <div key={idx} className="flex items-center justify-between bg-black/20 px-3 py-1.5 rounded-lg border border-white/[0.04]">
                <input
                  type="number" min="0"
                  {...scoreInputProps}
                  value={setValue(idx, "A")}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_A`]: e.target.value }))}
                  className={`font-data w-11 h-9 rounded-lg bg-white/[0.04] border-[1.5px] ${hasError ? "border-red-500/60" : "border-white/10"} text-center text-base font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all`}
                />
                <span className="text-xs font-bold text-gray-500">SET {idx + 1}</span>
                <input
                  type="number" min="0"
                  {...scoreInputProps}
                  value={setValue(idx, "B")}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_B`]: e.target.value }))}
                  className={`font-data w-11 h-9 rounded-lg bg-white/[0.04] border-[1.5px] ${hasError ? "border-red-500/60" : "border-white/10"} text-center text-base font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all`}
                />
              </div>
            );
          })}
          {live.error && (
            <p className="text-xs text-red-400 font-semibold">
              ⚠️ Set {live.errorIndex + 1}: {live.error}
            </p>
          )}
        </div>
      ) : (
        // Inputs tradicionales por games o vista de lectura
        <div className="grid grid-cols-[1fr_auto_1fr] gap-[10px] px-4 py-4">
          {/* Team A */}
          <div className="flex flex-col items-end self-center">
            <span className="text-sm font-bold text-gray-50 text-right">
              {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "Por definir"}
            </span>
          </div>

          {/* Score centro */}
          <div className="flex items-center gap-1.5 self-center">
            {isAdmin && !match.saved && match.pairA && match.pairB ? (
              <>
                <input
                  type="number" min="0"
                  {...scoreInputProps}
                  value={sA_games}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_A`]: e.target.value }))}
                  className="font-data w-11 h-11 rounded-xl bg-white/[0.04] border-[1.5px] border-white/10 text-center text-[22px] font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                  style={{
                    ...(ls[`${match.id}_A`] && {
                      borderColor: `${accentColor}80`,
                      boxShadow: `0 0 0 3px ${accentColor}10`,
                      color: accentColor,
                    }),
                  }}
                />
                <span className="text-gray-600 font-black text-lg">–</span>
                <input
                  type="number" min="0"
                  {...scoreInputProps}
                  value={sB_games}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_B`]: e.target.value }))}
                  className="font-data w-11 h-11 rounded-xl bg-white/[0.04] border-[1.5px] border-white/10 text-center text-[22px] font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                  style={{
                    ...(ls[`${match.id}_B`] && {
                      borderColor: `${accentColor}80`,
                      boxShadow: `0 0 0 3px ${accentColor}10`,
                      color: accentColor,
                    }),
                  }}
                />
              </>
            ) : isSetFormat && match.saved ? (
              <div className="flex gap-1.5 text-sm font-black text-gray-50">
                {match.sets?.map((set, idx) => (
                  <span key={idx} className="bg-[#0f172a] px-2 py-1 rounded">
                    {set.a}-{set.b}
                  </span>
                ))}
                <span className="text-sky-400 ml-1">({match.scoreA}-{match.scoreB})</span>
              </div>
            ) : match.saved ? (
              <>
                <div
                  onClick={() => isAdmin && onEdit && onEdit(match.id)}
                  title={isAdmin ? "Click para editar" : undefined}
                  className={`font-data w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] font-bold transition-all ${parseInt(match.scoreA) > parseInt(match.scoreB)
                    ? "bg-green-500/10 border border-green-500/25 text-green-400"
                    : "bg-white/[0.04] border border-white/7 text-[#334155]"
                  } ${isAdmin ? "cursor-pointer" : ""}`}
                  style={
                    parseInt(match.scoreA) > parseInt(match.scoreB)
                      ? { animation: 'score-pop 0.3s ease-out' }
                      : undefined
                  }
                >
                  {match.scoreA}
                </div>
                <span className="text-gray-600 font-black text-lg">-</span>
                <div
                  onClick={() => isAdmin && onEdit && onEdit(match.id)}
                  title={isAdmin ? "Click para editar" : undefined}
                  className={`font-data w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] font-bold transition-all ${parseInt(match.scoreB) > parseInt(match.scoreA)
                    ? "bg-green-500/10 border border-green-500/25 text-green-400"
                    : "bg-white/[0.04] border border-white/7 text-[#334155]"
                  } ${isAdmin ? "cursor-pointer" : ""}`}
                  style={
                    parseInt(match.scoreB) > parseInt(match.scoreA)
                      ? { animation: 'score-pop 0.3s ease-out' }
                      : undefined
                  }
                >
                  {match.scoreB}
                </div>
              </>
            ) : (
              <span className="text-gray-500 font-black text-lg">vs</span>
            )}
          </div>

          {/* Team B */}
          <div className="flex flex-col items-start self-center">
            <span className="text-sm font-bold text-gray-50">
              {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "Por definir"}
            </span>
          </div>
        </div>
      )}

      {/* Indicador de Ganador: el hueco se reserva siempre para que el botón no salte al escribir */}
      {isAdmin && !match.saved && match.pairA && match.pairB && (
        <div data-testid="winner-slot" className="min-h-[26px]">
          {gamesError && (
            <div data-testid="games-error" className="px-4 pb-2 text-center text-[12px] text-amber-400 font-bold">
              ⚠️ {gamesError}
            </div>
          )}
          {isValidFinal && (
            <div className="flex items-center justify-center gap-1.5 px-4 pb-2 text-[12px] text-green-400 font-bold">
              <span
                className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
                style={{ animation: 'pulse-dot 1.8s ease-in-out infinite' }}
              />
              ✓ Gana{" "}
              {finalScoreA > finalScoreB
                ? `${match.pairA?.p1} / ${match.pairA?.p2}`
                : `${match.pairB?.p1} / ${match.pairB?.p2}`}
              {isSetFormat && ` (${Math.max(finalScoreA, finalScoreB)} sets a ${Math.min(finalScoreA, finalScoreB)})`}
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      {isAdmin && !match.saved && match.pairA && match.pairB && (
        <div className="flex gap-2 px-4 pb-4">
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setLs((p) => {
                  const n = { ...p };
                  delete n[`${match.id}_A`];
                  delete n[`${match.id}_B`];
                  for (let i = 0; i < maxSets; i++) {
                    delete n[`${match.id}_set${i}_A`];
                    delete n[`${match.id}_set${i}_B`];
                  }
                  return n;
                });
                onSave(match.id, parseInt(match.scoreA), parseInt(match.scoreB), match.sets);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-700 hover:bg-red-600 text-white cursor-pointer transition-colors"
            >
              ✕ Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isSetFormat) {
                onSave(match.id, finalScoreA, finalScoreB, live.sets);
              } else {
                onSave(match.id, finalScoreA, finalScoreB);
              }
            }}
            disabled={!isValidFinal}
            data-score-save=""
            className={`${isEditing ? "flex-1" : "w-full"} py-3 rounded-xl text-[13px] font-black text-white cursor-pointer transition-all`}
            style={{
              background: isValidFinal ? accentColor : 'rgba(255,255,255,0.04)',
              color: isValidFinal ? 'white' : '#334155',
              boxShadow: isValidFinal ? `0 4px 16px ${accentColor}4d` : 'none',
            }}
          >
            Guardar resultado
          </button>
        </div>
      )}
    </div>
  );
}
