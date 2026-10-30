// src/components/play/PlayRelampago.jsx
import { useState, useRef, useEffect, Fragment } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, canEditBracketMatch, countPlayed, bracketRoundName, relampagoPodium, relampagoCanFinish, relampagoRankingOrder, startEditBracketMatch, cancelEditBracketMatch, correctBracketMatch, adminBracketMatchView } from "../../logic/relampago";
import { matchScoreState, isSetsFormat } from "../../logic/matchScore";
import { ScoreInput } from "../shared/match/ScoreBox";
import { blockNonIntegerKey, goToNextScore } from "../../logic/scoreInput";
import { applyMatchToPairs } from "../../logic/standings";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import PairStandings from "../shared/PairStandings";
import { sortStandings } from "../../logic/standings";
import PodiumCard from "../shared/PodiumCard";
import { showToast } from "../../logic/toast";

const SLOT_HEIGHT = 110;
// Con sets la tarjeta abierta es más alta: más espacio por partido para que no tape a la vecina
const SLOT_HEIGHT_SETS = 220;

function BracketMatchCard({ match, isAdmin, ls, setLs, onSave, onEdit, onCancel, finished = false, canEdit = true, accentColor, scoringFormat = "games", onToggle }) {
  const [expanded, setExpandedState] = useState(false);
  function setExpanded(next) {
    setExpandedState(next);
    onToggle?.(next);
  }

  const isSetFormat = isSetsFormat(scoringFormat);

  // Al corregir un resultado la tarjeta se abre con lo que había escrito (también tras recargar)
  const editing = isAdmin && !!match.editing;
  useEffect(() => {
    if (!editing) return;
    setExpandedState(true);
    onToggle?.(true);
    setLs((prev) => {
      const next = { ...prev };
      if (isSetFormat) {
        (match.sets || []).forEach((set, i) => {
          if (next[`${match.id}_set${i}_A`] === undefined) next[`${match.id}_set${i}_A`] = String(set.a);
          if (next[`${match.id}_set${i}_B`] === undefined) next[`${match.id}_set${i}_B`] = String(set.b);
        });
      } else {
        if (next[`${match.id}_A`] === undefined) next[`${match.id}_A`] = String(match.scoreA);
        if (next[`${match.id}_B`] === undefined) next[`${match.id}_B`] = String(match.scoreB);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Sets (o games) cargados hasta ahora, validados con las reglas del pádel
  const aVal = ls[`${match.id}_A`] ?? "";
  const bVal = ls[`${match.id}_B`] ?? "";
  const { live, visibleSetRows, gamesError, isValid: canSave } = matchScoreState(scoringFormat, {
    setRows: Array.from({ length: 5 }, (_, i) => ({
      a: ls[`${match.id}_set${i}_A`] ?? "",
      b: ls[`${match.id}_set${i}_B`] ?? "",
    })),
    gamesA: aVal,
    gamesB: bVal,
  });

  const isByeA = match.pairA?.id === "bye";
  const isByeB = match.pairB?.id === "bye";
  const nameA = isByeA ? "Pasa directo" : (match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "Por definir");
  const nameB = isByeB ? "Pasa directo" : (match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "Por definir");
  const isTBD = !match.pairA || !match.pairB;
  const isBye = isByeA || isByeB;

  const wonA = match.saved && match.winner?.id === match.pairA?.id;
  const wonB = match.saved && match.winner?.id === match.pairB?.id;

  if (isBye && !isTBD) {
    const realPairName = isByeA
      ? `${match.pairB.p1} / ${match.pairB.p2}`
      : `${match.pairA.p1} / ${match.pairA.p2}`;
    return (
      <div
        className="bg-[#1f2937] rounded-xl border border-[#374151] border-l-[3px] p-[10px_14px] select-none"
        style={{ borderLeftColor: accentColor }}
      >
        <div className="text-sm font-bold text-slate-100 mb-1">
          {realPairName}
        </div>
        <div className="text-[11px] text-slate-500">
          Pasa directo a la siguiente ronda
        </div>
      </div>
    );
  }

  function save() {
    if (isSetFormat) onSave(match.id, live.setsA, live.setsB, live.sets);
    else onSave(match.id, parseInt(aVal), parseInt(bVal));
    setExpanded(false);
  }

  // Sin signos ni decimales en el marcador; Enter guarda cuando el resultado ya es válido y si no pasa a la casilla siguiente
  function onScoreKey(e) {
    if (["-", "e", ".", ","].includes(e.key)) blockNonIntegerKey(e);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (canSave) save();
      else goToNextScore(e.currentTarget);
    }
  }

  function handleCardClick() {
    if (!isAdmin || isTBD || isBye || match.saved) return;
    setExpanded(!expanded);
  }

  function nameColor(isByePair, wonPair, hasPair) {
    if (isByePair) return "#334155";
    if (match.saved) return wonPair ? "#f1f5f9" : "#94a3b8";
    return hasPair ? "#f1f5f9" : "#94a3b8";
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-[#1f2937] rounded-xl border border-[#374151] border-l-[3px] p-[12px_14px] relative select-none"
      style={{
        borderLeftColor: accentColor,
        cursor: !isAdmin || isTBD || isBye || match.saved ? "default" : "pointer",
        // Abierta puede desbordar su slot: se ve como popover
        boxShadow: expanded ? "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)" : undefined,
      }}
    >
      {match.saved && (
        <div className="absolute top-[5px] right-2 text-[10px] text-green-400 font-bold">
          ✓
        </div>
      )}

      {/* Fila A */}
      <div className="flex justify-between items-center mb-1.5">
        <span
          className="text-sm font-bold overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-1.5"
          style={{ fontStyle: isByeA ? "italic" : "normal", color: nameColor(isByeA, wonA, !!match.pairA) }}
        >
          {nameA}
        </span>
        {expanded && !isSetFormat ? (
          <ScoreInput
            size="set"
            accentColor={accentColor}
            value={aVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(v) => setLs((prev) => ({ ...prev, [`${match.id}_A`]: v }))}
            onKeyDown={onScoreKey}
            data-score="" enterKeyHint="next"
          />
        ) : (
          <span className="text-base font-extrabold min-w-7 text-right" style={{ color: match.saved ? (wonA ? "#4ade80" : "#94a3b8") : "#334155" }}>
            {expanded && isSetFormat ? live.setsA : match.saved ? match.scoreA : "–"}
          </span>
        )}
      </div>

      {/* Fila B */}
      <div className="flex justify-between items-center">
        <span
          className="text-sm font-bold overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-1.5"
          style={{ fontStyle: isByeB ? "italic" : "normal", color: nameColor(isByeB, wonB, !!match.pairB) }}
        >
          {nameB}
        </span>
        {expanded && !isSetFormat ? (
          <ScoreInput
            size="set"
            accentColor={accentColor}
            value={bVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(v) => setLs((prev) => ({ ...prev, [`${match.id}_B`]: v }))}
            onKeyDown={onScoreKey}
            data-score="" enterKeyHint="next"
          />
        ) : (
          <span className="text-base font-extrabold min-w-7 text-right" style={{ color: match.saved ? (wonB ? "#4ade80" : "#94a3b8") : "#334155" }}>
            {expanded && isSetFormat ? live.setsB : match.saved ? match.scoreB : "–"}
          </span>
        )}
      </div>

      {match.saved && isSetFormat && match.sets?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-400">
          {match.sets.map((set, i) => (
            <span key={i} className="bg-[#0f172a] px-1.5 py-px rounded">
              {set.a}-{set.b}
            </span>
          ))}
        </div>
      )}

      {expanded && isSetFormat && (
        <div className="mt-2 flex flex-col gap-1.5">
          {Array.from({ length: visibleSetRows }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-9 text-[10px] font-bold text-gray-500">SET {i + 1}</span>
              {["A", "B"].map((side, si) => (
                <Fragment key={side}>
                  {si === 1 && <span className="font-bold text-slate-500">-</span>}
                  <ScoreInput
                    size="set"
                    accentColor={accentColor}
                    error={live.errorIndex === i}
                    value={ls[`${match.id}_set${i}_${side}`] ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(v) => setLs((prev) => ({ ...prev, [`${match.id}_set${i}_${side}`]: v }))}
                    onKeyDown={onScoreKey}
                    data-score="" enterKeyHint="next"
                  />
                </Fragment>
              ))}
            </div>
          ))}
          {live.error && (
            <p className="text-[11px] font-semibold text-red-400">
              ⚠️ Set {live.errorIndex + 1}: {live.error}
            </p>
          )}
        </div>
      )}

      {expanded && gamesError && (
        <p data-testid="games-error" className="mt-1.5 text-[11px] font-semibold text-amber-400">⚠️ {gamesError}</p>
      )}

      {(editing || expanded) && (
        <div className="mt-2 flex gap-2">
          {editing && (
            <button
              type="button"
              data-testid="btn-cancelar-edicion"
              onClick={(e) => { e.stopPropagation(); onCancel(match.id); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-600 text-white cursor-pointer border-0"
            >
              ✕ Cancelar
            </button>
          )}
          {expanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                save();
              }}
              disabled={!canSave}
              data-score-save=""
              className={`flex-1 py-2.5 rounded-xl text-xs font-black border-0 ${canSave ? "text-white cursor-pointer" : "bg-white/[0.04] text-slate-600"}`}
              style={canSave ? { background: accentColor } : undefined}
            >
              {editing ? "Guardar" : "Guardar resultado"}
            </button>
          )}
        </div>
      )}

      {match.saved && isAdmin && !isBye && (canEdit ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(match.id); }}
          className="mt-2 w-full py-1.5 rounded-lg text-center text-xs font-semibold text-gray-400 hover:text-gray-200 bg-white/[0.06] hover:bg-white/10 border-0 cursor-pointer transition-colors"
        >
          ✏️ Editar
        </button>
      ) : (
        <div className="mt-1.5 text-center text-[10px] leading-snug text-slate-500">
          {finished ? "🔒 Cerrado" : "🔒 Cerrado: ya se jugó el partido siguiente. Corrige primero ese."}
        </div>
      ))}
    </div>
  );
}

function BracketView({ matches, isAdmin, ls, setLs, onSave, onEdit, onCancel, finished, isRematch = false, canEditMatch = () => true, accentColor, scoringFormat }) {
  // La tarjeta abierta se eleva: con sets es más alta que su slot y se solaparía con la siguiente
  const [openId, setOpenId] = useState(null);
  const scrollRef = useRef(null);
  const [canScrollMore, setCanScrollMore] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const check = () => setCanScrollMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [matches.length]);
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  if (rounds.length === 0) return null;

  const maxRound = rounds[rounds.length - 1];
  const matchesByRound = {};
  rounds.forEach((r) => {
    matchesByRound[r] = matches
      .filter((m) => m.round === r)
      .sort((a, b) => a.matchIndex - b.matchIndex);
  });

  const r1Count = matchesByRound[rounds[0]].length;
  const isSetFormat = scoringFormat === "sets3" || scoringFormat === "sets5";
  const containerHeight = Math.max(r1Count * (isSetFormat ? SLOT_HEIGHT_SETS : SLOT_HEIGHT), 100);

  function matchCenterY(total, idx) {
    return containerHeight * (2 * idx + 1) / (2 * total);
  }

  return (
    <>
    {canScrollMore && (
      <div data-testid="bracket-scroll-hint" className="text-center text-[11px] font-semibold text-slate-400">
        Desliza → para ver el resto del cuadro
      </div>
    )}
    <div ref={scrollRef} className="flex flex-row overflow-x-auto items-start p-[16px_8px] min-h-[300px]">
      {rounds.map((round, ri) => {
        const roundMatches = matchesByRound[round];
        const label = isRematch && round >= maxRound - 1 ? `${bracketRoundName(round, maxRound)} de la revancha` : bracketRoundName(round, maxRound);
        const nextRound = ri < rounds.length - 1 ? rounds[ri + 1] : null;
        const nextRoundMatches = nextRound ? matchesByRound[nextRound] : null;

        let connectorEl = null;
        if (nextRoundMatches) {
          const groups = {};
          roundMatches.forEach((m, mi) => {
            if (!m.nextMatchId) return;
            const dstIdx = nextRoundMatches.findIndex((nm) => nm.id === m.nextMatchId);
            if (dstIdx < 0) return;
            if (!groups[m.nextMatchId]) groups[m.nextMatchId] = { dstIdx, srcIdxs: [] };
            groups[m.nextMatchId].srcIdxs.push(mi);
          });

          const lines = [];
          Object.entries(groups).forEach(([, { dstIdx, srcIdxs }]) => {
            const dstY = matchCenterY(nextRoundMatches.length, dstIdx);
            const srcYs = srcIdxs.map((si) => matchCenterY(roundMatches.length, si));
            const minSrcY = Math.min(...srcYs);
            const maxSrcY = Math.max(...srcYs);
            const midY = (minSrcY + maxSrcY) / 2;

            srcYs.forEach((sy, i) => {
              lines.push(<line key={`h${dstIdx}-${i}`} x1="0" y1={sy} x2="16" y2={sy} stroke="#334155" strokeWidth="1.5" />);
            });
            if (srcYs.length > 1) {
              lines.push(<line key={`v${dstIdx}`} x1="16" y1={minSrcY} x2="16" y2={maxSrcY} stroke="#334155" strokeWidth="1.5" />);
            }
            lines.push(<line key={`hd${dstIdx}`} x1="16" y1={midY} x2="32" y2={dstY} stroke="#334155" strokeWidth="1.5" />);
          });

          connectorEl = (
            <div className="w-8 shrink-0 mt-[26px]">
              <svg width="32" height={containerHeight} className="block">
                {lines}
              </svg>
            </div>
          );
        }

        return (
          <Fragment key={round}>
            <div className="flex flex-col w-60 shrink-0">
              <div className="h-[26px] flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                  {label}
                </span>
              </div>
              <div className="relative" style={{ height: containerHeight }}>
                {roundMatches.map((match, mi) => {
                  if (match.pairA?.id === "bye" && match.pairB?.id === "bye") return null;
                  const centerY = matchCenterY(roundMatches.length, mi);
                  return (
                    <div
                      key={match.id}
                      className={`absolute left-0 right-0 -translate-y-1/2 ${openId === match.id ? "z-20" : "z-[1]"}`}
                      style={{ top: centerY }}
                    >
                      <BracketMatchCard
                        match={isAdmin ? adminBracketMatchView(match) : match}
                        isAdmin={isAdmin}
                        ls={ls}
                        setLs={setLs}
                        onSave={onSave}
                        onEdit={onEdit}
                        onCancel={onCancel}
                        finished={finished}
                        canEdit={canEditMatch(match.id)}
                        accentColor={accentColor}
                        scoringFormat={scoringFormat}
                        onToggle={(open) => setOpenId(open ? match.id : null)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {connectorEl}
          </Fragment>
        );
      })}
    </div>
    </>
  );
}

export default function PlayRelampago({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("bracket");
  const [ls, setLs] = useState({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const finished = t.status === "finished";

  async function onSaveMatch(matchId, a, b, sets) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match || (match.saved && !match.editing)) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    setLs((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => {
        if (k.startsWith(`${matchId}_`)) delete n[k];
      });
      return n;
    });

    if (match.editing) {
      // Corrección: se quitan las estadísticas del resultado anterior y se suman las del nuevo, todo de una vez
      const quitadas = applyMatchToPairs(t.pairs, match, parseInt(match.scoreA), parseInt(match.scoreB), match.sets, -1);
      const pairs = applyMatchToPairs(quitadas, match, a, b, sets, 1);
      await persist({ ...t, bracket: correctBracketMatch(t.bracket, matchId, a, b, sets), pairs });
      return;
    }

    const updated = advanceBracket(t.bracket, matchId, a, b).map((m) =>
      m.id === matchId ? { ...m, sets: sets || null } : m,
    );
    const pairs = applyMatchToPairs(t.pairs, match, a, b, sets, 1);
    await persist({ ...t, bracket: updated, pairs, scoringStarted: true });
  }

  // Corregir: la tarjeta sigue guardada para todos hasta que se guarde la corrección
  async function onEditMatch(matchId) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match) return;
    if (match.pairA?.id === "bye" || match.pairB?.id === "bye") return;
    if (finished || !canEditBracketMatch(t.bracket, matchId)) return;
    await persist({ ...t, bracket: startEditBracketMatch(t.bracket, matchId) });
  }

  async function onCancelEdit(matchId) {
    setLs((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => {
        if (k.startsWith(`${matchId}_`)) delete n[k];
      });
      return n;
    });
    await persist({ ...t, bracket: cancelEditBracketMatch(t.bracket, matchId) });
  }

  async function onFinishTournament() {
    setConfirmFinish(false);
    if (!relampagoCanFinish(t)) return;
    try {
      await persist({ ...t, status: "finished" });
    } catch (err) {
      console.error("Error al finalizar el torneo:", err);
      showToast("No se pudo finalizar el torneo. Inténtalo de nuevo.");
    }
  }

  const consolRounds = [
    ...new Set(t.bracket.filter((m) => m.bracket === "consolation").map((m) => m.round)),
  ].sort((a, b) => a - b);

  const champion = t.bracket.find(
    (m) => m.bracket === "winners" && !m.nextMatchId && m.saved,
  )?.winner;

  const podium = relampagoPodium(t.bracket);
  const hasConsolation = t.bracket.some((m) => m.bracket === "consolation");

  const consolChampion = t.bracket.find(
    (m) => m.bracket === "consolation" && !m.nextMatchId && m.saved,
  )?.winner;

  return (
    <div className="pb-20">
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle="Cuadro de eliminación"
        onEdit={isAdmin ? onEditTournament : undefined}
      />
      <div className="p-4">
        <Tabs
          tabs={[
            ["bracket", "⚡ Cuadro"],
            ["consolation", "🥉 Revancha"],
            ["standings", "🏆 Posiciones"],
            ["rules", "📖 Reglas"],
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>

      <div className="px-4">
        {tab === "bracket" && (
          <div className="flex flex-col gap-4">
            {podium.champion && (
              <PodiumCard podium={podium} hasThird={hasConsolation} thirdLabel="Ganador de la revancha" finished={finished} />
            )}
            {isAdmin && relampagoCanFinish(t) && (
              <button
                onClick={() => setConfirmFinish(true)}
                className="w-full bg-[#10b981] text-white font-bold rounded-xl py-4 text-base cursor-pointer border-0"
              >
                🏁 Finalizar torneo
              </button>
            )}
            {isAdmin && champion && !finished && !relampagoCanFinish(t) && (
              <div className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-400 text-center">
                Para finalizar el torneo falta jugar la revancha.
              </div>
            )}
            {finished && (
              <div className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-400 text-center">
                🏁 Torneo finalizado: los resultados están cerrados.
              </div>
            )}
            <BracketView
              matches={t.bracket.filter((m) => m.bracket === "winners")}
              isAdmin={isAdmin}
              ls={ls}
              setLs={setLs}
              onSave={onSaveMatch}
              onEdit={onEditMatch}
              onCancel={onCancelEdit}
              finished={finished}
              canEditMatch={(id) => !finished && canEditBracketMatch(t.bracket, id)}
              accentColor="#7c3aed"
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "consolation" && (
          <div className="flex flex-col gap-4">
            {consolChampion && (
              <div className="bg-[#1e293b] p-4 rounded-xl text-center border-2 border-slate-400">
                <div className="text-2xl">🥉</div>
                <div className="text-slate-400 font-bold uppercase text-xs mb-1">
                  Ganador de la revancha
                </div>
                <div className="text-slate-100 font-extrabold text-lg">
                  {consolChampion.p1} / {consolChampion.p2}
                </div>
              </div>
            )}
            {isAdmin && relampagoCanFinish(t) && (
              <div data-testid="aviso-puedes-finalizar" className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-300 text-center">
                ✅ Ya se jugó todo: puedes finalizar el torneo desde la pestaña Cuadro.
              </div>
            )}
            {consolRounds.length === 0 && (
              <div className="p-5 text-center text-slate-400 bg-[#1e293b] rounded-lg">
                El cuadro de Revancha se activa cuando hay primeras rondas jugadas.
              </div>
            )}
            <BracketView
              matches={t.bracket.filter((m) => m.bracket === "consolation")}
              isAdmin={isAdmin}
              ls={ls}
              setLs={setLs}
              onSave={onSaveMatch}
              onEdit={onEditMatch}
              onCancel={onCancelEdit}
              finished={finished}
              canEditMatch={(id) => !finished && canEditBracketMatch(t.bracket, id)}
              accentColor="#0284c7"
              isRematch
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "standings" && (
          <>
            <PodiumCard
              podium={podium}
              hasThird={hasConsolation}
              thirdLabel="Ganador de la revancha"
              finished={finished}
            />
            <PairStandings
              pairs={relampagoRankingOrder(t.bracket, sortStandings(t.pairs.map((p) => ({ ...p, played: countPlayed(t.bracket, p.id) })), []))}
              title="Estadísticas de las parejas"
              scoringFormat={t.config?.scoringFormat}
              config={t.config}
              medals={false}
              numbered={false}
              presorted
            />
          </>
        )}

        {tab === "rules" && (
          <div className="bg-[#1e293b] p-5 rounded-xl">
            <h3 className="text-lg font-extrabold text-sky-400 mb-4">
              Reglas del Torneo Relámpago
            </h3>
            <ul className="text-slate-300 text-sm leading-[1.6] pl-5 list-disc">
              {generateRules(t.type, t.config).map((rule, i) => (
                <li key={i} className="mb-2">{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {confirmFinish && (
        <SimpleModal
          icon="🏁"
          message="Al finalizar el torneo los resultados se cierran y ya no se podrán modificar. ¿Finalizar el torneo?"
          confirmLabel="Finalizar"
          onClose={() => setConfirmFinish(false)}
          onConfirm={onFinishTournament}
        />
      )}
    </div>
  );
}
