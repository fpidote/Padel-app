import { useState } from "react";
import { B } from "../../logic/constants";
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

  async function onSaveGroupMatch(groupId, matchId, a, b) {
    const group = t.groups.find((g) => g.id === groupId);
    if (!group) return;
    const match = group.matches.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updatedGroups = t.groups.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId
          ? { ...m, scoreA: String(a), scoreB: String(b), saved: true }
          : m,
      );
      const standings = g.pairs.map((p) => ({
        ...p,
        pts: 0,
        gf: 0,
        gc: 0,
        played: 0,
        wins: 0,
      }));
      updatedMatches
        .filter((m) => m.saved)
        .forEach((m) => {
          const sa = parseInt(m.scoreA),
            sb = parseInt(m.scoreB);
          const idxA = standings.findIndex((s) => s.id === m.pairA.id);
          const idxB = standings.findIndex((s) => s.id === m.pairB.id);
          if (idxA >= 0) {
            standings[idxA].played++;
            standings[idxA].gf += sa;
            standings[idxA].gc += sb;
            standings[idxA].pts += sa > sb ? 3 : sb > sa ? 0 : 1;
            if (sa > sb) standings[idxA].wins++;
          }
          if (idxB >= 0) {
            standings[idxB].played++;
            standings[idxB].gf += sb;
            standings[idxB].gc += sa;
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

  const allGroupsDone =
    t.groups && t.groups.every((g) => g.matches.every((m) => m.saved));

  async function onStartKnockout() {
    if (!allGroupsDone) return;
    const bracket = buildKnockoutFromGroups(
      t.groups,
      t.config.advancePerGroup || 2,
    );
    await persist({ ...t, knockoutBracket: bracket, phase: "knockout" });
  }

  async function onSaveKnockoutMatch(matchId, a, b) {
    const match = t.knockoutBracket.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const updated = advanceBracket(t.knockoutBracket, matchId, a, b);
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, knockoutBracket: updated });
  }

  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];

  const champion = t.knockoutBracket?.find(
    (m) => !m.nextMatchId && m.saved,
  )?.winner;

  const allPairs = t.groups ? t.groups.flatMap((g) => g.standings) : [];

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
            {t.groups?.map((group) => (
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

                {/* Standings Table */}
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
                    <div style={{ width: 30, textAlign: "center" }}>GF</div>
                    <div style={{ width: 30, textAlign: "center" }}>GC</div>
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
                    .sort((a, b) =>
                      b.pts !== a.pts
                        ? b.pts - a.pts
                        : b.gf - b.gc - (a.gf - a.gc),
                    )
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

                {/* Matches */}
                <div>
                  {group.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={(matchId, a, b) =>
                        onSaveGroupMatch(group.id, matchId, a, b)
                      }
                      accentColor="#059669"
                    />
                  ))}
                </div>
              </div>
            ))}
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
                👀 Modo vista · Esperando resultados de la fase de grupos
              </div>
            )}
          </>
        )}

        {tab === "knockout" && (
          <>
            {t.phase === "groups" && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#94a3b8",
                  background: "#1e293b",
                  borderRadius: 8,
                }}
              >
                Completa la fase de grupos primero para ver la eliminatoria.
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
                          accentColor="#059669"
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
            extra={
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                Puntos fase de grupos: Victoria=3, Empate=1, Derrota=0
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
