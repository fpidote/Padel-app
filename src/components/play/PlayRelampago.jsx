// src/components/play/PlayRelampago.jsx
import { useState, Fragment } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, unadvanceBracket, canEditBracketMatch, countPlayed, bracketRoundName } from "../../logic/relampago";
import { analyzeSets } from "../../logic/sets";
import { applyMatchToPairs } from "../../logic/standings";
import { THeader, Tabs } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

const SLOT_HEIGHT = 110;
// Con sets la tarjeta abierta es más alta: más espacio por partido para que no tape a la vecina
const SLOT_HEIGHT_SETS = 220;

function BracketMatchCard({ match, isAdmin, ls, setLs, onSave, onEdit, canEdit = true, accentColor, scoringFormat = "games", onToggle }) {
  const [expanded, setExpandedState] = useState(false);
  function setExpanded(next) {
    setExpandedState(next);
    onToggle?.(next);
  }

  const isSetFormat = scoringFormat === "sets3" || scoringFormat === "sets5";
  const maxSets = scoringFormat === "sets5" ? 5 : 3;
  const setsNeeded = maxSets === 5 ? 3 : 2;

  // Sets cargados hasta ahora, validados con las reglas del pádel
  const live = analyzeSets(
    Array.from({ length: maxSets }, (_, i) => ({
      a: ls[`${match.id}_set${i}_A`] ?? "",
      b: ls[`${match.id}_set${i}_B`] ?? "",
    })),
    setsNeeded,
  );
  const visibleSetRows = live.finished ? live.sets.length : Math.min(live.sets.length + 1, maxSets);

  const isByeA = match.pairA?.id === "bye";
  const isByeB = match.pairB?.id === "bye";
  const nameA = isByeA ? "Pasa directo" : (match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "Por definir");
  const nameB = isByeB ? "Pasa directo" : (match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "Por definir");
  const isTBD = !match.pairA || !match.pairB;
  const isBye = isByeA || isByeB;

  const aVal = ls[`${match.id}_A`] ?? "";
  const bVal = ls[`${match.id}_B`] ?? "";
  const canSave = isSetFormat
    ? live.finished
    : aVal !== "" && bVal !== "" &&
      Number(aVal) >= 0 && Number(bVal) >= 0 &&
      Number(aVal) !== Number(bVal);

  const wonA = match.saved && match.winner?.id === match.pairA?.id;
  const wonB = match.saved && match.winner?.id === match.pairB?.id;

  if (isBye && !isTBD) {
    const realPairName = isByeA
      ? `${match.pairB.p1} / ${match.pairB.p2}`
      : `${match.pairA.p1} / ${match.pairA.p2}`;
    return (
      <div
        className="bg-[#1e293b] rounded-[10px] border-l-[3px] p-[10px_14px] select-none"
        style={{ borderLeftColor: accentColor }}
      >
        <div className="text-sm font-bold text-slate-100 mb-1">
          {realPairName}
        </div>
        <div className="text-[11px] text-slate-500">
          Exento — pasa directo
        </div>
      </div>
    );
  }

  function handleCardClick() {
    if (!isAdmin || isTBD || isBye || match.saved) return;
    setExpanded(!expanded);
  }

  function nameColor(isByePair, wonPair, hasPair) {
    if (isByePair) return "#334155";
    if (match.saved) return wonPair ? "#f1f5f9" : "#475569";
    return hasPair ? "#f1f5f9" : "#475569";
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-[#1e293b] rounded-[10px] border-l-[3px] p-[12px_14px] relative select-none"
      style={{
        borderLeftColor: accentColor,
        cursor: !isAdmin || isTBD || isBye || match.saved ? "default" : "pointer",
        // Abierta con sets desborda su slot: se ve como popover
        boxShadow: expanded && isSetFormat ? "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)" : undefined,
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
          <input
            type="number" min="0"
            value={aVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setLs((prev) => ({ ...prev, [`${match.id}_A`]: e.target.value }))}
            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
            className="w-9 h-7 rounded-md bg-[#0f172a] border border-[#334155] text-center text-sky-400 font-bold text-sm outline-none"
          />
        ) : (
          <span className="text-base font-extrabold min-w-7 text-right" style={{ color: match.saved ? (wonA ? "#4ade80" : "#475569") : "#334155" }}>
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
          <input
            type="number" min="0"
            value={bVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setLs((prev) => ({ ...prev, [`${match.id}_B`]: e.target.value }))}
            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
            className="w-9 h-7 rounded-md bg-[#0f172a] border border-[#334155] text-center text-sky-400 font-bold text-sm outline-none"
          />
        ) : (
          <span className="text-base font-extrabold min-w-7 text-right" style={{ color: match.saved ? (wonB ? "#4ade80" : "#475569") : "#334155" }}>
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
              <span className="w-9 text-[10px] font-bold text-slate-500">SET {i + 1}</span>
              {["A", "B"].map((side, si) => (
                <Fragment key={side}>
                  {si === 1 && <span className="font-bold text-slate-500">-</span>}
                  <input
                    type="number" min="0"
                    value={ls[`${match.id}_set${i}_${side}`] ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setLs((prev) => ({ ...prev, [`${match.id}_set${i}_${side}`]: e.target.value }))}
                    onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                    className={`w-9 h-7 rounded-md bg-[#0f172a] border text-center text-sm font-bold text-sky-400 outline-none ${live.errorIndex === i ? "border-red-500/60" : "border-[#334155]"}`}
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

      {expanded && canSave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isSetFormat) onSave(match.id, live.setsA, live.setsB, live.sets);
            else onSave(match.id, parseInt(aVal), parseInt(bVal));
            setExpanded(false);
          }}
          className="mt-2 w-full py-[5px] rounded-md text-white font-bold text-xs border-0 cursor-pointer"
          style={{ background: accentColor }}
        >
          ✓ Guardar
        </button>
      )}

      {match.saved && isAdmin && !isBye && (canEdit ? (
        <div
          onClick={(e) => { e.stopPropagation(); onEdit(match.id); }}
          className="mt-1.5 text-center text-[10px] text-slate-700 cursor-pointer"
        >
          ✏️ editar
        </div>
      ) : (
        <div className="mt-1.5 text-center text-[10px] text-slate-600">
          🔒 cerrado
        </div>
      ))}
    </div>
  );
}

function BracketView({ matches, isAdmin, ls, setLs, onSave, onEdit, canEditMatch = () => true, accentColor, scoringFormat }) {
  // La tarjeta abierta se eleva: con sets es más alta que su slot y se solaparía con la siguiente
  const [openId, setOpenId] = useState(null);
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
    <div className="flex flex-row overflow-x-auto items-start p-[16px_8px] min-h-[300px]">
      {rounds.map((round, ri) => {
        const roundMatches = matchesByRound[round];
        const label = bracketRoundName(round, maxRound);
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
                        match={match}
                        isAdmin={isAdmin}
                        ls={ls}
                        setLs={setLs}
                        onSave={onSave}
                        onEdit={onEdit}
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
  );
}

export default function PlayRelampago({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("bracket");
  const [ls, setLs] = useState({});

  async function onSaveMatch(matchId, a, b, sets) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updated = advanceBracket(t.bracket, matchId, a, b).map((m) =>
      m.id === matchId ? { ...m, sets: sets || null } : m,
    );

    setLs((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((k) => {
        if (k.startsWith(`${matchId}_`)) delete n[k];
      });
      return n;
    });
    const pairs = applyMatchToPairs(t.pairs, match, a, b, sets, 1);
    await persist({ ...t, bracket: updated, pairs, scoringStarted: true });
  }

  async function onEditMatch(matchId) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match) return;
    if (match.pairA?.id === "bye" || match.pairB?.id === "bye") return;
    if (!canEditBracketMatch(t.bracket, matchId)) return;

    const a = parseInt(match.scoreA);
    const b = parseInt(match.scoreB);
    const pairs = applyMatchToPairs(t.pairs, match, a, b, match.sets, -1);

    await persist({ ...t, bracket: unadvanceBracket(t.bracket, matchId), pairs });
  }

  const consolRounds = [
    ...new Set(t.bracket.filter((m) => m.bracket === "consolation").map((m) => m.round)),
  ].sort((a, b) => a - b);

  const champion = t.bracket.find(
    (m) => m.bracket === "winners" && !m.nextMatchId && m.saved,
  )?.winner;

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
            ["consolation", "🥈 Cuadro Revancha"],
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
            {champion && (
              <div className="bg-[#1e293b] p-4 rounded-xl text-center border-2 border-amber-500">
                <div className="text-2xl">🏆</div>
                <div className="text-amber-500 font-bold uppercase text-xs mb-1">
                  Campeón
                </div>
                <div className="text-slate-100 font-extrabold text-lg">
                  {champion.p1} / {champion.p2}
                </div>
              </div>
            )}
            <BracketView
              matches={t.bracket.filter((m) => m.bracket === "winners")}
              isAdmin={isAdmin}
              ls={ls}
              setLs={setLs}
              onSave={onSaveMatch}
              onEdit={onEditMatch}
              canEditMatch={(id) => canEditBracketMatch(t.bracket, id)}
              accentColor="#7c3aed"
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "consolation" && (
          <div className="flex flex-col gap-4">
            {consolChampion && (
              <div className="bg-[#1e293b] p-4 rounded-xl text-center border-2 border-slate-400">
                <div className="text-2xl">🥈</div>
                <div className="text-slate-400 font-bold uppercase text-xs mb-1">
                  Campeón Revancha
                </div>
                <div className="text-slate-100 font-extrabold text-lg">
                  {consolChampion.p1} / {consolChampion.p2}
                </div>
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
              canEditMatch={(id) => canEditBracketMatch(t.bracket, id)}
              accentColor="#0284c7"
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "standings" && (
          <PairStandings pairs={t.pairs.map((p) => ({ ...p, played: countPlayed(t.bracket, p.id) }))} title="Posiciones" scoringFormat={t.config?.scoringFormat} config={t.config} />
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
    </div>
  );
}
