import { useState } from "react";
import { B } from "../../logic/constants";
import { advanceBracket } from "../../logic/relampago";
import { THeader, Tabs } from "../shared/Components";
import MatchCard from "../shared/MatchCard";
import PairStandings from "../shared/PairStandings";

export default function PlayRelampago({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("bracket");
  const [ls, setLs] = useState({});

  async function onSaveMatch(matchId, a, b) {
    const match = t.bracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = advanceBracket(t.bracket, matchId, a, b);
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
    await persist({ ...t, bracket: updated, pairs });
  }

  const winnerRounds = [
    ...new Set(
      t.bracket.filter((m) => m.bracket === "winners").map((m) => m.round),
    ),
  ].sort((a, b) => a - b);

  const consolRounds = [
    ...new Set(
      t.bracket.filter((m) => m.bracket === "consolation").map((m) => m.round),
    ),
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
      />
      <div style={{ padding: 16 }}>
        <Tabs
          tabs={[
            ["bracket", "⚡ Cuadro"],
            ["consolation", "🥈 Consolación"],
            ["standings", "🏆 Posiciones"],
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>

      <div style={{ padding: "0 16px" }}>
        {tab === "bracket" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {champion && (
              <div
                style={{
                  background: "#1e293b",
                  padding: 16,
                  borderRadius: 12,
                  textAlign: "center",
                  border: "2px solid #f59e0b",
                }}
              >
                <div style={{ fontSize: 24 }}>🏆</div>
                <div
                  style={{
                    color: "#f59e0b",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Campeón
                </div>
                <div
                  style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 18 }}
                >
                  {champion.p1} / {champion.p2}
                </div>
              </div>
            )}
            {winnerRounds.map((round) => (
              <div key={round}>
                <div
                  style={{
                    color: "#94a3b8",
                    fontWeight: 700,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    fontSize: 13,
                  }}
                >
                  {round === Math.max(...winnerRounds)
                    ? "Final"
                    : `Ronda ${round}`}
                </div>
                {t.bracket
                  .filter((m) => m.bracket === "winners" && m.round === round)
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={onSaveMatch}
                      accentColor="#7c3aed"
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        {tab === "consolation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {consolChampion && (
              <div
                style={{
                  background: "#1e293b",
                  padding: 16,
                  borderRadius: 12,
                  textAlign: "center",
                  border: "2px solid #94a3b8",
                }}
              >
                <div style={{ fontSize: 24 }}>🥈</div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Campeón Consolación
                </div>
                <div
                  style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 18 }}
                >
                  {consolChampion.p1} / {consolChampion.p2}
                </div>
              </div>
            )}
            {consolRounds.length === 0 && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "#1e293b",
                  borderRadius: 8,
                }}
              >
                El cuadro de consolación se activa cuando hay primeras rondas
                jugadas.
              </div>
            )}
            {consolRounds.map((round) => (
              <div key={round}>
                <div
                  style={{
                    color: "#94a3b8",
                    fontWeight: 700,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    fontSize: 13,
                  }}
                >
                  {round === Math.max(...consolRounds, 0)
                    ? "Final Consolación"
                    : `Consolación Ronda ${round}`}
                </div>
                {t.bracket
                  .filter(
                    (m) => m.bracket === "consolation" && m.round === round,
                  )
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={onSaveMatch}
                      accentColor="#0284c7"
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        {tab === "standings" && (
          <PairStandings pairs={t.pairs} title="Posiciones" />
        )}
      </div>
    </div>
  );
}
