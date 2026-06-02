// src/components/shared/MatchCard.jsx

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
  const isEditing =
    !match.saved && match.scoreA !== undefined && match.scoreA !== "";

  if (!match.pairA && !match.pairB) return null;

  return (
    <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3">
      {/* Cabecera */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700">
        <span className="text-xs font-bold text-gray-500 tracking-widest">
          {match.bracket === "winners"
            ? "⚡ CUADRO PRINCIPAL"
            : match.bracket === "consolation"
              ? "🥈 REVANCHA"
              : "⚽ FASE DE GRUPOS"}
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
          </div>
        )}
      </div>

      {/* Inputs (Si es por sets, mostramos las filas) */}
      {!match.saved && isSetFormat && isAdmin && match.pairA && match.pairB ? (
        <div className="flex flex-col gap-2.5 px-4 pt-2 pb-3">
          {Array.from({ length: maxSets }).map((_, idx) => {
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
            if (tempSetsA === setsNeededToWin || tempSetsB === setsNeededToWin) return null;

            return (
              <div key={idx} className="flex items-center justify-between bg-[#0f172a]/20 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-bold text-gray-500 w-11">SET {idx + 1}</span>
                <span className="font-semibold text-gray-400 flex-1 text-right mr-3 text-sm">
                  {match.pairA.p1} / {match.pairA.p2}
                </span>
                <input
                  type="number" min="0"
                  onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                  value={ls[`${match.id}_set${idx}_A`] ?? ""}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_A`]: e.target.value }))}
                  className="w-11 h-9 rounded-lg bg-[#0f172a] border-2 border-[#334155] text-center text-base font-black text-gray-50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gray-500 font-bold mx-2">-</span>
                <input
                  type="number" min="0"
                  onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                  value={ls[`${match.id}_set${idx}_B`] ?? ""}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_B`]: e.target.value }))}
                  className="w-11 h-9 rounded-lg bg-[#0f172a] border-2 border-[#334155] text-center text-base font-black text-gray-50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="font-semibold text-gray-400 flex-1 text-left ml-3 text-sm">
                  {match.pairB.p1} / {match.pairB.p2}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // Inputs tradicionales por games o vista de lectura
        <div className="grid px-4 py-4" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
          {/* Team A */}
          <div className="flex flex-col items-end self-center">
            <span className="text-sm font-bold text-gray-50 text-right">
              {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD"}
            </span>
          </div>

          {/* Score centro */}
          <div className="flex items-center gap-1.5 self-center">
            {isAdmin && !match.saved && match.pairA && match.pairB ? (
              <>
                <input
                  type="number" min="0"
                  onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                  value={sA_games}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_A`]: e.target.value }))}
                  className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gray-600 font-black text-lg">–</span>
                <input
                  type="number" min="0"
                  onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                  value={sB_games}
                  onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_B`]: e.target.value }))}
                  className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreA) > parseInt(match.scoreB) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                >
                  {match.scoreA}
                </div>
                <span className="text-gray-600 font-black text-lg">-</span>
                <div
                  onClick={() => isAdmin && onEdit && onEdit(match.id)}
                  title={isAdmin ? "Click para editar" : undefined}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreB) > parseInt(match.scoreA) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
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
              {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD"}
            </span>
          </div>
        </div>
      )}

      {/* Indicador de Ganador */}
      {isValidFinal && !match.saved && (
        <div className="text-center px-4 pb-2 text-sm text-green-400 font-bold">
          ✓ Gana{" "}
          {finalScoreA > finalScoreB
            ? `${match.pairA?.p1} / ${match.pairA?.p2}`
            : `${match.pairB?.p1} / ${match.pairB?.p2}`}
          {isSetFormat && ` (${finalScoreA} sets a ${finalScoreB})`}
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
                onSave(match.id, finalScoreA, finalScoreB, live.setList);
              } else {
                onSave(match.id, finalScoreA, finalScoreB);
              }
            }}
            disabled={!isValidFinal}
            className={`${isEditing ? "flex-1" : "w-full"} py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-colors`}
            style={{ background: isValidFinal ? accentColor : "#334155", opacity: isValidFinal ? 1 : 0.5 }}
          >
            Guardar resultado
          </button>
        </div>
      )}
    </div>
  );
}
