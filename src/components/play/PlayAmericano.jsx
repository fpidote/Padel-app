import { useState, useRef, useMemo } from "react";
import { TOURNAMENT_RULES } from "../../logic/constants";
import { pk } from "../../logic/utils";
import { buildRoundAmericano } from "../../logic/americano";
import { THeader, Tabs, SimpleModal } from "../shared/Components";
import History from "../shared/History";

const LEVELS = [
  { id: 0, label: "Sin definir",  short: "-", color: "#64748b" },
  { id: 1, label: "Principiante", short: "P", color: "#94a3b8" },
  { id: 2, label: "Intermedio",   short: "M", color: "#38bdf8" },
  { id: 3, label: "Avanzado",     short: "A", color: "#84cc16" },
];

function PTag({ p }) {
  const lvl = LEVELS[p.level ?? 0];
  if (!lvl || p.level === 0) return null;
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700,
      background: lvl.color + "20", color: lvl.color,
      borderRadius: 4, padding: "1px 4px", marginLeft: 5,
      verticalAlign: "middle"
    }}>
      {lvl.short}
    </span>
  );
}

export default function PlayAmericano({ t, code, isAdmin, persist, copyCode, onEditTournament }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});
  const [viewingRound, setViewingRound] = useState(null); // null = ronda actual
  const [search, setSearch] = useState(null); // null = todos, playerID/pairID = filtrado
  const [modalMsg, setModalMsg] = useState(null);
  const [showLevelsToggle, setShowLevelsToggle] = useState(true);

  async function onSave(ci, isCancel = false) {
    const court = t.currentRound[ci];
    const a = parseInt(
      isCancel ? court.scoreA : (ls[`${ci}_A`] ?? court.scoreA),
    );
    const b = parseInt(
      isCancel ? court.scoreB : (ls[`${ci}_B`] ?? court.scoreB),
    );
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const cr = t.currentRound.map((c, i) =>
      i === ci
        ? { ...c, scoreA: String(a), scoreB: String(b), saved: true }
        : c,
    );
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
    try {
      await persist({ ...t, currentRound: cr });
    } catch (err) {
      console.error("Error al guardar resultado:", err);
      // Revertir estado local para que el admin pueda reintentar
      setLs((prev) => ({ ...prev, [`${ci}_A`]: String(a), [`${ci}_B`]: String(b) }));
      setModalMsg("No se pudo guardar el resultado. Intenta de nuevo.");
    }
  }

  async function onEdit(ci) {
    const court = t.currentRound[ci];
    setLs((prev) => ({
      ...prev,
      [`${ci}_A`]: court.scoreA,
      [`${ci}_B`]: court.scoreB,
    }));
    const cr = t.currentRound.map((c, i) =>
      i === ci ? { ...c, saved: false } : c,
    );
    try {
      await persist({ ...t, currentRound: cr });
    } catch (err) {
      console.error("Error al editar resultado:", err);
      // Revertir ls para que la pista no quede en estado de edición sin respaldo
      setLs((prev) => {
        const n = { ...prev };
        delete n[`${ci}_A`];
        delete n[`${ci}_B`];
        return n;
      });
      setModalMsg("No se pudo editar el resultado. Intenta de nuevo.");
    }
  }

  async function onNext() {
    if (!t.currentRound.every((c) => c.saved)) return;
    const isPairs = t.config.mode === "pairs";
    const entityKey = isPairs ? "pairs" : "players";
    let np = t[entityKey].map((p) => ({ ...p }));
    const nh = { ...t.partnerHistory };
    const nso = { ...t.sitOutHistory };
    t.sittingOut.forEach((p) => {
      nso[p.id] = (nso[p.id] || 0) + 1;
    });
    t.currentRound.forEach((court) => {
      const a = parseInt(court.scoreA),
        b = parseInt(court.scoreB);
      if (isPairs) {
        [court.pairA, court.pairB].forEach((pair, pi) => {
          const won = pi === 0 ? a > b : b > a;
          const p = np.find((x) => x.id === pair.id);
          if (p) {
            p.pts += won ? 1 : 0;
            p.gf += pi === 0 ? a : b;
            p.gc += pi === 0 ? b : a;
          }
        });
      } else {
        [court.pairA, court.pairB].forEach((pair, pi) => {
          nh[pk(pair[0].id, pair[1].id)] =
            (nh[pk(pair[0].id, pair[1].id)] || 0) + 1;
          const won = pi === 0 ? a > b : b > a;
          pair.forEach(({ id }) => {
            const p = np.find((x) => x.id === id);
            if (p) {
              p.pts += won ? 1 : 0;
              p.gf += pi === 0 ? a : b;
              p.gc += pi === 0 ? b : a;
            }
          });
        });
      }
    });
    let nc, nSit;
    if (t.precomputedRounds?.length && t.precomputedRounds[t.roundNum]) {
      const preRound = t.precomputedRounds[t.roundNum];
      nc = preRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
      nSit = preRound.sittingOut;
    } else {
      ({ courts: nc, sittingOut: nSit } = buildRoundAmericano(
        np,
        t.config.courts,
        nh,
        nso,
        t.config.mode,
      ));
    }
    const newRounds = [
      ...t.rounds,
      { num: t.roundNum, courts: t.currentRound, sittingOut: t.sittingOut },
    ];
    setLs({});
    try {
      await persist({
        ...t,
        [entityKey]: np,
        rounds: newRounds,
        currentRound: nc,
        sittingOut: nSit,
        partnerHistory: nh,
        sitOutHistory: nso,
        roundNum: t.roundNum + 1,
      });
    } catch (err) {
      console.error("Error al avanzar ronda:", err);
      setModalMsg("No se pudo avanzar de ronda. Intenta de nuevo.");
    }
  }

  const isPairs = t.config.mode === "pairs";
  const entityKey = isPairs ? "pairs" : "players";
  const standings = [...(t[entityKey] || [])].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  const allSaved = t.currentRound?.every((c) => c.saved);
  const isFinished = !!(
    (t.config.maxRounds && t.roundNum >= t.config.maxRounds)
    || (t.precomputedRounds?.length && t.roundNum > t.precomputedRounds.length)
  );

  const allPlayers = isPairs
    ? [...(t.pairs || [])].sort((a, b) => `${a.p1} ${a.p2}`.localeCompare(`${b.p1} ${b.p2}`))
        .map((p) => ({ id: p.id, label: `${p.p1} / ${p.p2}` }))
    : [...(t.players || [])].sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ id: p.id, label: p.name }));

  function matchesSearch(court) {
    if (!search) return true;
    const ids = isPairs
      ? [court.pairA?.id, court.pairB?.id]
      : [...(court.pairA || []).map((p) => p.id), ...(court.pairB || []).map((p) => p.id)];
    return ids.map(String).includes(String(search));
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`Ronda ${t.roundNum} de ${t.precomputedRounds ? t.precomputedRounds.length : (t.config.maxRounds || "∞")}`}
        onEdit={isAdmin ? onEditTournament : undefined}
      />
      <div style={{ padding: 16 }}>
        {isAdmin && t.roundWarnings?.length > 0 && (
          <WarningsBanner warnings={t.roundWarnings} />
        )}
        <Tabs
          tabs={[
            ["courts", "⚔️ Pistas"],
            ["standings", "🏆 Posiciones"],
            ["history", "📜 Historial"],
            ["rules", "📖 Reglas"],
            ...(t.precomputedRounds?.length ? [["descansos", "💤 Descansos"]] : []),
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>
      <div style={{ padding: "0 16px" }}>
        {tab === "courts" && (
          <>
            {/* ── Filtro por jugador ── */}
            <div className="w-full sm:max-w-xs mb-4">
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">🔍 Filtrar por jugador</label>
              <select
                value={search ?? ""}
                onChange={(e) => setSearch(e.target.value === "" ? null : e.target.value)}
                className="w-full bg-[#1f2937] border border-gray-700 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="">👥 Todos los jugadores</option>
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* ── Toggle niveles ── */}
            {isAdmin && t.config.useLevels && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  onClick={() => setShowLevelsToggle(v => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 12, fontWeight: 600,
                    color: showLevelsToggle ? "#38bdf8" : "#475569"
                  }}
                >
                  <span style={{ fontSize: 16 }}>{showLevelsToggle ? "👁️" : "🙈"}</span>
                  {showLevelsToggle ? "Ocultar niveles" : "Mostrar niveles"}
                </button>
              </div>
            )}

            {search ? (
              <AllRoundsPlayerView
                t={t}
                isAdmin={isAdmin}
                ls={ls}
                setLs={setLs}
                onSave={onSave}
                onEdit={onEdit}
                matchesSearch={matchesSearch}
                useLevels={!!t.config.useLevels}
                showLevelsToggle={showLevelsToggle}
                search={search}
              />
            ) : (
              <>
                {/* ── Tabs de rondas ── */}
                {(t.precomputedRounds || t.rounds?.length > 0) && (
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
                    {t.precomputedRounds
                      ? t.precomputedRounds.map((_, i) => {
                          const rNum = i + 1;
                          const isCurrent = rNum === t.roundNum;
                          const isFuture = rNum > t.roundNum;
                          const isActive = isCurrent ? viewingRound === null : viewingRound === rNum;
                          return (
                            <button
                              key={i}
                              onClick={() => setViewingRound(isCurrent ? null : rNum)}
                              style={{
                                flexShrink: 0,
                                padding: "6px 12px",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                background: isActive ? "#0284c7" : isFuture ? "#111827" : "#1f2937",
                                color: isActive ? "#fff" : isFuture ? "#334155" : "#64748b",
                              }}
                            >
                              R{rNum}{isCurrent ? " ●" : ""}
                            </button>
                          );
                        })
                      : <>
                          {t.rounds.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => setViewingRound(i + 1)}
                              style={{
                                flexShrink: 0,
                                padding: "6px 12px",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                background: viewingRound === i + 1 ? "#0284c7" : "#1f2937",
                                color: viewingRound === i + 1 ? "#fff" : "#64748b",
                              }}
                            >
                              R{r.num || i + 1}
                            </button>
                          ))}
                          <button
                            onClick={() => setViewingRound(null)}
                            style={{
                              flexShrink: 0,
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              background: viewingRound === null ? "#0284c7" : "#1f2937",
                              color: viewingRound === null ? "#fff" : "#94a3b8",
                            }}
                          >
                            R{t.roundNum} ●
                          </button>
                        </>
                    }
                  </div>
                )}

                {viewingRound !== null ? (
                  (t.precomputedRounds && viewingRound > t.roundNum) ? (
                    <FutureRound
                      round={t.precomputedRounds[viewingRound - 1]}
                      roundNum={viewingRound}
                      matchesSearch={matchesSearch}
                      isAdmin={isAdmin}
                      useLevels={!!t.config.useLevels}
                      showLevelsToggle={showLevelsToggle}
                      players={t.players}
                    />
                  ) : (
                    <HistoryRound
                      round={t.rounds[viewingRound - 1]}
                      roundNum={viewingRound}
                      matchesSearch={matchesSearch}
                      isAdmin={isAdmin}
                      useLevels={!!t.config.useLevels}
                      showLevelsToggle={showLevelsToggle}
                      players={t.players}
                    />
                  )
                ) : (
                  <CourtsAmericano
                    t={t}
                    isAdmin={isAdmin}
                    ls={ls}
                    setLs={setLs}
                    allSaved={allSaved}
                    onSave={onSave}
                    onNext={onNext}
                    onEdit={onEdit}
                    matchesSearch={matchesSearch}
                    persist={persist}
                    isFinished={isFinished}
                    showLevelsToggle={showLevelsToggle}
                  />
                )}
              </>
            )}
          </>
        )}
        {tab === "standings" && (
          <StandingsAmericano rows={standings} roundNum={t.roundNum} useLevels={!!t.config.useLevels} isAdmin={isAdmin} showLevelsToggle={showLevelsToggle} setShowLevelsToggle={setShowLevelsToggle} />
        )}
        {tab === "history" && (
          <>
            <div className="w-full sm:max-w-xs mb-4">
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">🔍 Filtrar por jugador</label>
              <select
                value={search ?? ""}
                onChange={(e) => setSearch(e.target.value === "" ? null : e.target.value)}
                className="w-full bg-[#1f2937] border border-gray-700 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none"
              >
                <option value="">👥 Todos los jugadores</option>
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <History rounds={t.rounds} matchesSearch={matchesSearch} />
          </>
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
              Reglas del Torneo Americano
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
              {TOURNAMENT_RULES.americano.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab === "descansos" && t.precomputedRounds?.length > 0 && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-gray-500 font-semibold mb-3">Jugadores que descansan por ronda</p>
            {t.precomputedRounds.map((round, i) => {
              const rNum = i + 1;
              const isCurrent = rNum === t.roundNum;
              const names = round.sittingOut?.length
                ? round.sittingOut.map(p => p.name).join(", ")
                : "Nadie descansa";
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-1.5 text-sm ${
                    isCurrent
                      ? "bg-yellow-400/10 border border-yellow-400/20"
                      : "bg-[#1f2937] border border-gray-700"
                  }`}
                >
                  <span className={`font-black text-xs shrink-0 w-8 ${isCurrent ? "text-yellow-400" : "text-gray-500"}`}>
                    R{rNum}{isCurrent ? " ●" : ""}
                  </span>
                  <span className={isCurrent ? "text-yellow-200 font-medium" : "text-gray-400"}>
                    {names}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modalMsg && <SimpleModal message={modalMsg} onClose={() => setModalMsg(null)} />}
    </div>
  );
}

function FilteredCurrentRound({ t, isAdmin, ls, setLs, onSave, onEdit, matchesSearch, highlightId, useLevels, showLevelsToggle }) {
  const courts = (t.currentRound || [])
    .map((court, ci) => ({ court, ci }))
    .filter(({ court }) => matchesSearch(court));

  const isSittingOut = courts.length === 0 && (t.sittingOut || []).some(
    (p) => String(p.id ?? p) === String(highlightId)
  );

  const showLevel = useLevels && isAdmin && showLevelsToggle;
  const playersDict = useMemo(() => {
    const dict = {};
    t.players?.forEach(p => { dict[p.id] = p; });
    return dict;
  }, [t.players]);

  function renderName(pair) {
    if (Array.isArray(pair)) {
      return pair.map((p) => {
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        const currentPlayer = playersDict[p.id] || p;
        const lvl = LEVELS[currentPlayer.level || 0];
        return (
          <span key={p.id} className={`text-sm leading-snug flex items-center gap-1 ${isHighlighted ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
            {p.name}
            {showLevel && currentPlayer.level > 0 && lvl && (
              <span style={{ fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px" }}>
                {lvl.short}
              </span>
            )}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return (
      <span className={`text-sm leading-snug ${isHighlighted ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
        {pair?.p1} / {pair?.p2}
      </span>
    );
  }

  return (
    <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 tracking-widest">RONDA {t.roundNum}</span>
        <span className="text-xs text-sky-400 font-semibold">● EN CURSO</span>
      </div>
      {courts.length === 0 ? (
        <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">
          {isSittingOut ? "⏳ Descansa esta ronda" : "Sin partido asignado"}
        </div>
      ) : (
        courts.map(({ court, ci }) => {
          const scoreA = parseInt(court.scoreA);
          const scoreB = parseInt(court.scoreB);
          const wonA = !isNaN(scoreA) && !isNaN(scoreB) && scoreA > scoreB;
          const wonB = !isNaN(scoreA) && !isNaN(scoreB) && scoreB > scoreA;
          const hasValid =
            ls[`${ci}_A`] !== undefined && ls[`${ci}_B`] !== undefined &&
            ls[`${ci}_A`] !== "" && ls[`${ci}_B`] !== "" &&
            Number(ls[`${ci}_A`]) !== Number(ls[`${ci}_B`]);

          return (
            <div key={ci} className="px-4 py-4">
              <div className="text-xs font-bold text-gray-500 tracking-widest mb-3">PISTA {ci + 1}</div>
              <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
                <div className="flex flex-col items-end self-center">{renderName(court.pairA)}</div>
                <div className="flex items-center gap-1.5 self-center">
                  {court.saved ? (
                    <>
                      <div
                        onClick={() => isAdmin && onEdit(ci)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                      >{court.scoreA}</div>
                      <span className="text-gray-600 font-black text-lg">-</span>
                      <div
                        onClick={() => isAdmin && onEdit(ci)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                      >{court.scoreB}</div>
                    </>
                  ) : isAdmin ? (
                    <>
                      <input
                        type="number" min="0"
                        value={ls[`${ci}_A`] ?? ""}
                        onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))}
                        onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                        className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-gray-600 font-black text-lg">-</span>
                      <input
                        type="number" min="0"
                        value={ls[`${ci}_B`] ?? ""}
                        onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))}
                        onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                        className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </>
                  ) : (
                    <span className="text-gray-600 font-black text-lg">–</span>
                  )}
                </div>
                <div className="flex flex-col items-start self-center">{renderName(court.pairB)}</div>
              </div>
              {isAdmin && !court.saved && hasValid && (
                <div className="pt-3">
                  <button
                    onClick={() => onSave(ci)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer transition-colors"
                  >
                    Guardar resultado
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function AllRoundsPlayerView({ t, isAdmin, ls, setLs, onSave, onEdit, matchesSearch, useLevels, showLevelsToggle, search, isPairs }) {
  const hasPast = (t.rounds || []).length > 0;
  const hasFuture = t.precomputedRounds && t.precomputedRounds.length > t.roundNum;

  if (!hasPast && !hasFuture && !t.currentRound?.length) {
    return <div className="text-center text-gray-600 py-8 text-sm">Aún no hay rondas</div>;
  }

  return (
    <div className="space-y-3">
      {(t.rounds || []).map((round, i) => (
        <HistoryRound
          key={i}
          round={round}
          roundNum={round.num || i + 1}
          matchesSearch={matchesSearch}
          isAdmin={isAdmin}
          useLevels={useLevels}
          showLevelsToggle={showLevelsToggle}
          players={t.players}
          highlightId={search}
          playerView
        />
      ))}
      {t.currentRound?.length > 0 && (
        <FilteredCurrentRound
          t={t}
          isAdmin={isAdmin}
          ls={ls}
          setLs={setLs}
          onSave={onSave}
          onEdit={onEdit}
          matchesSearch={matchesSearch}
          highlightId={search}
          useLevels={useLevels}
          showLevelsToggle={showLevelsToggle}
        />
      )}
      {t.precomputedRounds && t.precomputedRounds
        .slice(t.roundNum)
        .map((round, i) => (
          <FutureRound
            key={`future-${t.roundNum + i}`}
            round={round}
            roundNum={t.roundNum + 1 + i}
            matchesSearch={matchesSearch}
            isAdmin={isAdmin}
            useLevels={useLevels}
            showLevelsToggle={showLevelsToggle}
            players={t.players}
            highlightId={search}
            playerView
          />
        ))}
    </div>
  );
}

function CourtsAmericano({ t, isAdmin, ls, setLs, allSaved, onSave, onNext, onEdit, matchesSearch, persist, isFinished, showLevelsToggle }) {
  const [editingName, setEditingName] = useState(null);
  const debName = useRef(null);
  const showLevel = t.config.useLevels && isAdmin && showLevelsToggle;
  const isPairs = t.config.mode === "pairs";

  function renderNames(pair) {
    if (!pair) return [];
    if (Array.isArray(pair)) return pair.map((p) => p.name || "");
    return [`${pair.p1} / ${pair.p2}`];
  }

  function getLevels(pair) {
    if (!Array.isArray(pair)) return [];
    return pair.map((p) => LEVELS[p.level || 0]);
  }

  function hasValidScore(ci) {
    const a = ls[`${ci}_A`];
    const b = ls[`${ci}_B`];
    return a !== undefined && b !== undefined && a !== "" && b !== "" && Number(a) !== Number(b);
  }

  function handleNameChange(type, id, field, val) {
    setEditingName(prev => prev ? { ...prev, value: val } : null);
    clearTimeout(debName.current);
    debName.current = setTimeout(async () => {
      try {
        if (type === "player") {
          const updatedPlayers = (t.players || []).map(p => p.id === id ? { ...p, name: val } : p);
          const updatedRound = (t.currentRound || []).map(c => ({
            ...c,
            pairA: Array.isArray(c.pairA) ? c.pairA.map(p => p.id === id ? { ...p, name: val } : p) : c.pairA,
            pairB: Array.isArray(c.pairB) ? c.pairB.map(p => p.id === id ? { ...p, name: val } : p) : c.pairB,
          }));
          await persist({ ...t, players: updatedPlayers, currentRound: updatedRound });
        } else {
          const updatedPairs = (t.pairs || []).map(p => p.id === id ? { ...p, [field]: val } : p);
          const updatedRound = (t.currentRound || []).map(c => ({
            ...c,
            pairA: c.pairA?.id === id ? { ...c.pairA, [field]: val } : c.pairA,
            pairB: c.pairB?.id === id ? { ...c.pairB, [field]: val } : c.pairB,
          }));
          await persist({ ...t, pairs: updatedPairs, currentRound: updatedRound });
        }
      } catch (err) {
        console.error("Error al guardar nombre:", err);
      }
    }, 800);
  }

  function getCurrentName(type, id, field) {
    if (type === "player") return (t.players || []).find(p => p.id === id)?.[field] ?? "";
    return (t.pairs || []).find(p => p.id === id)?.[field] ?? "";
  }

  function renderEditableName(type, id, field, displayName, lvl, levelPosition) {
    const isEditingThis = editingName?.type === type && editingName?.id === id && editingName?.field === field;
    return (
      <div key={`${type}-${id}-${field}`} className="leading-snug flex items-center gap-1">
        {levelPosition === "before" && showLevel && lvl && (
          <span style={{ fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px" }}>
            {lvl.short}
          </span>
        )}
        {isAdmin && isEditingThis ? (
          <input
            autoFocus
            value={editingName.value}
            onChange={e => handleNameChange(type, id, field, e.target.value)}
            onBlur={() => setEditingName(null)}
            onKeyDown={e => e.key === "Enter" && setEditingName(null)}
            style={{ background: "transparent", border: "none", borderBottom: "1px solid #0284c7", fontSize: 14, fontWeight: 700, color: "#f1f5f9", outline: "none", width: 90 }}
          />
        ) : (
          <span
            className="text-sm font-bold text-gray-50"
            onClick={() => isAdmin && setEditingName({ type, id, field, value: getCurrentName(type, id, field) })}
            style={isAdmin ? { cursor: "pointer" } : undefined}
          >
            {displayName}
          </span>
        )}
        {levelPosition === "after" && showLevel && lvl && (
          <span style={{ fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px" }}>
            {lvl.short}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {t.sittingOut?.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
          <span>⏳</span>
          <span className="text-yellow-400 font-semibold shrink-0">Descansan:</span>
          <span className="text-gray-400">
            {t.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}
          </span>
        </div>
      )}

      {(t.currentRound || []).map((court, ci) => {
        if (!matchesSearch(court)) return null;
        const scoreA = parseInt(court.scoreA);
        const scoreB = parseInt(court.scoreB);
        const namesA = renderNames(court.pairA);
        const namesB = renderNames(court.pairB);
        const levelsA = getLevels(court.pairA);
        const levelsB = getLevels(court.pairB);

        return (
          <div key={ci} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700">
              <span className="text-xs font-bold text-gray-500 tracking-widest">PISTA {ci + 1}</span>
              <div className="flex items-center gap-2">
                {court.saved && isAdmin && (
                  <button
                    onClick={() => onEdit(ci)}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sky-400 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    ✏️ Editar
                  </button>
                )}
              </div>
            </div>

            {/* Body — 3 columnas */}
            <div className="grid px-4 py-4" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
              {/* Equipo A */}
              <div className="flex flex-col items-end self-center">
                {!isPairs
                  ? (court.pairA || []).map((player, i) => renderEditableName("player", player.id, "name", player.name, levelsA[i], "before"))
                  : isAdmin
                    ? ["p1", "p2"].map(f => renderEditableName("pair", court.pairA.id, f, court.pairA[f], null, "before"))
                    : <span className="text-sm font-bold text-gray-50 leading-snug">{namesA[0]}</span>
                }
              </div>

              {/* Score */}
              <div className="flex items-center gap-1.5 self-center">
                {court.saved ? (
                  <>
                    <div
                      onClick={() => isAdmin && onEdit(ci)}
                      title={isAdmin ? "Click para editar" : undefined}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${scoreA > scoreB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                    >
                      {court.scoreA}
                    </div>
                    <span className="text-gray-600 font-black text-lg">-</span>
                    <div
                      onClick={() => isAdmin && onEdit(ci)}
                      title={isAdmin ? "Click para editar" : undefined}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${scoreB > scoreA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                    >
                      {court.scoreB}
                    </div>
                  </>
                ) : isAdmin ? (
                  <>
                    <input
                      type="number" min="0"
                      value={ls[`${ci}_A`] ?? ""}
                      onChange={(e) => setLs((prev) => ({ ...prev, [`${ci}_A`]: e.target.value }))}
                      onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                      className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-gray-600 font-black text-lg">-</span>
                    <input
                      type="number" min="0"
                      value={ls[`${ci}_B`] ?? ""}
                      onChange={(e) => setLs((prev) => ({ ...prev, [`${ci}_B`]: e.target.value }))}
                      onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                      className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </>
                ) : (
                  <span className="text-gray-600 font-black text-lg">–</span>
                )}
              </div>

              {/* Equipo B */}
              <div className="flex flex-col items-start self-center">
                {!isPairs
                  ? (court.pairB || []).map((player, i) => renderEditableName("player", player.id, "name", player.name, levelsB[i], "after"))
                  : isAdmin
                    ? ["p1", "p2"].map(f => renderEditableName("pair", court.pairB.id, f, court.pairB[f], null, "after"))
                    : <span className="text-sm font-bold text-gray-50 leading-snug">{namesB[0]}</span>
                }
              </div>
            </div>

            {court.saved && isAdmin && (
              <div className="text-xs text-gray-600 text-center pb-2 -mt-1 whitespace-nowrap">
                ✓ guardado · toca para editar
              </div>
            )}

            {/* Footer */}
            {isAdmin && !court.saved && hasValidScore(ci) && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => onSave(ci)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer transition-colors"
                >
                  Guardar resultado
                </button>
              </div>
            )}
          </div>
        );
      })}

      {allSaved && isAdmin && (
        <button
          onClick={isFinished ? undefined : onNext}
          disabled={isFinished}
          className="w-full py-4 rounded-2xl font-black text-base text-white mt-2"
          style={{ background: isFinished ? "#374151" : "#059669", cursor: isFinished ? "not-allowed" : "pointer" }}
        >
          {isFinished ? "🏁 Torneo Finalizado" : "Siguiente Ronda ➔"}
        </button>
      )}
      {!isAdmin && !allSaved && (
        <div className="text-center text-gray-600 py-5 text-sm">
          👀 Modo vista · Esperando resultados
        </div>
      )}
    </div>
  );
}

function HistoryRound({ round, roundNum, matchesSearch, isAdmin, useLevels, showLevelsToggle, players, highlightId, playerView }) {
  if (!round) return null;
  const showLevel = useLevels && isAdmin && showLevelsToggle;
  const playersDict = useMemo(() => {
    const dict = {};
    players?.forEach(p => { dict[p.id] = p; });
    return dict;
  }, [players]);
  const renderPairName = (pair) => {
    if (Array.isArray(pair)) {
      return pair.map((p, i) => {
        const currentPlayer = playersDict[p.id] || p;
        const lvl = LEVELS[currentPlayer.level || 0];
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        return (
          <span key={p.id} className={isHighlighted ? "font-black text-sky-300" : undefined}>
            {i > 0 && <span style={{ color: "#94a3b8" }}> & </span>}
            {p.name}
            {showLevel && (
              <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px", marginLeft: 4 }}>
                {lvl.short}
              </span>
            )}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return <span className={isHighlighted ? "font-black text-sky-300" : undefined}>{pair?.p1} / {pair?.p2}</span>;
  };
  const visibleCourts = (round.courts || [])
    .map((court, i) => ({ court, i }))
    .filter(({ court }) => matchesSearch(court));

  const courtContent = visibleCourts.map(({ court, i }) => {
    const a = parseInt(court.scoreA), b = parseInt(court.scoreB);
    const wonA = !isNaN(a) && !isNaN(b) && a > b;
    const wonB = !isNaN(a) && !isNaN(b) && b > a;
    if (playerView) {
      return (
        <div key={i} className="px-4 py-4 border-t border-gray-800 first:border-0">
          <div className="text-xs font-bold text-gray-500 tracking-widest mb-3">PISTA {i + 1}</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
            <div className="flex flex-col items-end self-center">
              <div style={{ fontWeight: 700, color: wonA ? "#4ade80" : "#f1f5f9", fontSize: 14, textAlign: "right" }}>
                {renderPairName(court.pairA)}{wonA && <span style={{ marginLeft: 6 }}>🏆</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-center">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>
                {court.scoreA}
              </div>
              <span className="text-gray-600 font-black text-lg">-</span>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>
                {court.scoreB}
              </div>
            </div>
            <div className="flex flex-col items-start self-center">
              <div style={{ fontWeight: 700, color: wonB ? "#4ade80" : "#f1f5f9", fontSize: 14 }}>
                {wonB && <span style={{ marginRight: 6 }}>🏆</span>}{renderPairName(court.pairB)}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={i} style={{ background: "#1e293b", borderRadius: 12, padding: 16, borderLeft: "4px solid #334155" }}>
        <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, marginBottom: 12 }}>Pista {i + 1}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: wonA ? "#4ade80" : "#f1f5f9", fontSize: 14 }}>
              {renderPairName(court.pairA)}{wonA && <span style={{ marginLeft: 6 }}>🏆</span>}
            </div>
          </div>
          <div style={{ background: "#0f172a", padding: "8px 14px", borderRadius: 8, fontSize: 24, fontWeight: 900, color: "#f1f5f9" }}>
            {court.scoreA}-{court.scoreB}
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 700, color: wonB ? "#4ade80" : "#f1f5f9", fontSize: 14 }}>
              {wonB && <span style={{ marginRight: 6 }}>🏆</span>}{renderPairName(court.pairB)}
            </div>
          </div>
        </div>
      </div>
    );
  });

  if (playerView) {
    return (
      <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 tracking-widest">RONDA {roundNum}</span>
          <span className="text-xs text-green-400 font-semibold">✓ completada</span>
        </div>
        {round.sittingOut?.length > 0 && (
          <div className="px-4 py-2.5 border-b border-yellow-400/20 bg-yellow-400/10 flex items-center gap-2 text-sm">
            <span className="text-yellow-400 font-semibold">⏳ Descansaron:</span>
            <span className="text-gray-400">{round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(", ")}</span>
          </div>
        )}
        {courtContent}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {round.sittingOut?.length > 0 && (
        <div style={{ background: "#fbbf2422", border: "1px solid #fbbf2455", color: "#fbbf24", padding: 12, borderRadius: 8, fontSize: 14 }}>
          <span style={{ fontWeight: 700 }}>⏳ Descansaron: </span>
          <span style={{ fontWeight: 500 }}>{round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(", ")}</span>
        </div>
      )}
      {courtContent}
    </div>
  );
}

function FutureRound({ round, roundNum, matchesSearch, isAdmin, useLevels, showLevelsToggle, players, highlightId, playerView }) {
  if (!round) return null;
  const showLevel = useLevels && isAdmin && showLevelsToggle;
  const playersDict = useMemo(() => {
    const dict = {};
    players?.forEach(p => { dict[p.id] = p; });
    return dict;
  }, [players]);

  function renderPair(pair) {
    if (!pair) return null;
    if (Array.isArray(pair)) {
      return pair.map((p) => {
        const currentPlayer = playersDict[p.id] || p;
        const lvl = LEVELS[currentPlayer.level || 0];
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        return (
          <span key={p.id} className="flex items-center gap-1 leading-snug">
            <span className={`text-sm font-bold ${isHighlighted ? "font-black text-sky-300" : "text-gray-50"}`}>{p.name}</span>
            {showLevel && currentPlayer.level > 0 && lvl && (
              <span style={{ fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px" }}>
                {lvl.short}
              </span>
            )}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return <span className={`text-sm font-bold ${isHighlighted ? "font-black text-sky-300" : "text-gray-50"}`}>{`${pair.p1} / ${pair.p2}`}</span>;
  }

  const visibleCourts = (round.courts || [])
    .map((court, i) => ({ court, i }))
    .filter(({ court }) => matchesSearch(court));

  const courtItems = visibleCourts.map(({ court, i }) => {
    const courtBody = (
      <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
        <div className="flex flex-col items-end self-center">{renderPair(court.pairA)}</div>
        <div className="flex items-center gap-1.5 self-center">
          <div className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-center text-xl font-black text-gray-700">–</div>
          <span className="text-gray-700 font-black text-lg">-</span>
          <div className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-center text-xl font-black text-gray-700">–</div>
        </div>
        <div className="flex flex-col items-start self-center">{renderPair(court.pairB)}</div>
      </div>
    );
    if (playerView) {
      return (
        <div key={i} className="px-4 py-4 border-t border-gray-800 first:border-0">
          <div className="text-xs font-bold text-gray-500 tracking-widest mb-3">PISTA {i + 1}</div>
          {courtBody}
        </div>
      );
    }
    return (
      <div key={i} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3 opacity-70">
        <div className="flex items-center px-4 py-2.5 border-b border-gray-700">
          <span className="text-xs font-bold text-gray-600 tracking-widest">PISTA {i + 1}</span>
        </div>
        <div className="px-4 py-4">{courtBody}</div>
      </div>
    );
  });

  if (playerView) {
    return (
      <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden opacity-70">
        <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 tracking-widest">RONDA {roundNum}</span>
          <span className="text-xs text-gray-600 font-semibold">📅 próxima</span>
        </div>
        {round.sittingOut?.length > 0 && (
          <div className="px-4 py-2.5 border-b border-yellow-400/20 bg-yellow-400/10 flex items-center gap-2 text-sm">
            <span className="text-yellow-400 font-semibold">⏳ Descansarán:</span>
            <span className="text-gray-400">{round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(", ")}</span>
          </div>
        )}
        {courtItems}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {round.sittingOut?.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
          <span>⏳</span>
          <span className="text-yellow-400 font-semibold shrink-0">Descansarán:</span>
          <span className="text-gray-400">{round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}</span>
        </div>
      )}
      <div className="mb-3">
        <span className="text-xs font-bold text-gray-600 bg-[#1e293b] border border-gray-800 rounded-md px-2 py-0.5">
          📅 Emparejamientos tentativos
        </span>
      </div>
      {courtItems}
    </div>
  );
}

function WarningsBanner({ warnings }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm font-bold">⚠️ Restricciones relajadas</span>
          <span className="text-xs text-amber-500/80 bg-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
            {warnings.length}
          </span>
        </div>
        <span className="text-amber-500/60 text-xs font-bold">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-200/80 bg-amber-500/5 rounded-lg px-3 py-2">
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const thStyleS = { padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" };
const tdCenterS = { padding: "10px 10px", textAlign: "center" };

function StandingsAmericano({ rows, roundNum, useLevels, isAdmin, showLevelsToggle, setShowLevelsToggle }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>🏆 Tabla - Ronda {roundNum}</div>
        {isAdmin && useLevels && (
          <button
            onClick={() => setShowLevelsToggle(v => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600,
              color: showLevelsToggle ? "#38bdf8" : "#475569"
            }}
          >
            <span style={{ fontSize: 16 }}>{showLevelsToggle ? "👁️" : "🙈"}</span>
            {showLevelsToggle ? "Ocultar niveles" : "Mostrar niveles"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#475569", padding: "0 16px 10px" }}>
        1º Puntos · 2º Diferencia de games
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0a1120" }}>
            <th style={thStyleS}>#</th>
            <th style={{ ...thStyleS, textAlign: "left" }}>Jugador</th>
            <th style={thStyleS}>PTS</th>
            <th style={thStyleS}>GF</th>
            <th style={thStyleS}>GC</th>
            <th style={thStyleS}>DIF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const d = p.gf - p.gc;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? "#1e293b" : "#172033", borderBottom: "1px solid #1e293b" }}>
                <td style={tdCenterS}>{medal || <span style={{ color: "#64748b", fontSize: 13 }}>{i + 1}</span>}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                  {p.name || `${p.p1} / ${p.p2}`}
                  {p.name && useLevels && isAdmin && showLevelsToggle && <PTag p={p} />}
                </td>
                <td style={{ ...tdCenterS, color: "#38bdf8", fontWeight: 800, fontSize: 14 }}>{p.pts}</td>
                <td style={{ ...tdCenterS, color: "#94a3b8", fontSize: 13 }}>{p.gf}</td>
                <td style={{ ...tdCenterS, color: "#94a3b8", fontSize: 13 }}>{p.gc}</td>
                <td style={{ ...tdCenterS, fontSize: 13, fontWeight: 700, color: d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#64748b" }}>
                  {d > 0 ? `+${d}` : d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
