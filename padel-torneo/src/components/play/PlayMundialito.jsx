// src/components/play/PlayRelampago.jsx
import { useState } from "react";
import { B, TOURNAMENT_RULES } from "../../logic/constants";
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

  // 👇 NUEVA FUNCIÓN PARA DESHACER Y EDITAR EL PARTIDO
  async function onEditMatch(matchId) {
    const updatedBracket = t.bracket.map((m) => ({ ...m }));
    const match = updatedBracket.find((m) => m.id === matchId);
    if (!match) return;

    // 1. Quitar los puntos e historial de juegos de las estadísticas globales
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

    // 2. Deshacer el avance automático en las siguientes llaves del cuadro
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

    // 3. Limpiar los datos del partido actual
    match.scoreA = "";
    match.scoreB = "";
    match.saved = false;
    match.winner = null;
    match.loser = null;

    await persist({ ...t, bracket: updatedBracket, pairs });
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
            ["rules", "📖 Reglas"], // 👇 AÑADIMOS LA PESTAÑA DE REGLAS
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
                      onEdit={onEditMatch} // 👇 PROP DE EDICIÓN AÑADIDA AQUÍ
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
                      onEdit={onEditMatch} // 👇 PROP DE EDICIÓN AÑADIDA AQUÍ
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

        {/* 👇 NUEVA PESTAÑA VISUAL PARA LAS REGLAS */}
        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#38bdf8",
                marginBottom: 16,
              }}
            >
              Reglas del Torneo Relámpago
            </h3>
            <ul
              style={{
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: "1.6",
                paddingLeft: 20,
                listStyleType: "disc",
              }}
            >
              {TOURNAMENT_RULES.relampago.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
