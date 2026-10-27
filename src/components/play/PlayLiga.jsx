// src/components/play/PlayLiga.jsx
import { useState } from "react";
import { generateRules } from "../../logic/constants";
import { advanceBracket, unadvanceBracket, canEditBracketMatch } from "../../logic/relampago";
import {
  recomputeLigaStandings,
  buildLigaKnockout,
  ligaQualifiers,
  ligaResultsLocked,
  canReopenLiga,
  reopenLigaPatch,
  clearLigaMatch,
} from "../../logic/liga";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import MatchCard from "../shared/MatchCard";
import PairStandings from "../shared/PairStandings";
import { sortStandings, standingsLabels } from "../../logic/standings";

export default function PlayLiga({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("fixture");
  const [ls, setLs] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "start" | "reopen", matchId? }

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

  async function onSetRoundDate(roundNum, date) {
    const updatedRounds = rounds.map((r) =>
      r.round === roundNum ? { ...r, date: date || null } : r,
    );
    await persist({ ...t, rounds: updatedRounds });
  }

  async function onStartKnockout() {
    if (!allMatchesDone) return;
    setConfirm(null);
    const bracket = buildLigaKnockout(t.pairs, ligaQualifiers(t.config, t.pairs.length), matches);
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
    if (!canEditBracketMatch(t.knockoutBracket, matchId)) return;
    await persist({ ...t, knockoutBracket: unadvanceBracket(t.knockoutBracket, matchId) });
  }

  const koRounds = t.knockoutBracket
    ? [...new Set(t.knockoutBracket.map((m) => m.round))].sort((a, b) => a - b)
    : [];
  const champion = playoffEnabled
    ? t.knockoutBracket?.find((m) => !m.nextMatchId && m.saved)?.winner
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
            {locked && (
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
            {rounds
              .slice()
              .sort((a, b) => a.round - b.round)
              .map((r) => (
                <LigaRoundAccordion
                  key={r.round}
                  round={r}
                  matches={matches.filter((m) => m.round === r.round)}
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
            <PairStandings
              pairs={t.pairs || []}
              title="Tabla de posiciones"
              scoringFormat={t.config?.scoringFormat || "sets3"}
              config={t.config}
              matches={matches}
              extra={
                <p className="text-xs text-gray-500 mb-3">
                  Victoria = 1 punto · Derrota = 0 puntos · Desempate: partido entre las igualadas y luego diferencia de{" "}
                  {bySets ? "sets y luego de games" : standingsLabels(t.config).unit === "points" ? "puntos" : "games"}
                </p>
              }
            />
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
                {koRounds.map((round) => (
                  <div key={round}>
                    <div className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-wide">
                      {round === Math.max(...koRounds) ? "Final" : `Ronda ${round}`}
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
                          onEdit={
                            canEditBracketMatch(t.knockoutBracket, match.id)
                              ? onEditKnockoutMatch
                              : undefined
                          }
                          locked={
                            match.saved && !canEditBracketMatch(t.knockoutBracket, match.id)
                          }
                          accentColor="#db2777"
                          scoringFormat={t.config?.scoringFormat || "sets3"}
                        />
                      ))}
                  </div>
                ))}
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
          message="Al iniciar la fase final se cierran los resultados de la liga y ya no se podrán modificar. ¿Iniciar la fase final?"
          confirmLabel="Iniciar"
          danger={false}
          onClose={() => setConfirm(null)}
          onConfirm={onStartKnockout}
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

function LigaRoundAccordion({ round, matches, isAdmin, ls, setLs, onSave, onEdit, onDelete, locked, onSetDate, scoringFormat }) {
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
