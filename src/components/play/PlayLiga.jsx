// src/components/play/PlayLiga.jsx
import { useState } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, unadvanceBracket, canEditBracketMatch, bracketRoundName, bracketPodium, bracketSemifinalLosers } from "../../logic/relampago";
import {
  recomputeLigaStandings,
  buildLigaKnockout,
  ligaQualifiers,
  ligaThirdPlace,
  ligaResultsLocked,
  canReopenLiga,
  reopenLigaPatch,
  clearLigaMatch,
  ligaCanFinish,
  finishPatch,
  ligaQualifiedPairs,
} from "../../logic/liga";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import MatchCard from "../shared/MatchCard";
import PairStandings from "../shared/PairStandings";
import PodiumCard from "../shared/PodiumCard";
import RestingNote from "../shared/RestingNote";
import { showToast } from "../../logic/toast";
import { sortStandings, standingsLabels } from "../../logic/standings";

export default function PlayLiga({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("fixture");
  const [ls, setLs] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "start" | "reopen" | "finish", matchId? }

  const playoffEnabled = !!t.config?.playoffEnabled;
  const locked = ligaResultsLocked(t);
  const bySets = ["sets3", "sets5"].includes(t.config?.scoringFormat || "sets3");
  const matches = t.matches || [];
  const rounds = t.rounds || [];
  const allMatchesDone = matches.length > 0 && matches.every((m) => m.saved);

  async function onSaveMatch(matchId, a, b, sets) {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.saved) return;
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;

    const updatedMatches = matches.map((m) =>
      m.id === matchId
        ? { ...m, scoreA: String(a), scoreB: String(b), saved: true, sets: sets || null }
        : m,
    );
    const standings = recomputeLigaStandings(t.pairs, updatedMatches);

    setLs((prev) => {
      const n = { ...prev };
      delete n[`${matchId}_A`];
      delete n[`${matchId}_B`];
      return n;
    });
    await persist({ ...t, matches: updatedMatches, pairs: standings, scoringStarted: true });
  }

  async function onEditMatch(matchId) {
    if (locked) return;
    const updatedMatches = matches.map((m) =>
      m.id === matchId ? { ...m, saved: false } : m,
    );
    const standings = recomputeLigaStandings(t.pairs, updatedMatches);
    await persist({ ...t, matches: updatedMatches, pairs: standings });
  }

  async function onDeleteMatch(matchId) {
    if (locked) return;
    const updatedMatches = clearLigaMatch(matches, matchId);
    const standings = recomputeLigaStandings(t.pairs, updatedMatches);
    setConfirm(null);
    try {
      await persist({ ...t, matches: updatedMatches, pairs: standings });
    } catch (err) {
      console.error("Error al eliminar el resultado:", err);
    }
  }

  async function onReopenLiga() {
    if (!canReopenLiga(t)) return;
    setConfirm(null);
    try {
      await persist({ ...t, ...reopenLigaPatch() });
      setTab("fixture");
    } catch (err) {
      console.error("Error al volver a la fase de liga:", err);
    }
  }

  async function onFinishTournament() {
    setConfirm(null);
    if (!ligaCanFinish(t)) return;
    try {
      await persist({ ...t, ...finishPatch() });
    } catch (err) {
      console.error("Error al finalizar el torneo:", err);
      showToast("No se pudo finalizar el torneo. Inténtalo de nuevo.");
    }
  }

  async function onSetRoundDate(roundNum, date) {
    const updatedRounds = rounds.map((r) =>
      r.round === roundNum ? { ...r, date: date || null } : r,
    );
    await persist({ ...t, rounds: updatedRounds });
  }

  async function onStartKnockout() {
    if (!allMatchesDone) return;
    setConfirm(null);
    const bracket = buildLigaKnockout(t.pairs, ligaQualifiers(t.config, t.pairs.length), matches, {
      thirdPlace: ligaThirdPlace(t.config, t.pairs.length),
    });
    try {
      await persist({ ...t, knockoutBracket: bracket, phase: "playoff" });
    } catch (err) {
      console.error("Error al iniciar la fase final:", err);
    }
  }

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
    if (t.status === "finished" || !canEditBracketMatch(t.knockoutBracket, matchId)) return;
    await persist({ ...t, knockoutBracket: unadvanceBracket(t.knockoutBracket, matchId) });
  }

  const finished = t.status === "finished";
  const thirdMatch = t.knockoutBracket?.find((m) => m.bracket === "third");
  const podium = bracketPodium(t.knockoutBracket);
  const qualifiedIds = t.knockoutBracket
    ? new Set(t.knockoutBracket.flatMap((m) => [m.pairA?.id, m.pairB?.id]).filter((id) => id !== undefined && id !== null && id !== "bye"))
    : null;
  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];
  const champion = playoffEnabled
    ? t.knockoutBracket?.find((m) => !m.nextMatchId && m.saved && m.bracket !== "third")?.winner
    : allMatchesDone
      ? sortStandings(t.pairs, matches)[0]
      : null;

  const tabs = [
    ["fixture", "📅 Jornadas"],
    ["standings", "🏆 Posiciones"],
    ...(playoffEnabled ? [["playoff", "⚡ Eliminatoria"]] : []),
    ["rules", "📖 Reglas"],
  ];

  return (
    <div className="pb-20">
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle="Liga · Tabla única"
        onEdit={isAdmin ? onEditTournament : undefined}
      />

      <div className="px-4 pt-4">
        <Tabs tabs={tabs} active={tab} setActive={setTab} />
      </div>

      <div className="px-4">
        {tab === "fixture" && (
          <div className="flex flex-col gap-3 mt-4">
            {locked && t.phase === "playoff" && (
              <div className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-400 text-center">
                🔒 Resultados de la liga cerrados: la fase final ya está en marcha con esta tabla.
              </div>
            )}
            {champion && !playoffEnabled && (
              <div className="bg-[#1f2937] border-2 border-yellow-500/50 rounded-2xl p-5 text-center">
                <div className="text-3xl">🏆</div>
                <div className="text-yellow-400 font-black text-xs uppercase tracking-wide mt-1">Campeón de la Liga</div>
                <div className="text-gray-50 font-black text-lg mt-1">{champion.p1} / {champion.p2}</div>
              </div>
            )}
            {!playoffEnabled && isAdmin && ligaCanFinish(t) && (
              <button
                onClick={() => setConfirm({ kind: "finish" })}
                className="w-full bg-[#10b981] text-white font-bold rounded-xl py-4 text-base cursor-pointer border-0"
              >
                🏁 Finalizar torneo
              </button>
            )}
            {!playoffEnabled && finished && (
              <div className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-400 text-center">
                🏁 Torneo finalizado: los resultados están cerrados.
              </div>
            )}
            {rounds
              .slice()
              .sort((a, b) => a.round - b.round)
              .map((r) => (
                <LigaRoundAccordion
                  key={r.round}
                  round={r}
                  matches={matches.filter((m) => m.round === r.round)}
                  allMatches={matches}
                  isAdmin={isAdmin}
                  ls={ls}
                  setLs={setLs}
                  onSave={onSaveMatch}
                  onEdit={locked ? undefined : onEditMatch}
                  onDelete={locked ? undefined : (id) => setConfirm({ kind: "delete", matchId: id })}
                  locked={locked}
                  onSetDate={onSetRoundDate}
                  scoringFormat={t.config?.scoringFormat || "sets3"}
                />
              ))}
            {playoffEnabled && allMatchesDone && t.phase === "fixture" && isAdmin && (
              <button
                onClick={() => setConfirm({ kind: "start" })}
                className="w-full bg-[#10b981] text-white font-bold rounded-xl py-4 text-base cursor-pointer border-0"
              >
                Iniciar Fase Final ⚡
              </button>
            )}
            {!isAdmin && !allMatchesDone && (
              <div className="text-center text-gray-500 py-8 text-sm">
                👀 Modo vista · Esperando resultados
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <div className="mt-4">
            {playoffEnabled && (
              <PodiumCard
                podium={podium}
                hasThird={!!thirdMatch}
                semifinalists={bracketSemifinalLosers(t.knockoutBracket)}
                finished={finished}
              />
            )}
            <PairStandings
              pairs={t.pairs || []}
              title={playoffEnabled ? "Tabla de la liga" : "Tabla de posiciones"}
              scoringFormat={t.config?.scoringFormat || "sets3"}
              config={t.config}
              matches={matches}
              medals={!playoffEnabled}
              qualified={qualifiedIds}
              extra={
                <p className="text-xs text-gray-500 mb-3">
                  {playoffEnabled && "Esta es la tabla de la liga regular: el campeón se decide en la eliminatoria. "}
                  Victoria = 1 punto · Derrota = 0 puntos · Desempate: partido entre las igualadas y luego diferencia de{" "}
                  {bySets ? "sets y luego de games" : standingsLabels(t.config).unit === "points" ? "puntos" : "games"}
                </p>
              }
            />
            {playoffEnabled && t.knockoutBracket && (
              <div className="bg-[#0f172a] rounded-xl overflow-hidden mb-4">
                <div className="px-4 pt-3.5 pb-2.5 text-base font-black text-[#f1f5f9]">⚡ Fase final</div>
                {[...koRounds.map((round) => ({ key: round, title: bracketRoundName(round, Math.max(...koRounds)), bracket: "winners", round })),
                  ...(thirdMatch ? [{ key: "third", title: "3.º y 4.º puesto", bracket: "third", round: thirdMatch.round }] : [])].map((sec) => (
                  <div key={sec.key} className="px-4 pb-3">
                    <div className="mb-1.5 text-[11px] font-bold uppercase text-gray-500">{sec.title}</div>
                    {t.knockoutBracket
                      .filter((m) => m.round === sec.round && (sec.bracket === "third" ? m.bracket === "third" : m.bracket !== "third") && m.pairA && m.pairB && m.pairA.id !== "bye" && m.pairB.id !== "bye")
                      .map((m) => (
                        <div key={m.id} className="mb-1.5 flex items-center gap-2 rounded-lg bg-[#1f2937] px-3 py-2 text-[13px]">
                          <span className={`flex-1 text-right ${m.saved && m.winner?.id === m.pairA.id ? "font-extrabold text-gray-50" : "text-gray-400"}`}>{m.pairA.p1} / {m.pairA.p2}</span>
                          <span className="min-w-[44px] text-center font-black text-sky-400">{m.saved ? `${m.scoreA} - ${m.scoreB}` : "vs"}</span>
                          <span className={`flex-1 text-left ${m.saved && m.winner?.id === m.pairB.id ? "font-extrabold text-gray-50" : "text-gray-400"}`}>{m.pairB.p1} / {m.pairB.p2}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "playoff" && (
          <div className="flex flex-col gap-4 mt-4">
            {t.phase === "fixture" && (
              <div className="bg-[#1f2937] rounded-2xl border border-[#374151] p-5 text-center">
                <div className="text-sm text-gray-400">
                  La fase final se arma con el top {ligaQualifiers(t.config, (t.pairs || []).length)} de la tabla al terminar todos los partidos de liga.
                </div>
              </div>
            )}

            {t.phase === "playoff" && (
              <>
                {isAdmin && canReopenLiga(t) && (
                  <button
                    onClick={() => setConfirm({ kind: "reopen" })}
                    className="w-full bg-[#1f2937] border border-[#374151] text-gray-300 font-bold rounded-xl py-3 text-sm cursor-pointer"
                  >
                    ↩ Volver a la fase de liga
                  </button>
                )}
                {champion && (
                  <div className="bg-[#1f2937] border-2 border-yellow-500/50 rounded-2xl p-5 text-center">
                    <div className="text-3xl">🏆</div>
                    <div className="text-yellow-400 font-black text-xs uppercase tracking-wide mt-1">Campeón de la Liga</div>
                    <div className="text-gray-50 font-black text-lg mt-1">{champion.p1} / {champion.p2}</div>
                  </div>
                )}
                {isAdmin && playoffEnabled && ligaCanFinish(t) && (
                  <button
                    onClick={() => setConfirm({ kind: "finish" })}
                    className="w-full bg-[#10b981] text-white font-bold rounded-xl py-4 text-base cursor-pointer border-0"
                  >
                    🏁 Finalizar torneo
                  </button>
                )}
                {finished && (
                  <div className="bg-[#1f2937] border border-[#374151] rounded-2xl px-4 py-3 text-xs text-gray-400 text-center">
                    🏁 Torneo finalizado: los resultados están cerrados.
                  </div>
                )}
                {koRounds.map((round) => (
                  <div key={round}>
                    <div className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-wide">
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
                          accentColor="#db2777"
                          scoringFormat={t.config?.scoringFormat || "sets3"}
                          stageLabel="🏆 FASE FINAL"
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
                      accentColor="#db2777"
                      scoringFormat={t.config?.scoringFormat || "sets3"}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "rules" && (
          <div className="mt-4 bg-[#1f2937] rounded-2xl border border-[#374151] p-5">
            <h3 className="text-base font-black text-[#db2777] mb-4">Reglas de la Liga</h3>
            <ul className="space-y-2.5 list-disc pl-5">
              {generateRules(t.type, t.config, { pairCount: (t.pairs || []).length }).map((rule, i) => (
                <li key={i} className="text-sm text-gray-300 leading-relaxed">{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirm?.kind === "delete" && (
        <SimpleModal
          icon="🗑️"
          message="¿Eliminar este resultado? El partido quedará sin jugar y la tabla se recalculará."
          confirmLabel="Eliminar"
          onClose={() => setConfirm(null)}
          onConfirm={() => onDeleteMatch(confirm.matchId)}
        />
      )}
      {confirm?.kind === "start" && (
        <SimpleModal
          icon="⚡"
          message={
            <>
              <div className="mb-1">Pasan a la fase final (según la tabla actual):</div>
              <ol className="list-none p-0 m-0 mb-3 text-[#38bdf8]" data-testid="clasificados">
                {ligaQualifiedPairs(t.pairs, matches, ligaQualifiers(t.config, t.pairs.length)).map((p, i) => (
                  <li key={p.id}>{`${i + 1}. ${p.p1} / ${p.p2}`}</li>
                ))}
              </ol>
              Al iniciar la fase final se cierran los resultados de la liga y ya no se podrán modificar. ¿Iniciar la fase final?
            </>
          }
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
          message="Se descartará el cuadro de la fase final y podrás volver a editar los resultados de la liga. ¿Continuar?"
          confirmLabel="Volver a la liga"
          onClose={() => setConfirm(null)}
          onConfirm={onReopenLiga}
        />
      )}
    </div>
  );
}

function LigaRoundAccordion({ round, matches, allMatches, isAdmin, ls, setLs, onSave, onEdit, onDelete, locked, onSetDate, scoringFormat }) {
  const hasUnsaved = matches.some((m) => !m.saved);
  const [isOpen, setIsOpen] = useState(hasUnsaved || round.round === 1);

  return (
    <div className="bg-[#1f2937] rounded-2xl border border-[#374151] overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${hasUnsaved ? "text-sky-400" : "text-green-400"}`}
      >
        <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
          <span>Jornada {round.round}</span>
          {!hasUnsaved && <span>✓</span>}
        </div>
        <span className="text-gray-500 text-xs font-semibold">{isOpen ? "▲ OCULTAR" : "▼ VER PARTIDOS"}</span>
      </div>
      <div className="px-4"><RestingNote matches={allMatches} round={round.round} /></div>
      {isOpen && (
        <div className="px-4 pb-4">
          {isAdmin && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">📅 Fecha (opcional)</label>
              <input
                type="date"
                value={round.date || ""}
                onChange={(e) => onSetDate(round.round, e.target.value)}
                className="bg-[#0f172a] border border-gray-700 rounded-lg text-gray-50 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              isAdmin={isAdmin}
              ls={ls}
              setLs={setLs}
              onSave={onSave}
              onEdit={onEdit}
              onDelete={onDelete}
              locked={locked}
              accentColor="#db2777"
              scoringFormat={scoringFormat}
              stageLabel="📅 LIGA"
            />
          ))}
        </div>
      )}
    </div>
  );
}
