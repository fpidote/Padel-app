// src/components/play/PlayMundialito.jsx
import { useState } from "react";
import { B, TOURNAMENT_RULES } from "../../logic/constants";
import { advanceBracket } from "../../logic/relampago";
import { buildKnockoutFromGroups } from "../../logic/mundialito";
import { THeader, Tabs } from "../shared/Components";
import MatchCard from "../shared/MatchCard";
import PairStandings from "../shared/PairStandings";

export default function PlayMundialito({
  t,
  code,
  isAdmin,
  persist,
  copyCode,
}) {
  const [tab, setTab] = useState("groups");
  const [ls, setLs] = useState({});

  const isSetFormat =
    t.config?.scoringFormat === "sets3" || t.config?.scoringFormat === "sets5";

  // 👇 Aseguramos que todos los partidos tengan un "round" calculado
  const groupsWithRounds = (t.groups || []).map((g) => {
    const roundsUsed = []; // para llevar registro de qué parejas juegan en cada ronda
    const newMatches = (g.matches || []).map((m) => ({ ...m })); // copia de partidos

    newMatches.forEach((m) => {
      if (m.round) {
        const rIdx = m.round - 1;
        if (!roundsUsed[rIdx]) roundsUsed[rIdx] = new Set();
        roundsUsed[rIdx].add(m.pairA.id);
        roundsUsed[rIdx].add(m.pairB.id);
        return;
      }
      // Asignación inteligente: buscamos la primera ronda donde ni A ni B estén jugando
      let r = 0;
      while (true) {
        if (!roundsUsed[r]) roundsUsed[r] = new Set();
        if (!roundsUsed[r].has(m.pairA.id) && !roundsUsed[r].has(m.pairB.id)) {
          m.round = r + 1;
          roundsUsed[r].add(m.pairA.id);
          roundsUsed[r].add(m.pairB.id);
          break;
        }
        r++;
      }
    });

    // Ordenamos visualmente los partidos por ronda
    newMatches.sort((a, b) => a.round - b.round);

    return {
      ...g,
      matches: newMatches,
    };
  });

  // 👇 AHORA RECIBE EL PARÁMETRO 'sets'
  async function onSaveGroupMatch(groupId, matchId, a, b, sets) {
    const group = groupsWithRounds.find((g) => g.id === groupId);
    if (!group) return;
    const match = group.matches.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updatedGroups = groupsWithRounds.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              scoreA: String(a),
              scoreB: String(b),
              saved: true,
              sets: sets || null,
            } // 👈 SE GUARDA EL ARRAY DE SETS
          : m,
      );
      const standings = g.pairs.map((p) => ({
        ...p,
        pts: 0,
        gf: 0,
        gc: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        played: 0,
        wins: 0,
      }));
      updatedMatches
        .filter((m) => m.saved)
        .forEach((m) => {
          const sa = parseInt(m.scoreA),
            sb = parseInt(m.scoreB);

          let ga = 0,
            gb = 0;
          if (m.sets) {
            m.sets.forEach((set) => {
              ga += parseInt(set.a || 0);
              gb += parseInt(set.b || 0);
            });
          }

          const idxA = standings.findIndex((s) => s.id === m.pairA.id);
          const idxB = standings.findIndex((s) => s.id === m.pairB.id);
          if (idxA >= 0) {
            standings[idxA].played++;
            standings[idxA].gf += sa;
            standings[idxA].gc += sb;
            standings[idxA].gamesFor += ga;
            standings[idxA].gamesAgainst += gb;
            standings[idxA].pts += sa > sb ? 3 : sb > sa ? 0 : 1;
            if (sa > sb) standings[idxA].wins++;
          }
          if (idxB >= 0) {
            standings[idxB].played++;
            standings[idxB].gf += sb;
            standings[idxB].gc += sa;
            standings[idxB].gamesFor += gb;
            standings[idxB].gamesAgainst += ga;
            standings[idxB].pts += sb > sa ? 3 : sa > sb ? 0 : 1;
            if (sb > sa) standings[idxB].wins++;
          }
        });
      return { ...g, matches: updatedMatches, standings };
    });

    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, groups: updatedGroups });
  }

  async function onEditGroupMatch(groupId, matchId) {
    const updatedGroups = groupsWithRounds.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId
          ? { ...m, saved: false, scoreA: "", scoreB: "", sets: null }
          : m,
      );
      const standings = g.pairs.map((p) => ({
        ...p,
        pts: 0,
        gf: 0,
        gc: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        played: 0,
        wins: 0,
      }));
      updatedMatches
        .filter((m) => m.saved)
        .forEach((m) => {
          const sa = parseInt(m.scoreA),
            sb = parseInt(m.scoreB);

          let ga = 0,
            gb = 0;
          if (m.sets) {
            m.sets.forEach((set) => {
              ga += parseInt(set.a || 0);
              gb += parseInt(set.b || 0);
            });
          }

          const idxA = standings.findIndex((s) => s.id === m.pairA.id);
          const idxB = standings.findIndex((s) => s.id === m.pairB.id);
          if (idxA >= 0) {
            standings[idxA].played++;
            standings[idxA].gf += sa;
            standings[idxA].gc += sb;
            standings[idxA].gamesFor += ga;
            standings[idxA].gamesAgainst += gb;
            standings[idxA].pts += sa > sb ? 3 : sb > sa ? 0 : 1;
            if (sa > sb) standings[idxA].wins++;
          }
          if (idxB >= 0) {
            standings[idxB].played++;
            standings[idxB].gf += sb;
            standings[idxB].gc += sa;
            standings[idxB].gamesFor += gb;
            standings[idxB].gamesAgainst += ga;
            standings[idxB].pts += sb > sa ? 3 : sa > sb ? 0 : 1;
            if (sb > sa) standings[idxB].wins++;
          }
        });
      return { ...g, matches: updatedMatches, standings };
    });
    await persist({ ...t, groups: updatedGroups });
  }

  const allGroupsDone =
    groupsWithRounds.length > 0 &&
    groupsWithRounds.every((g) => g.matches.every((m) => m.saved));

  // 👇 LÓGICA PARA AVANZAR RONDA POR RONDA EN LA FASE DE GRUPOS
  const groupRoundNum = t.groupRoundNum || 1;
  const maxGroupRound =
    groupsWithRounds.length > 0
      ? Math.max(
          1,
          ...groupsWithRounds.flatMap((g) => g.matches.map((m) => m.round)),
        )
      : 1;

  const currentRoundMatches = groupsWithRounds.flatMap((g) =>
    g.matches.filter((m) => m.round === groupRoundNum),
  );
  const currentRoundAllSaved =
    currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.saved);

  async function onNextGroupRound() {
    if (!currentRoundAllSaved) return;
    await persist({ ...t, groupRoundNum: groupRoundNum + 1 });
  }

  async function onStartKnockout() {
    if (!allGroupsDone) return;
    const bracket = buildKnockoutFromGroups(
      groupsWithRounds,
      t.config.advancePerGroup || 2,
    );
    await persist({
      ...t,
      groups: groupsWithRounds,
      knockoutBracket: bracket,
      phase: "knockout",
    });
  }

  // 👇 AHORA RECIBE EL PARÁMETRO 'sets'
  async function onSaveKnockoutMatch(matchId, a, b, sets) {
    const match = t.knockoutBracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updated = advanceBracket(t.knockoutBracket, matchId, a, b).map((m) =>
      m.id === matchId ? { ...m, sets: sets || null } : m,
    );

    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, knockoutBracket: updated });
  }

  async function onEditKnockoutMatch(matchId) {
    const updated = t.knockoutBracket.map((m) => ({ ...m }));
    const match = updated.find((m) => m.id === matchId);
    if (!match) return;

    if (match.nextMatchId && match.winner) {
      const nextM = updated.find((m) => m.id === match.nextMatchId);
      if (nextM) {
        if (nextM.pairA?.id === match.winner.id) nextM.pairA = null;
        if (nextM.pairB?.id === match.winner.id) nextM.pairB = null;
      }
    }
    match.scoreA = "";
    match.scoreB = "";
    match.saved = false;
    match.winner = null;
    match.loser = null;
    match.sets = null;

    await persist({ ...t, knockoutBracket: updated });
  }

  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];

  const champion = t.knockoutBracket?.find(
    (m) => !m.nextMatchId && m.saved,
  )?.winner;

  const allPairs = groupsWithRounds.flatMap((g) => g.standings);

  return (
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle="Fase de Grupos y Eliminatoria"
      />
      <div style={{ padding: 16 }}>
        <Tabs
          tabs={[
            ["groups", "🏁 Grupos"],
            ["knockout", "⚡ Eliminatoria"],
            ["standings", "🏆 Posiciones"],
            ["rules", "📖 Reglas"],
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>

      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {tab === "groups" && (
          <>
            {groupsWithRounds.map((group) => (
              <div
                key={group.id}
                style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9" }}
                  >
                    {group.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      background: "#334155",
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    {group.matches.filter((m) => m.saved).length}/
                    {group.matches.length} partidos
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      padding: "4px 8px",
                    }}
                  >
                    <div style={{ flex: 1 }}>Pareja</div>
                    <div style={{ width: 30, textAlign: "center" }}>PJ</div>
                    <div style={{ width: 30, textAlign: "center" }}>
                      {isSetFormat ? "SF" : "GF"}
                    </div>
                    <div style={{ width: 30, textAlign: "center" }}>
                      {isSetFormat ? "SC" : "GC"}
                    </div>
                    {isSetFormat && (
                      <div style={{ width: 35, textAlign: "center" }}>
                        DIF.G
                      </div>
                    )}
                    <div
                      style={{
                        width: 30,
                        textAlign: "center",
                        fontWeight: 800,
                      }}
                    >
                      Pts
                    </div>
                  </div>
                  {[...group.standings]
                    .sort((a, b) => {
                      if (b.pts !== a.pts) return b.pts - a.pts;
                      if (b.gf - b.gc !== a.gf - a.gc)
                        return b.gf - b.gc - (a.gf - a.gc);
                      return (
                        (b.gamesFor || 0) -
                        (b.gamesAgainst || 0) -
                        ((a.gamesFor || 0) - (a.gamesAgainst || 0))
                      );
                    })
                    .map((s, si) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          fontSize: 13,
                          padding: "6px 8px",
                          borderRadius: 4,
                          background:
                            si < (t.config.advancePerGroup || 2)
                              ? "#16a34a22"
                              : "transparent",
                        }}
                      >
                        <div
                          style={{ flex: 1, fontWeight: 700, color: "#f1f5f9" }}
                        >
                          {si < (t.config.advancePerGroup || 2) && "⚡ "}
                          {s.p1} / {s.p2}
                        </div>
                        <div
                          style={{
                            width: 30,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          {s.played}
                        </div>
                        <div
                          style={{
                            width: 30,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          {s.gf}
                        </div>
                        <div
                          style={{
                            width: 30,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          {s.gc}
                        </div>
                        {isSetFormat && (
                          <div
                            style={{
                              width: 35,
                              textAlign: "center",
                              color: "#94a3b8",
                              fontSize: 11,
                            }}
                          >
                            {(s.gamesFor || 0) - (s.gamesAgainst || 0) > 0
                              ? "+"
                              : ""}
                            {(s.gamesFor || 0) - (s.gamesAgainst || 0)}
                          </div>
                        )}
                        <div
                          style={{
                            width: 30,
                            textAlign: "center",
                            fontWeight: 800,
                            color: "#38bdf8",
                          }}
                        >
                          {s.pts}
                        </div>
                      </div>
                    ))}
                </div>

                <div>
                  {/* PARTIDOS AGRUPADOS POR RONDA */}
                  {Array.from(new Set(group.matches.map((m) => m.round)))
                    .sort((a, b) => a - b)
                    .filter((roundNum) => roundNum <= groupRoundNum) // 👈 Solo mostramos hasta la ronda activa
                    .map((roundNum) => (
                      <div key={roundNum} style={{ marginBottom: 20 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            fontWeight: 800,
                            marginBottom: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid #334155",
                            paddingBottom: 4,
                          }}
                        >
                          Ronda {roundNum}
                        </div>

                        {group.matches
                          .filter((m) => m.round === roundNum)
                          .map((match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              isAdmin={isAdmin}
                              ls={ls}
                              setLs={setLs}
                              onSave={(matchId, a, b, sets) =>
                                onSaveGroupMatch(group.id, matchId, a, b, sets)
                              }
                              onEdit={(matchId) =>
                                onEditGroupMatch(group.id, matchId)
                              }
                              accentColor="#059669"
                              scoringFormat={t.config?.scoringFormat || "games"}
                            />
                          ))}
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* 👇 BOTÓN PARA HABILITAR LA SIGUIENTE RONDA */}
            {groupRoundNum < maxGroupRound &&
              t.phase === "groups" &&
              isAdmin &&
              currentRoundAllSaved && (
                <button
                  onClick={onNextGroupRound}
                  style={B("#0284c7", {
                    width: "100%",
                    padding: 16,
                    fontSize: 16,
                  })}
                >
                  Siguiente Ronda de Grupos ({groupRoundNum + 1}) ➔
                </button>
              )}

            {allGroupsDone && t.phase === "groups" && isAdmin && (
              <button
                onClick={onStartKnockout}
                style={B("#10b981", {
                  width: "100%",
                  padding: 16,
                  fontSize: 16,
                })}
              >
                Iniciar Fase Eliminatoria ⚡
              </button>
            )}
            {!isAdmin && !allGroupsDone && (
              <div
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  padding: 20,
                  fontSize: 14,
                }}
              >
                👀 Modo vista · Esperando resultados de la Ronda {groupRoundNum}
              </div>
            )}
          </>
        )}

        {tab === "knockout" && (
          <>
            {t.phase === "groups" && (
              <div
                style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}
              >
                <h3
                  style={{
                    textAlign: "center",
                    color: "#38bdf8",
                    fontWeight: 900,
                    fontSize: 18,
                    marginBottom: 8,
                  }}
                >
                  🔮 Proyección de Cruces
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    marginBottom: 20,
                    textAlign: "center",
                  }}
                >
                  Al terminar los grupos, los cruces se armarán enfrentando a
                  los líderes contra los peores clasificados.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {Array.from({
                    length:
                      (groupsWithRounds.length *
                        (t.config.advancePerGroup || 2)) /
                      2,
                  }).map((_, i) => {
                    const groupA = i % groupsWithRounds.length;
                    const groupB = (i + 1) % groupsWithRounds.length;
                    const worstRank = t.config.advancePerGroup || 2;
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          background: "#0f172a",
                          padding: "12px 16px",
                          borderRadius: 8,
                          alignItems: "center",
                          border: "1px solid #334155",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color: "#f1f5f9",
                            flex: 1,
                            textAlign: "right",
                          }}
                        >
                          1º{" "}
                          {groupsWithRounds[groupA]?.name ||
                            `Grupo ${groupA + 1}`}
                        </span>
                        <span
                          style={{
                            color: "#38bdf8",
                            fontWeight: 900,
                            margin: "0 16px",
                          }}
                        >
                          VS
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            color: "#94a3b8",
                            flex: 1,
                            textAlign: "left",
                          }}
                        >
                          {worstRank}º{" "}
                          {groupsWithRounds[groupB]?.name ||
                            `Grupo ${groupB + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {t.phase === "knockout" && (
              <>
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
                      Campeón del Mundialito
                    </div>
                    <div
                      style={{
                        color: "#f1f5f9",
                        fontWeight: 800,
                        fontSize: 18,
                      }}
                    >
                      {champion.p1} / {champion.p2}
                    </div>
                  </div>
                )}
                {koRounds.map((round) => (
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
                      {round === Math.max(...koRounds)
                        ? "Final"
                        : `Ronda ${round}`}
                    </div>
                    {t.knockoutBracket
                      .filter((m) => m.round === round)
                      .map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isAdmin={isAdmin}
                          ls={ls}
                          setLs={setLs}
                          onSave={onSaveKnockoutMatch}
                          onEdit={onEditKnockoutMatch}
                          accentColor="#059669"
                          scoringFormat={t.config?.scoringFormat || "games"}
                        />
                      ))}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "standings" && (
          <PairStandings
            pairs={allPairs}
            title="Clasificación General"
            scoringFormat={t.config?.scoringFormat}
            extra={
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                Puntos fase de grupos: Victoria=3, Empate=1, Derrota=0
              </div>
            }
          />
        )}

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
              Reglas del Mundialito
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
              {TOURNAMENT_RULES.mundialito.map((rule, i) => (
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
