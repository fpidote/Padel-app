// src/components/play/PlayRelampago.jsx
import { useState, Fragment } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, countPlayed } from "../../logic/relampago";
import { analyzeSets } from "../../logic/sets";
import { applyMatchToPairs } from "../../logic/standings";
import { THeader, Tabs } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

const SLOT_HEIGHT = 110;

function BracketMatchCard({ match, isAdmin, ls, setLs, onSave, onEdit, accentColor, scoringFormat = "games", onToggle }) {
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
  const nameA = isByeA ? "BYE" : (match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD");
  const nameB = isByeB ? "BYE" : (match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD");
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
        style={{
          background: "#1e293b",
          borderRadius: 10,
          borderLeft: `3px solid ${accentColor}`,
          padding: "10px 14px",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
          {realPairName}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
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
      style={{
        background: "#1e293b",
        borderRadius: 10,
        borderLeft: `3px solid ${accentColor}`,
        padding: "12px 14px",
        cursor: !isAdmin || isTBD || isBye || match.saved ? "default" : "pointer",
        position: "relative",
        userSelect: "none",
        // Abierta con sets desborda su slot: se ve como popover
        boxShadow: expanded && isSetFormat ? "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)" : undefined,
      }}
    >
      {match.saved && (
        <div style={{ position: "absolute", top: 5, right: 8, fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
          ✓
        </div>
      )}

      {/* Fila A */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          fontStyle: isByeA ? "italic" : "normal",
          color: nameColor(isByeA, wonA, !!match.pairA),
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, marginRight: 6,
        }}>
          {nameA}
        </span>
        {expanded && !isSetFormat ? (
          <input
            type="number" min="0"
            value={aVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setLs((prev) => ({ ...prev, [`${match.id}_A`]: e.target.value }))}
            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
            style={{ width: 36, height: 28, borderRadius: 6, background: "#0f172a", border: "1px solid #334155", textAlign: "center", color: "#38bdf8", fontWeight: 700, fontSize: 14, outline: "none" }}
          />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 800, color: match.saved ? (wonA ? "#4ade80" : "#475569") : "#334155", minWidth: 28, textAlign: "right" }}>
            {expanded && isSetFormat ? live.setsA : match.saved ? match.scoreA : "–"}
          </span>
        )}
      </div>

      {/* Fila B */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          fontStyle: isByeB ? "italic" : "normal",
          color: nameColor(isByeB, wonB, !!match.pairB),
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, marginRight: 6,
        }}>
          {nameB}
        </span>
        {expanded && !isSetFormat ? (
          <input
            type="number" min="0"
            value={bVal}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setLs((prev) => ({ ...prev, [`${match.id}_B`]: e.target.value }))}
            onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
            style={{ width: 36, height: 28, borderRadius: 6, background: "#0f172a", border: "1px solid #334155", textAlign: "center", color: "#38bdf8", fontWeight: 700, fontSize: 14, outline: "none" }}
          />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 800, color: match.saved ? (wonB ? "#4ade80" : "#475569") : "#334155", minWidth: 28, textAlign: "right" }}>
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
          style={{ marginTop: 8, width: "100%", padding: "5px 0", borderRadius: 6, background: accentColor, color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer" }}
        >
          ✓ Guardar
        </button>
      )}

      {match.saved && isAdmin && !isBye && (
        <div
          onClick={(e) => { e.stopPropagation(); onEdit(match.id); }}
          style={{ marginTop: 5, textAlign: "center", fontSize: 10, color: "#334155", cursor: "pointer" }}
        >
          ✏️ editar
        </div>
      )}
    </div>
  );
}

function BracketView({ matches, isAdmin, ls, setLs, onSave, onEdit, accentColor, scoringFormat }) {
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
  const containerHeight = Math.max(r1Count * SLOT_HEIGHT, 100);
  const LABEL_H = 26;

  function matchCenterY(total, idx) {
    return containerHeight * (2 * idx + 1) / (2 * total);
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", overflowX: "auto", alignItems: "flex-start", paddingBottom: 16, padding: "16px 8px", minHeight: 300 }}>
      {rounds.map((round, ri) => {
        const roundMatches = matchesByRound[round];
        const isLastRound = round === maxRound;
        const label = isLastRound ? "Final" : `Ronda ${round}`;
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
            <div style={{ width: 32, flexShrink: 0, marginTop: LABEL_H }}>
              <svg width="32" height={containerHeight} style={{ display: "block" }}>
                {lines}
              </svg>
            </div>
          );
        }

        return (
          <Fragment key={round}>
            <div style={{ display: "flex", flexDirection: "column", width: 240, flexShrink: 0 }}>
              <div style={{ height: LABEL_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {label}
                </span>
              </div>
              <div style={{ height: containerHeight, position: "relative" }}>
                {roundMatches.map((match, mi) => {
                  if (match.pairA?.id === "bye" && match.pairB?.id === "bye") return null;
                  const centerY = matchCenterY(roundMatches.length, mi);
                  return (
                    <div
                      key={match.id}
                      className={openId === match.id ? "z-20" : "z-[1]"}
                      style={{ position: "absolute", top: centerY, left: 0, right: 0, transform: "translateY(-50%)" }}
                    >
                      <BracketMatchCard
                        match={match}
                        isAdmin={isAdmin}
                        ls={ls}
                        setLs={setLs}
                        onSave={onSave}
                        onEdit={onEdit}
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
    const updatedBracket = t.bracket.map((m) => ({ ...m }));
    const match = updatedBracket.find((m) => m.id === matchId);
    if (!match) return;
    if (match.pairA?.id === "bye" || match.pairB?.id === "bye") return;

    const a = parseInt(match.scoreA);
    const b = parseInt(match.scoreB);
    const pairs = applyMatchToPairs(t.pairs, match, a, b, match.sets, -1);

    if (match.nextMatchId && match.winner) {
      const nextM = updatedBracket.find((m) => m.id === match.nextMatchId);
      if (nextM) {
        if (nextM.pairA?.id === match.winner.id) nextM.pairA = null;
        if (nextM.pairB?.id === match.winner.id) nextM.pairB = null;
      }
    }
    if (match.loserMatchId && match.loser) {
      const consM = updatedBracket.find((m) => m.id === match.loserMatchId);
      if (consM) {
        if (consM.pairA?.id === match.loser.id) consM.pairA = null;
        if (consM.pairB?.id === match.loser.id) consM.pairB = null;
      }
    }

    match.saved = false;

    await persist({ ...t, bracket: updatedBracket, pairs });
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
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle="Cuadro de eliminación"
        onEdit={isAdmin ? onEditTournament : undefined}
      />
      <div style={{ padding: 16 }}>
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

      <div style={{ padding: "0 16px" }}>
        {tab === "bracket" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {champion && (
              <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, textAlign: "center", border: "2px solid #f59e0b" }}>
                <div style={{ fontSize: 24 }}>🏆</div>
                <div style={{ color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>
                  Campeón
                </div>
                <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 18 }}>
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
              accentColor="#7c3aed"
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "consolation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {consolChampion && (
              <div style={{ background: "#1e293b", padding: 16, borderRadius: 12, textAlign: "center", border: "2px solid #94a3b8" }}>
                <div style={{ fontSize: 24 }}>🥈</div>
                <div style={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>
                  Campeón Revancha
                </div>
                <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 18 }}>
                  {consolChampion.p1} / {consolChampion.p2}
                </div>
              </div>
            )}
            {consolRounds.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", background: "#1e293b", borderRadius: 8 }}>
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
              accentColor="#0284c7"
              scoringFormat={t.config?.scoringFormat || "games"}
            />
          </div>
        )}

        {tab === "standings" && (
          <PairStandings pairs={t.pairs.map((p) => ({ ...p, played: countPlayed(t.bracket, p.id) }))} title="Posiciones" scoringFormat={t.config?.scoringFormat} />
        )}

        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginBottom: 16 }}>
              Reglas del Torneo Relámpago
            </h3>
            <ul style={{ color: "#cbd5e1", fontSize: 14, lineHeight: "1.6", paddingLeft: 20, listStyleType: "disc" }}>
              {generateRules(t.type, t.config).map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
