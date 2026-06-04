// src/components/play/PlayRelampago.jsx
import { useState, Fragment } from "react";
import { TOURNAMENT_RULES } from "../../logic/constants";
import { advanceBracket } from "../../logic/relampago";
import { THeader, Tabs } from "../shared/Components";
import PairStandings from "../shared/PairStandings";

const SLOT_HEIGHT = 110;

function BracketMatchCard({ match, isAdmin, ls, setLs, onSave, onEdit, accentColor }) {
  const [expanded, setExpanded] = useState(false);

  const isByeA = match.pairA?.id === "bye";
  const isByeB = match.pairB?.id === "bye";
  const nameA = isByeA ? "BYE" : (match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD");
  const nameB = isByeB ? "BYE" : (match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD");
  const isTBD = !match.pairA || !match.pairB;
  const isBye = isByeA || isByeB;

  const aVal = ls[`${match.id}_A`] ?? "";
  const bVal = ls[`${match.id}_B`] ?? "";
  const canSave =
    aVal !== "" && bVal !== "" &&
    Number(aVal) >= 0 && Number(bVal) >= 0 &&
    Number(aVal) !== Number(bVal);

  const wonA = match.saved && match.winner?.id === match.pairA?.id;
  const wonB = match.saved && match.winner?.id === match.pairB?.id;

  function handleCardClick() {
    if (!isAdmin || isTBD || isBye || match.saved) return;
    setExpanded((e) => !e);
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
        {expanded ? (
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
            {match.saved ? match.scoreA : "–"}
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
        {expanded ? (
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
            {match.saved ? match.scoreB : "–"}
          </span>
        )}
      </div>

      {expanded && canSave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave(match.id, parseInt(aVal), parseInt(bVal));
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

function BracketView({ matches, isAdmin, ls, setLs, onSave, onEdit, accentColor }) {
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
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    const pairs = [...t.pairs];
    const wPair = a > b ? match.pairA : match.pairB;
    const lPair = a > b ? match.pairB : match.pairA;
    [wPair, lPair].forEach((pair, pi) => {
      if (!pair) return;
      const idx = pairs.findIndex((p) => p.id === pair.id);
      if (idx < 0) return;
      pairs[idx] = {
        ...pairs[idx],
        pts: pairs[idx].pts + (pi === 0 ? 1 : 0),
        gf: pairs[idx].gf + (pi === 0 ? a : b),
        gc: pairs[idx].gc + (pi === 0 ? b : a),
      };
    });
    await persist({ ...t, bracket: updated, pairs, scoringStarted: true });
  }

  async function onEditMatch(matchId) {
    const updatedBracket = t.bracket.map((m) => ({ ...m }));
    const match = updatedBracket.find((m) => m.id === matchId);
    if (!match) return;
    if (match.pairA?.id === "bye" || match.pairB?.id === "bye") return;

    const a = parseInt(match.scoreA);
    const b = parseInt(match.scoreB);
    const pairs = [...t.pairs];
    const wPair = a > b ? match.pairA : match.pairB;
    const lPair = a > b ? match.pairB : match.pairA;
    [wPair, lPair].forEach((pair, pi) => {
      if (!pair) return;
      const idx = pairs.findIndex((p) => p.id === pair.id);
      if (idx >= 0) {
        pairs[idx] = {
          ...pairs[idx],
          pts: pairs[idx].pts - (pi === 0 ? 1 : 0),
          gf: pairs[idx].gf - (pi === 0 ? a : b),
          gc: pairs[idx].gc - (pi === 0 ? b : a),
        };
      }
    });

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
            />
          </div>
        )}

        {tab === "standings" && (
          <PairStandings pairs={t.pairs} title="Posiciones" />
        )}

        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginBottom: 16 }}>
              Reglas del Torneo Relámpago
            </h3>
            <ul style={{ color: "#cbd5e1", fontSize: 14, lineHeight: "1.6", paddingLeft: 20, listStyleType: "disc" }}>
              {TOURNAMENT_RULES.relampago.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
