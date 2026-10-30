// src/components/shared/MatchCard.jsx
import { matchScoreState } from "../../logic/matchScore";
import { pairLabel } from "../../logic/pairNames";
import MatchShell from "./match/MatchShell";
import MatchActions from "./match/MatchActions";
import PairNames from "./match/PairNames";
import { ScoreBox, ScoreInput } from "./match/ScoreBox";

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
  const canEdit = isAdmin && onEdit;

  // Al corregir un resultado ya guardado, las casillas arrancan con los sets que había (también tras recargar)
  const hasPrevious = !match.saved && match.scoreA !== undefined && match.scoreA !== "";
  const setValue = (i, side) => ls[`${match.id}_set${i}_${side}`] ?? (hasPrevious ? String(match.sets?.[i]?.[side.toLowerCase()] ?? "") : "");
  const gamesA = ls[`${match.id}_A`] ?? (match.scoreA || "");
  const gamesB = ls[`${match.id}_B`] ?? (match.scoreB || "");

  const { bySets, maxSets, live, visibleSetRows, gamesError, isValid, scoreA, scoreB } = matchScoreState(scoringFormat, {
    setRows: Array.from({ length: maxSetsFor(scoringFormat) }, (_, i) => ({ a: setValue(i, "A"), b: setValue(i, "B") })),
    gamesA,
    gamesB,
  });
  const isEditing = hasPrevious;

  if (!match.pairA && !match.pairB) return null;

  const label =
    match.bracket === "consolation"
      ? "REVANCHA"
      : match.bracket === "third"
        ? "3.º Y 4.º PUESTO"
        : (stageLabel ?? (match.bracket === "winners" ? "CUADRO PRINCIPAL" : "FASE DE GRUPOS"));
  const hasPairs = match.pairA && match.pairB;
  const editingNow = isAdmin && !match.saved && hasPairs;

  function setCell(key) {
    return (v) => setLs((p) => ({ ...p, [key]: v }));
  }

  function handleCancel() {
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
  }

  function handleSave() {
    if (bySets) onSave(match.id, scoreA, scoreB, live.sets);
    else onSave(match.id, scoreA, scoreB);
  }

  const aWon = parseInt(match.scoreA) > parseInt(match.scoreB);
  const bWon = parseInt(match.scoreB) > parseInt(match.scoreA);
  const startEdit = canEdit ? () => onEdit(match.id) : undefined;

  return (
    <MatchShell label={label} accentColor={accentColor} saved={match.saved} locked={locked} onEdit={startEdit}>
      {/* Por sets mientras se carga: una fila por set */}
      {editingNow && bySets ? (
        <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
          <div className="text-center text-[11px] font-bold uppercase tracking-widest text-gray-500">🎾 Al mejor de {maxSets} sets</div>
          <div className="flex justify-between gap-3 px-3 text-xs font-bold text-gray-400">
            <span className="flex-1 text-left">{pairLabel(match.pairA)}</span>
            <span className="flex-1 text-right">{pairLabel(match.pairB)}</span>
          </div>
          {Array.from({ length: visibleSetRows }).map((_, idx) => {
            const hasError = live.errorIndex === idx;
            return (
              <div key={idx} className="flex items-center justify-between bg-black/20 px-3 py-1.5 rounded-lg border border-white/[0.04]">
                <ScoreInput size="set" accentColor={accentColor} error={hasError} value={setValue(idx, "A")} onChange={setCell(`${match.id}_set${idx}_A`)} />
                <span className="text-xs font-bold text-gray-500">SET {idx + 1}</span>
                <ScoreInput size="set" accentColor={accentColor} error={hasError} value={setValue(idx, "B")} onChange={setCell(`${match.id}_set${idx}_B`)} />
              </div>
            );
          })}
          {live.error && <p className="text-xs text-red-400 font-semibold">⚠️ Set {live.errorIndex + 1}: {live.error}</p>}
        </div>
      ) : (
        // Por games, o resultado ya guardado
        <div className="grid grid-cols-[1fr_auto_1fr] gap-[10px] px-4 py-4">
          <PairNames pair={match.pairA} align="right" />

          <div className="flex items-center gap-1.5 self-center">
            {editingNow ? (
              <>
                <ScoreInput accentColor={accentColor} value={gamesA} onChange={setCell(`${match.id}_A`)} />
                <span className="text-gray-600 font-black text-lg">–</span>
                <ScoreInput accentColor={accentColor} value={gamesB} onChange={setCell(`${match.id}_B`)} />
              </>
            ) : bySets && match.saved ? (
              <div className="flex gap-1.5 text-sm font-black text-gray-50">
                {match.sets?.map((set, idx) => (
                  <span key={idx} className="bg-[#0f172a] px-2 py-1 rounded">
                    {set.a}-{set.b}
                  </span>
                ))}
                <span className="text-slate-300 ml-1">({match.scoreA}-{match.scoreB})</span>
              </div>
            ) : match.saved ? (
              <>
                <ScoreBox value={match.scoreA} won={aWon} onClick={startEdit} />
                <span className="text-gray-600 font-black text-lg">–</span>
                <ScoreBox value={match.scoreB} won={bWon} onClick={startEdit} />
              </>
            ) : (
              <span className="text-gray-500 font-black text-lg">vs</span>
            )}
          </div>

          <PairNames pair={match.pairB} align="left" />
        </div>
      )}

      {/* Indicador de ganador: el hueco se reserva siempre para que el botón no salte al escribir */}
      {editingNow && (
        <div data-testid="winner-slot" className="min-h-[26px]">
          {gamesError && (
            <div data-testid="games-error" className="px-4 pb-2 text-center text-[12px] text-amber-400 font-bold">
              ⚠️ {gamesError}
            </div>
          )}
          {isValid && (
            <div className="flex items-center justify-center gap-1.5 px-4 pb-2 text-[12px] text-green-400 font-bold">
              <span
                className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
                style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
              />
              ✓ Gana {pairLabel(scoreA > scoreB ? match.pairA : match.pairB)}
              {bySets && ` (${Math.max(scoreA, scoreB)} sets a ${Math.min(scoreA, scoreB)})`}
            </div>
          )}
        </div>
      )}

      {editingNow && (
        <MatchActions
          isEditing={isEditing}
          canSave={isValid}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={onDelete ? () => onDelete(match.id) : undefined}
          accentColor={accentColor}
        />
      )}
    </MatchShell>
  );
}

const maxSetsFor = (scoringFormat) => (scoringFormat === "sets5" ? 5 : 3);
