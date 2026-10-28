// src/components/play/PlayMundialito.jsx
import { useState } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, unadvanceBracket, canEditBracketMatch, bracketRoundName, bracketPodium, bracketSemifinalLosers } from "../../logic/relampago";
import {
  buildKnockoutFromGroups,
  mundialitoGroupsLocked,
  canReopenMundialito,
  reopenMundialitoPatch,
  mundialitoThirdPlace,
  mundialitoCanFinish,
  crossingMode,
} from "../../logic/mundialito";
import { computeStandings, sortStandings, standingsLabels } from "../../logic/standings";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import { showToast } from "../../logic/toast";
import MatchCard from "../shared/MatchCard";
import PodiumCard from "../shared/PodiumCard";
import CrossingsProjection from "./CrossingsProjection";
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
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "start" | "reopen" | "finish", groupId?, matchId? }
  const locked = mundialitoGroupsLocked(t);

  const isSetFormat =
    t.config?.scoringFormat === "sets3" || t.config?.scoringFormat === "sets5";
  const labels = standingsLabels(t.config);

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
    if (locked) return;
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

  async function onDeleteGroupMatch(groupId, matchId) {
    if (locked) return;
    const updatedGroups = groupsWithRounds.map((g) => {
      if (g.id !== groupId) return g;
      const updatedMatches = g.matches.map((m) =>
        m.id === matchId ? { ...m, saved: false, scoreA: "", scoreB: "", sets: null } : m,
      );
      const standings = computeStandings(g.pairs, updatedMatches);
      return { ...g, matches: updatedMatches, standings };
    });
    setConfirm(null);
    try {
      await persist({ ...t, groups: updatedGroups });
    } catch (err) {
      console.error("Error al eliminar el resultado:", err);
    }
  }

  async function onReopenGroups() {
    if (!canReopenMundialito(t)) return;
    setConfirm(null);
    try {
      await persist({ ...t, ...reopenMundialitoPatch() });
      setTab("groups");
    } catch (err) {
      console.error("Error al volver a la fase de grupos:", err);
    }
  }

  const allGroupsDone =
    groupsWithRounds.length > 0 &&
    groupsWithRounds.every((g) => g.matches.every((m) => m.saved));

  async function onStartKnockout() {
    if (!allGroupsDone) return;
    setConfirm(null);
    try {
      const bracket = buildKnockoutFromGroups(
        groupsWithRounds,
        t.config.advancePerGroup || 2,
        { thirdPlace: mundialitoThirdPlace(t.config), extraQualifiers: t.config.extraQualifiers || 0, crossing: crossingMode(t.config) },
      );
      await persist({
        ...t,
        groups: groupsWithRounds,
        knockoutBracket: bracket,
        phase: "knockout",
      });
    } catch (err) {
      console.error("Error al iniciar la fase eliminatoria:", err);
      showToast("No se pudo iniciar la fase eliminatoria. Inténtalo de nuevo.");
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

  async function onFinishTournament() {
    setConfirm(null);
    if (!mundialitoCanFinish(t)) return;
    try {
      await persist({ ...t, status: "finished" });
    } catch (err) {
      console.error("Error al finalizar el torneo:", err);
      showToast("No se pudo finalizar el torneo. Inténtalo de nuevo.");
    }
  }

  async function onEditKnockoutMatch(matchId) {
    if (t.status === "finished" || !canEditBracketMatch(t.knockoutBracket, matchId)) return;
    await persist({ ...t, knockoutBracket: unadvanceBracket(t.knockoutBracket, matchId) });
  }

  const thirdMatch = t.knockoutBracket?.find((m) => m.bracket === "third");
  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];

  const champion = t.knockoutBracket?.find(
    (m) => !m.nextMatchId && m.saved && m.bracket !== "third",
  )?.winner;

  const finished = t.status === "finished";
  const podium = bracketPodium(t.knockoutBracket);
  // Quiénes pasaron a la fase final: los que ya están en el cuadro (los pasa directo incluidos)
  const qualifiedIds = t.knockoutBracket
    ? new Set(t.knockoutBracket.flatMap((m) => [m.pairA?.id, m.pairB?.id]).filter((id) => id !== undefined && id !== null && id !== "bye"))
    : null;

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
            <p className="text-[11px] text-[#475569]">
              {labels.legend}
            </p>
            {locked && (
              <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3 text-center text-[12px] text-[#94a3b8]">
                🔒 Resultados de grupos cerrados: la eliminatoria ya está en marcha con estas tablas.
              </div>
            )}
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
                      {labels.plus}
                    </div>
                    <div className="w-[30px] text-center">
                      {labels.minus}
                    </div>
                    {isSetFormat && (
                      <div className="w-[35px] text-center">
                        {labels.gamesDiff}
                      </div>
                    )}
                    <div
                      className="w-[30px] text-center font-extrabold"
                    >
                      PG
                    </div>
                  </div>
                  {sortStandings(group.standings, group.matches)
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
                          {si === (t.config.advancePerGroup || 2) && t.config.extraQualifiers > 0 && "🔸 "}
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
                        onEdit={
                          locked
                            ? undefined
                            : (matchId) => onEditGroupMatch(group.id, matchId)
                        }
                        onDelete={
                          locked
                            ? undefined
                            : (matchId) =>
                                setConfirm({ kind: "delete", groupId: group.id, matchId })
                        }
                        locked={locked}
                        scoringFormat={t.config?.scoringFormat || "games"}
                      />
                    ))}
                </div>
              </div>
            ))}

            {allGroupsDone && t.phase === "groups" && isAdmin && (
              <button
                onClick={() => setConfirm({ kind: "start" })}
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
            {t.phase === "groups" && <CrossingsProjection groups={groupsWithRounds} config={t.config} />}

            {t.phase === "knockout" && (
              <>
                {isAdmin && canReopenMundialito(t) && (
                  <button
                    onClick={() => setConfirm({ kind: "reopen" })}
                    className="w-full cursor-pointer rounded-xl border border-[#334155] bg-[#1e293b] py-3 text-[14px] font-bold text-[#cbd5e1]"
                  >
                    ↩ Volver a la fase de grupos
                  </button>
                )}
                {champion && (
                  <div
                    className="rounded-xl border-2 border-[#f59e0b] bg-[#1e293b] p-4 text-center"
                  >
                    <div className="text-[24px]">🏆</div>
                    <div
                      className="mb-1 text-[12px] font-bold uppercase text-[#f59e0b]"
                    >
                      Campeón del torneo
                    </div>
                    <div
                      className="text-[18px] font-extrabold text-[#f1f5f9]"
                    >
                      {champion.p1} / {champion.p2}
                    </div>
                  </div>
                )}
                {isAdmin && mundialitoCanFinish(t) && (
                  <button
                    onClick={() => setConfirm({ kind: "finish" })}
                    className="w-full cursor-pointer rounded-xl border-0 bg-[#10b981] py-3.5 text-[15px] font-bold text-white"
                  >
                    🏁 Finalizar torneo
                  </button>
                )}
                {finished && (
                  <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3 text-center text-[12px] text-[#94a3b8]">
                    🏁 Torneo finalizado: los resultados están cerrados.
                  </div>
                )}
                {koRounds.map((round) => (
                  <div key={round}>
                    <div
                      className="mb-2 text-[13px] font-bold uppercase text-[#94a3b8]"
                    >
                      {bracketRoundName(round, Math.max(...koRounds))}
                    </div>
                    {t.knockoutBracket
                      .filter((m) => m.round === round && m.bracket !== "third")
                      .map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isAdmin={isAdmin}
                          ls={ls}
                          setLs={setLs}
                          onSave={onSaveKnockoutMatch}
                          onEdit={
                            !finished && canEditBracketMatch(t.knockoutBracket, match.id)
                              ? onEditKnockoutMatch
                              : undefined
                          }
                          locked={
                            match.saved && (finished || !canEditBracketMatch(t.knockoutBracket, match.id))
                          }
                          accentColor="#059669"
                          scoringFormat={t.config?.scoringFormat || "games"}
                        />
                      ))}
                  </div>
                ))}
                {thirdMatch && (
                  <div>
                    <MatchCard
                      match={thirdMatch}
                      isAdmin={isAdmin}
                      ls={ls}
                      setLs={setLs}
                      onSave={onSaveKnockoutMatch}
                      onEdit={
                        !finished && canEditBracketMatch(t.knockoutBracket, thirdMatch.id)
                          ? onEditKnockoutMatch
                          : undefined
                      }
                      locked={
                        thirdMatch.saved && (finished || !canEditBracketMatch(t.knockoutBracket, thirdMatch.id))
                      }
                      accentColor="#059669"
                      scoringFormat={t.config?.scoringFormat || "games"}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "standings" && (
          <>
            <PodiumCard
              podium={podium}
              hasThird={!!thirdMatch}
              semifinalists={bracketSemifinalLosers(t.knockoutBracket)}
              finished={finished}
            />
            <div className="mb-3 text-[12px] text-[#94a3b8]">
              Clasifica quien tenga más partidos ganados (PG). En el grupo, si hay empate, decide el partido entre las parejas igualadas y después la diferencia a favor y en contra.
            </div>
            {groupsWithRounds.map((g) => (
              <PairStandings
                key={g.id}
                pairs={g.standings}
                matches={g.matches}
                title={g.name}
                medals={false}
                qualified={qualifiedIds}
                scoringFormat={t.config?.scoringFormat}
                config={t.config}
              />
            ))}
            {t.knockoutBracket && (
              <div className="mb-4 rounded-xl bg-[#0f172a] overflow-hidden">
                <div className="px-4 pt-3.5 pb-2.5 text-base font-black text-[#f1f5f9]">⚡ Fase final</div>
                {[...koRounds.map((round) => ({ key: round, title: bracketRoundName(round, Math.max(...koRounds)), bracket: "winners", round })),
                  ...(thirdMatch ? [{ key: "third", title: "3.º y 4.º puesto", bracket: "third", round: thirdMatch.round }] : [])].map((sec) => (
                  <div key={sec.key} className="px-4 pb-3">
                    <div className="mb-1.5 text-[11px] font-bold uppercase text-[#64748b]">{sec.title}</div>
                    {t.knockoutBracket
                      .filter((m) => m.round === sec.round && (sec.bracket === "third" ? m.bracket === "third" : m.bracket !== "third") && m.pairA && m.pairB && m.pairA.id !== "bye" && m.pairB.id !== "bye")
                      .map((m) => (
                        <div key={m.id} className="mb-1.5 flex items-center gap-2 rounded-lg bg-[#1e293b] px-3 py-2 text-[13px]">
                          <span className={`flex-1 text-right ${m.saved && m.winner?.id === m.pairA.id ? "font-extrabold text-[#f1f5f9]" : "text-[#94a3b8]"}`}>{m.pairA.p1} / {m.pairA.p2}</span>
                          <span className="min-w-[44px] text-center font-black text-[#38bdf8]">{m.saved ? `${m.scoreA} - ${m.scoreB}` : "vs"}</span>
                          <span className={`flex-1 text-left ${m.saved && m.winner?.id === m.pairB.id ? "font-extrabold text-[#f1f5f9]" : "text-[#94a3b8]"}`}>{m.pairB.p1} / {m.pairB.p2}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "rules" && (
          <div className="rounded-xl bg-[#1e293b] p-5">
            <h3 className="mb-4 text-[18px] font-extrabold text-[#38bdf8]">
              Reglas del Torneo por grupos
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

      {confirm?.kind === "delete" && (
        <SimpleModal
          icon="🗑️"
          message="¿Eliminar este resultado? El partido quedará sin jugar y la tabla del grupo se recalculará."
          confirmLabel="Eliminar"
          onClose={() => setConfirm(null)}
          onConfirm={() => onDeleteGroupMatch(confirm.groupId, confirm.matchId)}
        />
      )}
      {confirm?.kind === "start" && (
        <SimpleModal
          icon="⚡"
          message="Al iniciar la fase eliminatoria se cierran los resultados de grupos y ya no se podrán modificar. ¿Iniciar la eliminatoria?"
          confirmLabel="Iniciar"
          danger={false}
          onClose={() => setConfirm(null)}
          onConfirm={onStartKnockout}
        />
      )}
      {confirm?.kind === "finish" && (
        <SimpleModal
          icon="🏁"
          message="Al finalizar el torneo los resultados se cierran y ya no se podrán modificar. ¿Finalizar el torneo?"
          confirmLabel="Finalizar"
          onClose={() => setConfirm(null)}
          onConfirm={onFinishTournament}
        />
      )}
      {confirm?.kind === "reopen" && (
        <SimpleModal
          icon="↩"
          message="Se descartará el cuadro de la eliminatoria y podrás volver a editar los resultados de grupos. ¿Continuar?"
          confirmLabel="Volver a grupos"
          onClose={() => setConfirm(null)}
          onConfirm={onReopenGroups}
        />
      )}
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
  onDelete,
  locked,
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
              onEdit={onEdit}
              onDelete={onDelete}
              locked={locked}
              accentColor="#059669"
              scoringFormat={scoringFormat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
