import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { shuffle, buildShareMessage } from "../../logic/utils";
import { buildBracket } from "../../logic/relampago";
import { buildGroups } from "../../logic/mundialito";
import { buildPozoRound, shufflePlayers } from "../../logic/pozo";

const SCORING_OPTIONS = [
  { id: "timed", icon: "⏱️", name: "Por tiempo",   desc: "Se anota al terminar el tiempo" },
  { id: "rally", icon: "🎯", name: "Rally scoring", desc: "Cada punto ganado cuenta" },
  { id: "games", icon: "🏆", name: "Por games",     desc: "Primero en llegar a X games" },
];

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-4">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

export default function SetupPairs({ t, code, isAdmin, persist, copyCode, typeInfo, onExitEdit }) {
  const color = typeInfo?.color || "#10b981";

  const [localName,     setLocalName]     = useState(t.config.name       || "");
  const [localDesc,     setLocalDesc]     = useState(t.config.description || "");
  const [localLocation, setLocalLocation] = useState(t.config.location   || "");
  const [localDatetime, setLocalDatetime] = useState(t.config.datetime   || "");
  const [newP1,         setNewP1]         = useState("");
  const [newP2,         setNewP2]         = useState("");
  const [newPlayer,     setNewPlayer]     = useState("");
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [rallyCustom,   setRallyCustom]   = useState("");
  const [gamesCustom,   setGamesCustom]   = useState("");
  const [minutesCustom, setMinutesCustom] = useState("");
  const [saved,         setSaved]         = useState(false);
  const [editingIdx,    setEditingIdx]    = useState(null);
  const [editP1,        setEditP1]        = useState("");
  const [editP2,        setEditP2]        = useState("");

  const [localTargetRounds, setLocalTargetRounds] = useState(
    t.config.targetRounds != null ? String(t.config.targetRounds) : ""
  );

  const debName         = useRef(null);
  const debDesc         = useRef(null);
  const debLocation     = useRef(null);
  const debDatetime     = useRef(null);
  const debRally        = useRef(null);
  const debGames        = useRef(null);
  const debMinutes      = useRef(null);
  const debTargetRounds = useRef(null);
  const navigate    = useNavigate();
  const p1InputRef  = useRef(null);
  const p2InputRef  = useRef(null);

  const isMixer   = t.type === "pozo" && t.config.pozoMode === "mixer";
  const pairs     = t.pairInputs || [];
  const players   = t.playerInputs || [];
  const act       = isMixer ? t.config.courts * 4 : t.config.courts * 2;
  const tot       = isMixer ? players.length : pairs.length;
  const sit       = Math.max(0, tot - act);
  const need      = Math.max(0, act - tot);

  const statusBg  = need > 0 ? "bg-red-400/10 border-red-400/20"    : sit > 0 ? "bg-yellow-400/10 border-yellow-400/20"    : "bg-green-400/10 border-green-400/20";
  const statusTxt = need > 0 ? "text-red-400"                       : sit > 0 ? "text-yellow-400"                          : "text-green-400";
  const isPozo = t.type === "pozo";

  const statusMsg = isPozo
    ? need > 0
      ? `⚠️ Faltan ${need} ${isMixer ? "jugadores" : "parejas"}`
      : sit === 0
        ? `✅ Canchas completas (Nadie descansa)`
        : `⏳ Descansan ${sit} ${isMixer ? "jugadores" : "parejas"} por ronda`
    : `${tot} parejas · ${t.config.courts} pistas · ${Math.min(tot, act)} juegan` +
      (sit > 0 ? ` · ⏳ ${sit} descansan` : need > 0 ? ` · ⚠️ faltan ${need}` : " · ✓ listo");

  const ok = isMixer
    ? players.length >= act && players.every(p => p.name.trim())
    : isPozo
      ? pairs.length >= act && pairs.every(p => p.p1.trim() && p.p2.trim())
      : tot >= 2 && pairs.every(p => p.p1.trim() && p.p2.trim());
  const scoring = t.config.scoringSystem || "timed";

  function handleName(val) {
    setLocalName(val);
    clearTimeout(debName.current);
    debName.current = setTimeout(() => persist({ ...t, config: { ...t.config, name: val } }), 600);
  }
  function handleDesc(val) {
    setLocalDesc(val);
    clearTimeout(debDesc.current);
    debDesc.current = setTimeout(() => persist({ ...t, config: { ...t.config, description: val } }), 600);
  }
  function handleLocation(val) {
    setLocalLocation(val);
    clearTimeout(debLocation.current);
    debLocation.current = setTimeout(() => persist({ ...t, config: { ...t.config, location: val } }), 600);
  }
  function handleDatetime(val) {
    setLocalDatetime(val);
    clearTimeout(debDatetime.current);
    debDatetime.current = setTimeout(() => persist({ ...t, config: { ...t.config, datetime: val } }), 600);
  }
  function handleRallyCustom(val) {
    setRallyCustom(val);
    clearTimeout(debRally.current);
    const num = parseInt(val);
    if (!isNaN(num) && num > 0) {
      debRally.current = setTimeout(() => persist({ ...t, config: { ...t.config, rallyPoints: num } }), 600);
    }
  }
  function handleGamesCustom(val) {
    setGamesCustom(val);
    clearTimeout(debGames.current);
    const num = parseInt(val);
    if (!isNaN(num) && num > 0) {
      debGames.current = setTimeout(() => persist({ ...t, config: { ...t.config, targetGames: num } }), 600);
    }
  }
  function handleMinutesCustom(val) {
    setMinutesCustom(val);
    clearTimeout(debMinutes.current);
    const num = parseInt(val);
    if (!isNaN(num) && num >= 1) {
      debMinutes.current = setTimeout(() => persist({ ...t, config: { ...t.config, matchMinutes: num } }), 600);
    }
  }

  function addPair() {
    if (!newP1.trim() || !newP2.trim()) return;
    persist({ ...t, pairInputs: [...pairs, { id: pairs.length, p1: newP1.trim(), p2: newP2.trim(), pts: 0, gf: 0, gc: 0 }] });
    setNewP1("");
    setNewP2("");
    p1InputRef.current?.focus();
  }

  function addPlayer() {
    if (!newPlayer.trim()) return;
    persist({
      ...t,
      playerInputs: [
        ...(t.playerInputs || []),
        { id: (t.playerInputs || []).length, name: newPlayer.trim() },
      ],
    });
    setNewPlayer("");
  }

  async function onStart() {
    const pairsToStart = t.pairInputs.map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
    const finalConfig = { ...t.config, scoringSystem: t.config.scoringSystem || "timed" };

    if (t.type === "relampago") {
      const bracket = buildBracket(pairsToStart);
      await persist({ ...t, config: finalConfig, bracket, pairs: pairsToStart, phase: "bracket", status: "playing" });
    } else if (t.type === "mundialito") {
      const groups = buildGroups(pairsToStart, t.config.groupCount || 2);
      await persist({ ...t, config: finalConfig, groups, pairs: pairsToStart, phase: "groups", status: "playing" });
    } else if (t.type === "pozo") {
      if (t.config.pozoMode === "mixer") {
        const playersToStart = (t.playerInputs || []).map((p, i) => ({
          ...p,
          courtLevel: i,
          pts: 0, gf: 0, gc: 0,
        }));
        const proposed  = shufflePlayers(playersToStart, t.config.courts);
        const playerMap = Object.fromEntries(playersToStart.map((p) => [p.id, p]));
        const currentPozoRound = proposed.courts.map((court) => {
          const [pA1, pA2] = court.teamA.playerIds.map((id) => playerMap[id]);
          const [pB1, pB2] = court.teamB.playerIds.map((id) => playerMap[id]);
          return {
            courtNum: court.courtNum,
            pairA: {
              id: `tmp_${pA1.id}_${pA2.id}`, _playerIds: [pA1.id, pA2.id],
              p1: pA1.name, p2: pA2.name, pts: 0, gf: 0, gc: 0,
              courtLevel: Math.round((pA1.courtLevel + pA2.courtLevel) / 2),
            },
            pairB: {
              id: `tmp_${pB1.id}_${pB2.id}`, _playerIds: [pB1.id, pB2.id],
              p1: pB1.name, p2: pB2.name, pts: 0, gf: 0, gc: 0,
              courtLevel: Math.round((pB1.courtLevel + pB2.courtLevel) / 2),
            },
            scoreA: "", scoreB: "", saved: false,
          };
        });
        await persist({
          ...t,
          config:           finalConfig,
          players:          playersToStart,
          currentPozoRound,
          sittingOut:       proposed.unassigned || [],
          proposedRound:    null,
          pozoRounds:       [],
          roundNum:         1,
          phase:            "playing",
          status:           "playing",
          timerRunning:     false,
          timerElapsed:     0,
          timerStartedAt:   null,
        });
      } else {
        const sorted      = shuffle(pairsToStart);
        const courtAssign = buildPozoRound(sorted.map((p, i) => ({ ...p, courtLevel: i })), t.config.courts);
        await persist({
          ...t,
          config:           finalConfig,
          pairs:            sorted.map((p, i) => ({ ...p, courtLevel: i })),
          currentPozoRound: courtAssign,
          pozoRounds:       [],
          roundNum:         1,
          phase:            "playing",
          status:           "playing",
          timerRunning:     false,
          timerElapsed:     0,
          timerStartedAt:   null,
        });
      }
    }
    onExitEdit?.();
  }

  function startEdit(i) {
    const p = (t.pairInputs || [])[i];
    setEditP1(p.p1); setEditP2(p.p2);
    setEditingIdx(i);
  }

  function commitEdit(i) {
    const arr = [...(t.pairInputs || [])];
    arr[i] = { ...arr[i], p1: editP1.trim() || arr[i].p1, p2: editP2.trim() || arr[i].p2 };
    persist({ ...t, pairInputs: arr });
    setEditingIdx(null);
  }

  async function handleShare() {
    const msg = buildShareMessage(t, code);
    if (navigator.share) {
      try { await navigator.share({ title: t.config.name, text: msg }); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {}
    }
  }

  const inputCls    = "w-full bg-[#1f2937] border border-gray-700 focus:border-gray-500 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors";
  const addInputCls = "flex-1 bg-[#1f2937] border border-gray-700 focus:border-gray-500 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none transition-colors min-w-0";

  return (
    <div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">

        {/* ── Volver (solo en modo edición post-inicio) ── */}
        {onExitEdit && (
          <button
            onClick={onExitEdit}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors"
            style={{ background: "none", border: "none", padding: 0 }}
          >
            ← Volver al torneo
          </button>
        )}

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-black" style={{ color }}>
              {typeInfo?.icon} {typeInfo?.name}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Código: <span className="text-yellow-400 font-bold tracking-widest">{code}</span>
            </p>
          </div>
          <button
            onClick={handleShare}
            className="text-xs px-3 py-2 rounded-xl border transition-colors cursor-pointer shrink-0 font-semibold"
            style={copied
              ? { background: "#16a34a20", border: "1px solid #16a34a50", color: "#4ade80" }
              : { background: "#1f2937",   border: "1px solid #374151",   color: "#94a3b8" }
            }
          >
            {copied ? "✓ Copiado" : "📤 Compartir"}
          </button>
        </div>

        {/* ── Vista no-admin ── */}
        {!isAdmin && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mb-4">
            <div className="font-bold">{t.config.name}</div>
            <div className="text-xs text-gray-500 mt-1">{t.config.courts} pistas · Esperando al organizador...</div>
          </div>
        )}

        {isAdmin && (
          <>
            {/* ── Nav borrador ── */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => navigate("/")}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                style={{ background: "none", border: "none", padding: 0 }}
              >
                ← Inicio
              </button>
              <button
                onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                style={{ background: "none", border: "none", padding: 0 }}
              >
                {saved ? "✓ Guardado" : "💾 Guardar borrador"}
              </button>
            </div>

            {/* ── Información ── */}
            <SectionHeader>📋 Información</SectionHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Nombre del torneo</label>
                <input value={localName} onChange={e => handleName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">
                  Descripción <span className="text-gray-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={localDesc}
                  onChange={e => handleDesc(e.target.value)}
                  placeholder="Reglas especiales, mensaje a los jugadores..."
                  rows={2}
                  className="w-full bg-[#1f2937] border border-gray-700 focus:border-gray-500 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={localDatetime}
                    onChange={e => handleDatetime(e.target.value)}
                    className="w-full bg-[#1f2937] border border-gray-700 focus:border-gray-500 rounded-xl text-gray-50 px-3 py-3 text-sm outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Ubicación</label>
                  <input
                    value={localLocation}
                    onChange={e => handleLocation(e.target.value)}
                    placeholder="Club, dirección..."
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* ── Configuración ── */}
            <SectionHeader>🏓 Configuración</SectionHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-2">Pistas</label>
                <div className="flex gap-2">
                  {(t.type === "pozo" ? [2,3,4,5,6] : [1,2,3,4,5,6]).map(n => (
                    <button key={n}
                      onClick={() => persist({ ...t, config: { ...t.config, courts: n } })}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                      style={{ background: t.config.courts === n ? color : "#1f2937", color: t.config.courts === n ? "#fff" : "#94a3b8" }}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Mundialito: grupos y avance */}
              {t.type === "mundialito" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Número de grupos</label>
                    <div className="flex gap-2">
                      {[2,3,4].map(n => (
                        <button key={n}
                          onClick={() => persist({ ...t, config: { ...t.config, groupCount: n } })}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                          style={{ background: t.config.groupCount === n ? color : "#1f2937", color: t.config.groupCount === n ? "#fff" : "#94a3b8" }}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Parejas que avanzan por grupo</label>
                    <div className="flex gap-2">
                      {[1,2,3].map(n => (
                        <button key={n}
                          onClick={() => persist({ ...t, config: { ...t.config, advancePerGroup: n } })}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                          style={{ background: t.config.advancePerGroup === n ? color : "#1f2937", color: t.config.advancePerGroup === n ? "#fff" : "#94a3b8" }}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Pozo: duración de ronda y número de rondas */}
              {t.type === "pozo" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">
                      Número de rondas <span className="font-normal text-gray-500">(opcional — vacío = sin límite)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      onKeyDown={(e) => ["-","e","."].includes(e.key) && e.preventDefault()}
                      placeholder="∞  Sin límite"
                      value={localTargetRounds}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocalTargetRounds(val);
                        clearTimeout(debTargetRounds.current);
                        debTargetRounds.current = setTimeout(() => {
                          const n = parseInt(val);
                          persist({
                            ...t,
                            config: { ...t.config, targetRounds: (!val.trim() || isNaN(n) || n < 1) ? null : n },
                          });
                        }, 600);
                      }}
                      className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── Puntuación (no aplica a Pozo) ── */}
            {t.type !== "pozo" && (
              <>
                <SectionHeader>🎯 Puntuación</SectionHeader>
                <div className="flex flex-col gap-2">
                  {SCORING_OPTIONS.map(opt => (
                    <button key={opt.id}
                      onClick={() => persist({ ...t, config: { ...t.config, scoringSystem: opt.id } })}
                      className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer"
                      style={{
                        background: scoring === opt.id ? color + "20" : "#1f2937",
                        border: `1px solid ${scoring === opt.id ? color + "50" : "#374151"}`,
                      }}
                    >
                      <span className="text-xl flex-shrink-0">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold" style={{ color: scoring === opt.id ? color : "#f9fafb" }}>{opt.name}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </div>
                      {scoring === opt.id && <span className="text-xs font-bold" style={{ color }}>✓</span>}
                    </button>
                  ))}
                </div>

                {scoring === "timed" && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mt-2 space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-3">Al terminar el tiempo se anota el resultado. En caso de empate, punto de oro.</p>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">Minutos por partido</label>
                      <div className="flex gap-2">
                        {[8,10,12,15,20].map(n => (
                          <button key={n}
                            onClick={() => { setMinutesCustom(""); persist({ ...t, config: { ...t.config, matchMinutes: n } }); }}
                            className="flex-1 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors"
                            style={{ background: (t.config.matchMinutes ?? 10) === n ? color : "#374151", color: (t.config.matchMinutes ?? 10) === n ? "#fff" : "#94a3b8" }}
                          >{n}</button>
                        ))}
                        <input
                          type="number"
                          value={minutesCustom}
                          onChange={e => handleMinutesCustom(e.target.value)}
                          placeholder="Otro"
                          min={1}
                          max={90}
                          className="w-16 py-2 rounded-lg text-sm text-center font-bold outline-none transition-colors bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">¿Qué se anota?</label>
                      <div className="flex gap-2">
                        {[
                          { id: "games",  label: "Games ganados" },
                          { id: "points", label: "Puntos acumulados" },
                        ].map(opt => (
                          <button key={opt.id}
                            onClick={() => persist({ ...t, config: { ...t.config, timedMetric: opt.id } })}
                            className="flex-1 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors"
                            style={{
                              background: (t.config.timedMetric ?? "games") === opt.id ? color : "#374151",
                              color:      (t.config.timedMetric ?? "games") === opt.id ? "#fff" : "#94a3b8",
                            }}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {scoring === "rally" && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mt-2">
                    <p className="text-xs text-gray-500 mb-3">Cada punto ganado cuenta. Si el partido termina 16-8, cada jugador acumula esos puntos.</p>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Puntos por partido</label>
                    <div className="flex gap-2">
                      {[16,24,32].map(n => (
                        <button key={n}
                          onClick={() => { setRallyCustom(""); persist({ ...t, config: { ...t.config, rallyPoints: n } }); }}
                          className="flex-1 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors"
                          style={{ background: (t.config.rallyPoints ?? 24) === n ? color : "#374151", color: (t.config.rallyPoints ?? 24) === n ? "#fff" : "#94a3b8" }}
                        >{n}</button>
                      ))}
                      <input
                        type="number"
                        value={rallyCustom}
                        onChange={e => handleRallyCustom(e.target.value)}
                        placeholder="Otro"
                        min={1}
                        className="w-16 py-2 rounded-lg text-sm text-center font-bold outline-none transition-colors bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0"
                      />
                    </div>
                  </div>
                )}
                {scoring === "games" && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mt-2">
                    <p className="text-xs text-gray-500 mb-3">Primero en llegar a X games gana el partido.</p>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Games para ganar</label>
                    <div className="flex gap-2">
                      {[4,6,8].map(n => (
                        <button key={n}
                          onClick={() => { setGamesCustom(""); persist({ ...t, config: { ...t.config, targetGames: n } }); }}
                          className="flex-1 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors"
                          style={{ background: (t.config.targetGames ?? 6) === n ? color : "#374151", color: (t.config.targetGames ?? 6) === n ? "#fff" : "#94a3b8" }}
                        >{n}</button>
                      ))}
                      <input
                        type="number"
                        value={gamesCustom}
                        onChange={e => handleGamesCustom(e.target.value)}
                        placeholder="Otro"
                        min={1}
                        className="w-16 py-2 rounded-lg text-sm text-center font-bold outline-none transition-colors bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Barra de estado ── */}
        <div className={`flex items-center px-4 py-2.5 rounded-xl border text-sm font-medium mt-6 mb-1 ${statusBg} ${statusTxt}`}>
          {statusMsg}
        </div>

        {/* ── Parejas / Jugadores ── */}
        {/* Step 4: selector de modo de juego para pozo */}
        {t.type === "pozo" && isAdmin && (
          <div style={{ marginBottom: 16 }}>
            <SectionHeader>Modo de juego</SectionHeader>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "fixed", label: "Parejas fijas" },
                { id: "mixer", label: "Mixer (individual)" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() =>
                    persist({
                      ...t,
                      config:       { ...t.config, pozoMode: id },
                      pairInputs:   [],
                      playerInputs: [],
                    })
                  }
                  style={{
                    padding:      "6px 14px",
                    borderRadius: 8,
                    border:       `2px solid ${t.config.pozoMode === id ? color : "#334155"}`,
                    background:   t.config.pozoMode === id ? `${color}22` : "transparent",
                    color:        t.config.pozoMode === id ? color : "#64748b",
                    fontWeight:   700,
                    cursor:       "pointer",
                    fontSize:     13,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <SectionHeader>{isMixer ? "👤 Jugadores" : "👥 Parejas"}</SectionHeader>

        {!isAdmin && (
          <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
            <div className="text-3xl">⏳</div>
            <div className="text-sm font-semibold text-gray-400">
              El torneo está siendo configurado
            </div>
            <div className="text-xs text-gray-600">
              El organizador está preparando la lista de jugadores
            </div>
          </div>
        )}

        {/* Step 6: lista de jugadores individuales (mixer) */}
        {isAdmin && isMixer && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {players.map((player, idx) => (
              <div
                key={player.id}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  background:     "#0f172a",
                  border:         "1px solid #334155",
                  borderRadius:   10,
                  padding:        "10px 14px",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "#f1f5f9", fontSize: 14 }}>
                  {idx + 1}. {player.name}
                </span>
                <button
                  onClick={() =>
                    persist({
                      ...t,
                      playerInputs: t.playerInputs.filter((_, i) => i !== idx),
                    })
                  }
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lista de parejas fijas */}
        {isAdmin && !isMixer && <div className="space-y-2">
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-[#1f2937] rounded-xl">
              <span className="w-6 h-6 rounded-md bg-gray-700 text-gray-400 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              {editingIdx === i && isAdmin ? (
                <div
                  className="flex-1 flex items-center gap-2 min-w-0"
                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) commitEdit(i); }}
                >
                  <input
                    value={editP1}
                    onChange={e => setEditP1(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && commitEdit(i)}
                    autoFocus
                    className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none text-gray-50 py-0.5 border-b"
                    style={{ borderBottomColor: color }}
                  />
                  <span className="text-gray-600 font-bold shrink-0">/</span>
                  <input
                    value={editP2}
                    onChange={e => setEditP2(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && commitEdit(i)}
                    className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none text-gray-50 py-0.5 border-b"
                    style={{ borderBottomColor: color }}
                  />
                </div>
              ) : (
                <span
                  className={`flex-1 text-sm ${isAdmin ? "cursor-pointer hover:underline hover:decoration-dotted" : ""}`}
                  onClick={() => isAdmin && startEdit(i)}
                >
                  <span className="font-medium">{p.p1}</span>
                  <span className="text-gray-600 mx-1.5">/</span>
                  <span className="font-medium">{p.p2}</span>
                </span>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setEditingIdx(null); persist({ ...t, pairInputs: t.pairInputs.filter((_, idx) => idx !== i) }); }}
                  className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none shrink-0"
                >✕</button>
              )}
            </div>
          ))}
        </div>}

        {/* Step 5: inputs de pareja fija — todos los tipos excepto mixer */}
        {isAdmin && !isMixer && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                ref={p1InputRef}
                value={newP1}
                onChange={e => setNewP1(e.target.value)}
                onKeyDown={e => e.key === "Tab" && (e.preventDefault(), p2InputRef.current?.focus())}
                placeholder="Jugador 1"
                className={addInputCls}
              />
              <span className="text-gray-600 font-bold shrink-0">/</span>
              <input
                ref={p2InputRef}
                value={newP2}
                onChange={e => setNewP2(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPair()}
                placeholder="Jugador 2"
                className={addInputCls}
              />
            </div>
            <button
              onClick={addPair}
              className="w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors"
              style={{ background: newP1.trim() && newP2.trim() ? color : "#374151", color: "#fff" }}
            >
              + Agregar pareja
            </button>
          </div>
        )}

        {/* Step 5: input de jugador individual — solo mixer */}
        {isAdmin && isMixer && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              className="flex-1 bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]"
              placeholder="Nombre del jugador"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
            />
            <button
              onClick={addPlayer}
              disabled={!newPlayer.trim()}
              className="px-4 py-3 rounded-xl font-bold text-sm"
              style={{
                background: newPlayer.trim() ? color : "#334155",
                color:      newPlayer.trim() ? "#fff" : "#64748b",
                cursor:     newPlayer.trim() ? "pointer" : "not-allowed",
              }}
            >
              + Agregar
            </button>
          </div>
        )}

        {/* ── Avanzado ── */}
        {isAdmin && (
          <div className="mt-7">
            <button
              onClick={() => setShowAdvanced(s => !s)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 font-semibold transition-colors cursor-pointer"
            >
              <span>{showAdvanced ? "▾" : "▸"}</span>
              ⚙️ Configuración avanzada
            </button>

            {showAdvanced && (
              <div className="mt-4 bg-[#1f2937] border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-200">Punto de oro en empate</div>
                    <div className="text-xs text-gray-500 mt-0.5">El punto decide el partido igualado</div>
                  </div>
                  <button
                    onClick={() => persist({ ...t, config: { ...t.config, goldenPoint: !(t.config.goldenPoint !== false) } })}
                    className="px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0"
                    style={{
                      background: t.config.goldenPoint !== false ? "#16a34a30" : "#374151",
                      color:      t.config.goldenPoint !== false ? "#4ade80"   : "#94a3b8",
                      border:     `1px solid ${t.config.goldenPoint !== false ? "#4ade8040" : "transparent"}`,
                    }}
                  >
                    {t.config.goldenPoint !== false ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Botón iniciar ── */}
        {isAdmin && (
          <>
            <button
              onClick={onStart}
              disabled={!ok}
              className="w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors"
              style={{
                background: ok ? color  : "#374151",
                color:      ok ? "#fff" : "#64748b",
                cursor:     ok ? "pointer" : "not-allowed",
                opacity:    ok ? 1 : 0.5,
              }}
            >
              🎾 Iniciar Torneo
            </button>
            <p className="text-center text-xs text-gray-600 mt-3">
              Una vez guardado el primer resultado no podrás modificar la configuración del torneo.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
