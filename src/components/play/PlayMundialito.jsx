// src/components/play/PlayMundialito.jsx
import { useState } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket } from "../../logic/relampago";
import { buildKnockoutFromGroups } from "../../logic/mundialito";
import { computeStandings, sortStandings } from "../../logic/standings";
import { THeader, Tabs } from "../shared/Components";
import MatchCard from "../shared/MatchCard";
import PairStandings from "../shared/PairStandings";

export default function PlayMundialito({
  t,
  code,
  isAdmin,
  persist,
  copyCode,
  onEditTournament,
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
      const standings = computeStandings(g.pairs, updatedMatches);
      return { ...g, matches: updatedMatches, standings };
    });

    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, groups: updatedGroups, scoringStarted: true });
  }

  async function onEditGroupMatch(groupId, matchId) {
    const updatedGroups = groupsWithRounds.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId ? { ...m, saved: false } : m,
      );
      const standings = computeStandings(g.pairs, updatedMatches);
      return { ...g, matches: updatedMatches, standings };
    });
    await persist({ ...t, groups: updatedGroups });
  }

  const allGroupsDone =
    groupsWithRounds.length > 0 &&
    groupsWithRounds.every((g) => g.matches.every((m) => m.saved));

  async function onStartKnockout() {
    if (!allGroupsDone) return;
    try {
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
    } catch (err) {
      console.error("Error al iniciar la fase eliminatoria:", err);
      alert("No se pudo iniciar la fase eliminatoria. Intenta de nuevo.");
    }
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
    await persist({ ...t, knockoutBracket: updated, scoringStarted: true });
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
    match.saved = false;

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
    <div className="pb-[80px]">
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle="Fase de Grupos y Eliminatoria"
        onEdit={isAdmin ? onEditTournament : undefined}
      />
      <div className="p-4">
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

      <div className="flex flex-col gap-6 px-4">
        {tab === "groups" && (
          <>
            {groupsWithRounds.map((group) => (
              <div
                key={group.id}
                className="rounded-xl bg-[#1e293b] p-4"
              >
                <div
                  className="mb-3 flex items-center justify-between"
                >
                  <div
                    className="text-[16px] font-extrabold text-[#f1f5f9]"
                  >
                    {group.name}
                  </div>
                  <div
                    className="rounded-[99px] bg-[#334155] px-2 py-[2px] text-[12px] text-[#64748b]"
                  >
                    {group.matches.filter((m) => m.saved).length}/
                    {group.matches.length} partidos
                  </div>
                </div>

                <div className="mb-4">
                  <div
                    className="flex px-2 py-1 text-[10px] font-bold uppercase text-[#64748b]"
                  >
                    <div className="flex-1">Pareja</div>
                    <div className="w-[30px] text-center">PJ</div>
                    <div className="w-[30px] text-center">
                      {isSetFormat ? "SF" : "JF"}
                    </div>
                    <div className="w-[30px] text-center">
                      {isSetFormat ? "SC" : "JC"}
                    </div>
                    {isSetFormat && (
                      <div className="w-[35px] text-center">
                        DJ
                      </div>
                    )}
                    <div
                      className="w-[30px] text-center font-extrabold"
                    >
                      PG
                    </div>
                  </div>
                  {sortStandings(group.standings)
                    .map((s, si) => (
                      <div
                        key={s.id}
                        className="flex items-center rounded-[4px] px-2 py-[6px] text-[13px]"
                        style={{
                          background:
                            si < (t.config.advancePerGroup || 2)
                              ? "#16a34a22"
                              : "transparent",
                        }}
                      >
                        <div
                          className="flex-1 font-bold text-[#f1f5f9]"
                        >
                          {si < (t.config.advancePerGroup || 2) && "⚡ "}
                          {s.p1} / {s.p2}
                        </div>
                        <div
                          className="w-[30px] text-center text-[#94a3b8]"
                        >
                          {s.played}
                        </div>
                        <div
                          className="w-[30px] text-center text-[#94a3b8]"
                        >
                          {s.gf}
                        </div>
                        <div
                          className="w-[30px] text-center text-[#94a3b8]"
                        >
                          {s.gc}
                        </div>
                        {isSetFormat && (
                          <div
                            className="w-[35px] text-center text-[11px] text-[#94a3b8]"
                          >
                            {(s.gamesFor || 0) - (s.gamesAgainst || 0) > 0
                              ? "+"
                              : ""}
                            {(s.gamesFor || 0) - (s.gamesAgainst || 0)}
                          </div>
                        )}
                        <div
                          className="w-[30px] text-center font-extrabold text-[#38bdf8]"
                        >
                          {s.wins}
                        </div>
                      </div>
                    ))}
                </div>

                <div>
                  {/* PARTIDOS AGRUPADOS POR RONDA */}
                  {Array.from(new Set(group.matches.map((m) => m.round)))
                    .sort((a, b) => a - b)
                    .map((roundNum) => (
                      <RoundAccordion
                        key={roundNum}
                        roundNum={roundNum}
                        matches={group.matches.filter(
                          (m) => m.round === roundNum,
                        )}
                        isAdmin={isAdmin}
                        ls={ls}
                        setLs={setLs}
                        onSave={(matchId, a, b, sets) =>
                          onSaveGroupMatch(group.id, matchId, a, b, sets)
                        }
                        onEdit={(matchId) =>
                          onEditGroupMatch(group.id, matchId)
                        }
                        scoringFormat={t.config?.scoringFormat || "games"}
                      />
                    ))}
                </div>
              </div>
            ))}

            {allGroupsDone && t.phase === "groups" && isAdmin && (
              <button
                onClick={onStartKnockout}
                className="w-full bg-[#10b981] text-white font-bold rounded-lg py-4 text-base cursor-pointer border-0"
              >
                Iniciar Fase Eliminatoria ⚡
              </button>
            )}
            {!isAdmin && !allGroupsDone && (
              <div
                className="p-5 text-center text-[14px] text-[#64748b]"
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
                className="rounded-xl bg-[#1e293b] p-5"
              >
                <h3
                  className="mb-2 text-center text-[18px] font-black text-[#38bdf8]"
                >
                  🔮 Proyección de Cruces
                </h3>
                <p
                  className="mb-5 text-center text-[13px] text-[#94a3b8]"
                >
                  Al terminar los grupos, los cruces se armarán enfrentando a
                  los líderes contra los peores clasificados.
                </p>
                <div
                  className="flex flex-col gap-3"
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
                        className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-3"
                      >
                        <span
                          className="flex-1 text-right font-extrabold text-[#f1f5f9]"
                        >
                          1º{" "}
                          {groupsWithRounds[groupA]?.name ||
                            `Grupo ${groupA + 1}`}
                        </span>
                        <span
                          className="mx-4 font-black text-[#38bdf8]"
                        >
                          VS
                        </span>
                        <span
                          className="flex-1 text-left font-extrabold text-[#94a3b8]"
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
                    className="rounded-xl border-2 border-[#f59e0b] bg-[#1e293b] p-4 text-center"
                  >
                    <div className="text-[24px]">🏆</div>
                    <div
                      className="mb-1 text-[12px] font-bold uppercase text-[#f59e0b]"
                    >
                      Campeón del Mundialito
                    </div>
                    <div
                      className="text-[18px] font-extrabold text-[#f1f5f9]"
                    >
                      {champion.p1} / {champion.p2}
                    </div>
                  </div>
                )}
                {koRounds.map((round) => (
                  <div key={round}>
                    <div
                      className="mb-2 text-[13px] font-bold uppercase text-[#94a3b8]"
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
              <div className="mb-3 text-[12px] text-[#94a3b8]">
                Clasifica quien tenga más partidos ganados (PG). Desempate: diferencia de sets y luego de juegos.
              </div>
            }
          />
        )}

        {tab === "rules" && (
          <div className="rounded-xl bg-[#1e293b] p-5">
            <h3 className="mb-4 text-[18px] font-extrabold text-[#38bdf8]">
              Reglas del Mundialito
            </h3>
            <ul
              className="list-disc pl-5 text-[14px] leading-[1.6] text-[#cbd5e1]"
            >
              {generateRules(t.type, t.config).map((rule, i) => (
                <li key={i} className="mb-[10px]">
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

// 👇 NUEVO COMPONENTE PARA EL DESPLEGABLE DE CADA RONDA
function RoundAccordion({
  roundNum,
  matches,
  isAdmin,
  ls,
  setLs,
  onSave,
  onEdit,
  scoringFormat,
}) {
  // El acordeón se abre por defecto si hay partidos sin guardar o si es la Ronda 1
  const hasUnsaved = matches.some((m) => !m.saved);
  const [isOpen, setIsOpen] = useState(hasUnsaved || roundNum === 1);

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[#334155] bg-[#0f172a]">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center justify-between bg-[#1e293b] px-4 py-3 text-[13px] font-extrabold uppercase tracking-[0.05em]"
        style={{ color: hasUnsaved ? "#38bdf8" : "#4ade80" }}
      >
        <div className="flex items-center gap-2">
          <span>Ronda {roundNum}</span>
          {!hasUnsaved && <span className="text-[16px]">✓</span>}
        </div>
        <span className="text-[12px] text-[#64748b]">
          {isOpen ? "▲ OCULTAR" : "▼ VER PARTIDOS"}
        </span>
      </div>
      {isOpen && (
        <div className="p-4">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              isAdmin={isAdmin}
              ls={ls}
              setLs={setLs}
              onSave={(matchId, a, b, sets) => onSave(matchId, a, b, sets)}
              onEdit={(matchId) => onEdit(matchId)}
              accentColor="#059669"
              scoringFormat={scoringFormat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
