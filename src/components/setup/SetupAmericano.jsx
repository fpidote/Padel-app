import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { buildFirstRoundAmericano, precomputeAllRounds } from "../../logic/americano";
import { buildShareMessage } from "../../logic/utils";

const COLOR = "#0284c7";

const SCORING_OPTIONS = [
  { id: "timed",  icon: "⏱️", name: "Por tiempo",    desc: "Se anota al terminar el tiempo" },
  { id: "rally",  icon: "🎯", name: "Rally scoring",  desc: "Cada punto ganado cuenta" },
  { id: "games",  icon: "🏆", name: "Por games",      desc: "Primero en llegar a X games" },
];

const LEVELS = [
  { id: 0, label: "Sin definir",  short: "-", color: "#64748b" },
  { id: 1, label: "Principiante", short: "P", color: "#94a3b8" },
  { id: 2, label: "Intermedio",   short: "M", color: "#38bdf8" },
  { id: 3, label: "Avanzado",     short: "A", color: "#84cc16" },
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

export default function SetupAmericano({ t, code, isAdmin, persist, copyCode, onExitEdit }) {
  const isPairs = t.config.mode === "pairs";

  const [localName,     setLocalName]     = useState(t.config.name      || "");
  const [localDesc,     setLocalDesc]     = useState(t.config.description || "");
  const [localLocation, setLocalLocation] = useState(t.config.location  || "");
  const [localDatetime, setLocalDatetime] = useState(t.config.datetime  || "");
  const [newName,       setNewName]       = useState("");
  const [newLvl,        setNewLvl]        = useState(0);
  const [newP1,         setNewP1]         = useState("");
  const [newP2,         setNewP2]         = useState("");
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [rallyCustom,   setRallyCustom]   = useState("");
  const [gamesCustom,   setGamesCustom]   = useState("");
  const [roundsCustom,  setRoundsCustom]  = useState("");
  const [minutesCustom, setMinutesCustom] = useState("");
  const [saved,         setSaved]         = useState(false);
  const [editingIdx,    setEditingIdx]    = useState(null);
  const [editName,      setEditName]      = useState("");
  const [editLvl,       setEditLvl]       = useState(0);
  const [editP1,        setEditP1]        = useState("");
  const [editP2,        setEditP2]        = useState("");
  const [warningDismissed,       setWarningDismissed]       = useState(false);
  const [localPrecomputedRounds, setLocalPrecomputedRounds] = useState(null);
  const [localRoundWarnings,     setLocalRoundWarnings]     = useState([]);
  const [showPreview,            setShowPreview]            = useState(false);

  const debName     = useRef(null);
  const debDesc     = useRef(null);
  const debLocation = useRef(null);
  const debDatetime = useRef(null);
  const debRally    = useRef(null);
  const debGames    = useRef(null);
  const debRounds   = useRef(null);
  const debMinutes  = useRef(null);
  const navigate    = useNavigate();
  const nameInputRef = useRef(null);
  const p1InputRef   = useRef(null);
  const p2InputRef   = useRef(null);

  const units = isPairs ? 2 : 4;
  const act   = t.config.courts * units;
  const tot   = isPairs ? (t.pairInputs?.length ?? 0) : (t.playerInputs?.length ?? 0);
  const sit   = Math.max(0, tot - act);
  const need  = Math.max(0, act - tot);

  const statusBg  = need > 0 ? "bg-red-400/10 border-red-400/20"    : sit > 0 ? "bg-yellow-400/10 border-yellow-400/20"    : "bg-green-400/10 border-green-400/20";
  const statusTxt = need > 0 ? "text-red-400"                       : sit > 0 ? "text-yellow-400"                          : "text-green-400";
  const statusMsg = `${tot} ${isPairs ? "parejas" : "jugadores"} · ${t.config.courts} pistas · ${Math.min(tot, act)} juegan` +
    (sit > 0 ? ` · ⏳ ${sit} descansan` : need > 0 ? ` · ⚠️ faltan ${need}` : " · ✓ listo");

  const ok = isPairs
    ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
    : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0);

  const scoring = t.config.scoringSystem || "timed";
  const useLevels = !!t.config.useLevels;

  const allUnrated = useLevels && !isPairs &&
    (t.playerInputs || []).length > 0 &&
    (t.playerInputs || []).every(p => (p.level || 0) === 0);
  const showUnratedWarning = allUnrated && !warningDismissed;

  const canReshuffle = !isPairs &&
    (t.config.matchmaking || "americano") === "americano" &&
    t.status !== "playing" &&
    ok;

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
  function handleRoundsCustom(val) {
    setRoundsCustom(val);
    clearTimeout(debRounds.current);
    const num = parseInt(val);
    if (!isNaN(num) && num >= 1) {
      debRounds.current = setTimeout(() => {
        setLocalPrecomputedRounds(null);
        setLocalRoundWarnings([]);
        persist({ ...t, config: { ...t.config, maxRounds: num } });
      }, 600);
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

  function handleReshuffle() {
    if (isPairs) return;
    const entities = (t.playerInputs || []).map((p, i) => ({
      id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0
    }));
    const result = precomputeAllRounds(entities, t.config);
    setLocalPrecomputedRounds(result.rounds);
    setLocalRoundWarnings(result.warnings);
    setShowPreview(true);
  }

  function addPlayer() {
    if (!newName.trim()) return;
    setLocalPrecomputedRounds(null);
    setLocalRoundWarnings([]);
    persist({ ...t, playerInputs: [...(t.playerInputs || []), { name: newName.trim(), level: useLevels ? newLvl : 0 }] });
    setNewName("");
    nameInputRef.current?.focus();
  }

  function addPair() {
    if (!newP1.trim() || !newP2.trim()) return;
    const arr = t.pairInputs || [];
    persist({ ...t, pairInputs: [...arr, { id: arr.length, p1: newP1.trim(), p2: newP2.trim(), pts: 0, gf: 0, gc: 0 }] });
    setNewP1("");
    setNewP2("");
    p1InputRef.current?.focus();
  }

  async function onStart() {
    try {
      let entities;
      if (isPairs) {
        entities = t.pairInputs.map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
      } else {
        entities = t.playerInputs.map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }));
      }
      const { courts, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode);
      let precomputedRounds = null;
      let roundWarnings = [];
      if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
        if (localPrecomputedRounds !== null) {
          precomputedRounds = localPrecomputedRounds;
          roundWarnings = localRoundWarnings;
        } else {
          const result = precomputeAllRounds(entities, t.config);
          precomputedRounds = result.rounds;
          roundWarnings = result.warnings;
        }
      }
      await persist({
        ...t,
        [isPairs ? "pairs" : "players"]: entities,
        currentRound: courts,
        sittingOut,
        status: "playing",
        roundNum: 1,
        rounds: [],
        partnerHistory: {},
        sitOutHistory: {},
        precomputedRounds,
        roundWarnings,
      });
      onExitEdit?.();
    } catch (err) {
      console.error("Error al iniciar el torneo:", err);
    }
  }

  function startEdit(i) {
    if (isPairs) {
      const p = (t.pairInputs || [])[i];
      setEditP1(p.p1); setEditP2(p.p2);
    } else {
      const p = (t.playerInputs || [])[i];
      setEditName(p.name); setEditLvl(p.level);
    }
    setEditingIdx(i);
  }

  function commitEdit(i) {
    if (isPairs) {
      const arr = [...(t.pairInputs || [])];
      arr[i] = { ...arr[i], p1: editP1.trim() || arr[i].p1, p2: editP2.trim() || arr[i].p2 };
      persist({ ...t, pairInputs: arr });
    } else {
      const arr = [...(t.playerInputs || [])];
      arr[i] = { ...arr[i], name: editName.trim() || arr[i].name, level: editLvl };
      persist({ ...t, playerInputs: arr });
    }
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

  const inputCls = "w-full bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors";
  const addInputCls = "flex-1 bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none transition-colors min-w-0";

  return (
    <>
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
            <h1 className="text-xl font-black" style={{ color: COLOR }}>🔄 Americano</h1>
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
                  className="w-full bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={localDatetime}
                    onChange={e => handleDatetime(e.target.value)}
                    className="w-full bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-3 py-3 text-sm outline-none transition-colors"
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
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n}
                      onClick={() => { setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, courts: n } }); }}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                      style={{ background: t.config.courts === n ? COLOR : "#1f2937", color: t.config.courts === n ? "#fff" : "#94a3b8" }}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-2">Modalidad</label>
                <div className="flex gap-2">
                  {[
                    { id: "individual", label: "👤 Individual" },
                    { id: "pairs",      label: "👥 Parejas Fijas" },
                  ].map(opt => (
                    <button key={opt.id}
                      onClick={() => persist({ ...t, config: { ...t.config, mode: opt.id } })}
                      className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                      style={{ background: t.config.mode === opt.id ? COLOR : "#1f2937", color: t.config.mode === opt.id ? "#fff" : "#94a3b8" }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Puntuación ── */}
            <SectionHeader>🎯 Puntuación</SectionHeader>
            <div className="flex flex-col gap-2">
              {SCORING_OPTIONS.map(opt => (
                <button key={opt.id}
                  onClick={() => persist({ ...t, config: { ...t.config, scoringSystem: opt.id } })}
                  className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer"
                  style={{
                    background: scoring === opt.id ? COLOR + "20" : "#1f2937",
                    border: `1px solid ${scoring === opt.id ? COLOR + "50" : "#374151"}`,
                  }}
                >
                  <span className="text-xl flex-shrink-0">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: scoring === opt.id ? COLOR : "#f9fafb" }}>{opt.name}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                  {scoring === opt.id && <span className="text-xs font-bold" style={{ color: COLOR }}>✓</span>}
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
                        style={{ background: (t.config.matchMinutes ?? 10) === n ? COLOR : "#374151", color: (t.config.matchMinutes ?? 10) === n ? "#fff" : "#94a3b8" }}
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
                          background: (t.config.timedMetric ?? "games") === opt.id ? COLOR : "#374151",
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
                      style={{ background: (t.config.rallyPoints ?? 24) === n ? COLOR : "#374151", color: (t.config.rallyPoints ?? 24) === n ? "#fff" : "#94a3b8" }}
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
                      style={{ background: (t.config.targetGames ?? 6) === n ? COLOR : "#374151", color: (t.config.targetGames ?? 6) === n ? "#fff" : "#94a3b8" }}
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

        {/* ── Barra de estado ── */}
        <div className={`flex items-center px-4 py-2.5 rounded-xl border text-sm font-medium mt-6 mb-1 ${statusBg} ${statusTxt}`}>
          {statusMsg}
        </div>

        {/* ── Jugadores / Parejas ── */}
        <SectionHeader>{isPairs ? "👥 Parejas" : "👤 Jugadores"}</SectionHeader>

        {!isPairs && isAdmin && (
          <div className="bg-[#1f2937] rounded-xl border border-gray-700 mb-3 overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-semibold text-gray-200">Usar niveles de jugador</div>
                <div className="text-xs text-gray-500 mt-0.5">Mezcla jugadores por nivel. Solo visible para el organizador durante el torneo.</div>
              </div>
              <button
                onClick={() => { setWarningDismissed(false); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, useLevels: !useLevels } }); }}
                className="px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0"
                style={{
                  background: useLevels ? "#16a34a30" : "#374151",
                  color:      useLevels ? "#4ade80"   : "#94a3b8",
                  border:     `1px solid ${useLevels ? "#4ade8040" : "transparent"}`,
                }}
              >
                {useLevels ? "ON" : "OFF"}
              </button>
            </div>
            {useLevels && (
              <div className="flex gap-4 px-3 pb-3">
                {LEVELS.map(l => (
                  <div key={l.id} className="flex items-center gap-1.5">
                    <span className="text-xs font-black" style={{ color: l.color }}>{l.short}</span>
                    <span className="text-xs text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista */}
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
        {isAdmin && <div className="space-y-2">
          {isPairs
            ? (t.pairInputs || []).map((p, i) => (
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
                        className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5"
                      />
                      <span className="text-gray-600 font-bold shrink-0">/</span>
                      <input
                        value={editP2}
                        onChange={e => setEditP2(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && commitEdit(i)}
                        className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5"
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
              ))
            : (t.playerInputs || []).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-[#1f2937] rounded-xl">
                  <span className="w-6 h-6 rounded-md bg-gray-700 text-gray-400 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {editingIdx === i && isAdmin ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && commitEdit(i)}
                      onBlur={() => commitEdit(i)}
                      autoFocus
                      className="flex-1 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm font-medium ${isAdmin ? "cursor-pointer hover:underline hover:decoration-dotted" : ""}`}
                      onClick={() => isAdmin && startEdit(i)}
                    >{p.name}</span>
                  )}
                  {useLevels && (() => {
                    const lvl = LEVELS[editingIdx === i ? editLvl : (p.level || 0)];
                    return (
                      <button
                        onClick={() => {
                          if (!isAdmin) return;
                          if (editingIdx === i) {
                            setEditLvl(l => (l + 1) % 4);
                          } else {
                            const arr = [...t.playerInputs];
                            arr[i] = { ...arr[i], level: ((arr[i].level || 0) + 1) % 4 };
                            persist({ ...t, playerInputs: arr });
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md shrink-0"
                        style={{
                          background: lvl.color + "20",
                          color: lvl.color,
                          cursor: isAdmin ? "pointer" : "default",
                        }}
                      >
                        {lvl.short}
                      </button>
                    );
                  })()}
                  {isAdmin && (
                    <button
                      onClick={() => { setEditingIdx(null); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, playerInputs: t.playerInputs.filter((_, idx) => idx !== i) }); }}
                      className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none shrink-0"
                    >✕</button>
                  )}
                </div>
              ))
          }
        </div>}

        {/* Formulario de agregar */}
        {isAdmin && (
          <div className="mt-3">
            {isPairs ? (
              <div className="space-y-2">
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
                  style={{ background: newP1.trim() && newP2.trim() ? COLOR : "#374151", color: "#fff" }}
                >
                  + Agregar pareja
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {useLevels && (
                  <button
                    onClick={() => setNewLvl(l => (l + 1) % 4)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 font-bold text-sm cursor-pointer transition-colors"
                    style={{ background: "#1f2937", border: `1px solid ${LEVELS[newLvl].color}`, color: LEVELS[newLvl].color }}
                  >
                    {LEVELS[newLvl].short}
                  </button>
                )}
                <input
                  ref={nameInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addPlayer()}
                  placeholder="Nombre del jugador..."
                  className={addInputCls}
                />
                <button
                  onClick={addPlayer}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 cursor-pointer transition-colors"
                  style={{ background: newName.trim() ? COLOR : "#374151", color: "#fff" }}
                >
                  Agregar
                </button>
              </div>
            )}
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
              <div className="mt-4 bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-5">

                {/* Punto de oro */}
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

                {/* Emparejamiento */}
                <div>
                  <div className="text-sm font-semibold text-gray-200 mb-2">Emparejamiento</div>
                  <div className="flex gap-2">
                    {[
                      { id: "americano", label: "Americano" },
                      { id: "mexicano",  label: "Mexicano"  },
                    ].map(opt => (
                      <button key={opt.id}
                        onClick={() => persist({ ...t, config: { ...t.config, matchmaking: opt.id } })}
                        className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors"
                        style={{
                          background: (t.config.matchmaking || "americano") === opt.id ? COLOR : "#374151",
                          color:      (t.config.matchmaking || "americano") === opt.id ? "#fff" : "#94a3b8",
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
                    {(t.config.matchmaking || "americano") === "americano"
                      ? "Parejas aleatorias cada ronda"
                      : "Desde ronda 2, los mejores juegan entre sí"}
                  </p>
                </div>

                {/* Número de rondas */}
                <div>
                  <div className="text-sm font-semibold text-gray-200 mb-2">Número de rondas</div>
                  <div className="flex gap-2 flex-wrap">
                    {[null, 4, 6, 8, 10, 12].map(n => (
                      <button
                        key={n ?? "ilim"}
                        onClick={() => { setRoundsCustom(""); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, maxRounds: n } }); }}
                        className="px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors"
                        style={{
                          background: (t.config.maxRounds ?? null) === n ? COLOR : "#374151",
                          color:      (t.config.maxRounds ?? null) === n ? "#fff" : "#94a3b8",
                        }}
                      >{n === null ? "Ilimitadas" : n}</button>
                    ))}
                    <input
                      type="number"
                      value={roundsCustom}
                      onChange={e => handleRoundsCustom(e.target.value)}
                      placeholder="Otro"
                      min={1}
                      max={30}
                      className="w-16 py-2 rounded-lg text-sm text-center font-bold outline-none transition-colors bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Banner advertencia niveles sin asignar (SETUP-01) ── */}
        {isAdmin && showUnratedWarning && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-yellow-400">⚠️ Ningún jugador tiene nivel asignado</div>
                <div className="text-xs text-yellow-300/70 mt-1">
                  El emparejamiento por niveles no tendrá efecto. Puedes asignar niveles arriba o continuar sin ellos.
                </div>
              </div>
              <button
                onClick={() => setWarningDismissed(true)}
                className="text-yellow-500/60 hover:text-yellow-400 text-xs font-bold shrink-0 cursor-pointer transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Botón previsualizar cuadro (SETUP-02) ── */}
        {isAdmin && canReshuffle && (
          <button
            onClick={() => localPrecomputedRounds !== null ? setShowPreview(true) : handleReshuffle()}
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm border border-gray-700 bg-[#1f2937] text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors cursor-pointer"
          >
            {localPrecomputedRounds !== null ? "📋 Ver cuadro generado" : "🔀 Previsualizar cuadro"}
          </button>
        )}

        {/* ── Botón iniciar ── */}
        {isAdmin && (
          <button
            onClick={onStart}
            disabled={!ok}
            className="w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors"
            style={{
              background: ok ? COLOR : "#374151",
              color:      ok ? "#fff" : "#64748b",
              cursor:     ok ? "pointer" : "not-allowed",
              opacity:    ok ? 1 : 0.5,
            }}
          >
            🎾 Iniciar Torneo
          </button>
        )}

      </div>
    </div>

    {/* ── Modal: Vista previa del cuadro ── */}
    {showPreview && localPrecomputedRounds && (
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full bg-[#111827] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 shrink-0">
            <h2 className="text-sm font-black text-gray-50">📋 Vista previa del cuadro</h2>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-500 hover:text-gray-200 font-bold cursor-pointer transition-colors text-lg leading-none"
              style={{ background: "none", border: "none", padding: "0 4px" }}
            >✕</button>
          </div>

          {/* Aviso */}
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
            <p className="text-xs text-amber-400">
              ⚠️ Una vez iniciado el torneo no se puede cambiar el emparejamiento
            </p>
          </div>

          {/* Rondas — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {localPrecomputedRounds.map((round, ri) => (
              <div key={ri}>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Ronda {ri + 1}
                </div>
                <div className="space-y-2">
                  {round.courts.map((court, ci) => (
                    <div key={ci} className="bg-[#1f2937] rounded-xl px-3 py-2.5 border border-gray-700">
                      <div className="text-xs text-gray-500 font-semibold mb-1">Cancha {ci + 1}</div>
                      <div className="text-sm text-gray-100 flex flex-wrap items-center gap-x-1">
                        {useLevels && (() => { const l = LEVELS[court.pairA[0].level || 0]; return <span className="text-xs font-black mr-0.5" style={{ color: l.color }}>{l.short}</span>; })()}
                        <span className="font-medium">{court.pairA[0].name}</span>
                        <span className="text-gray-600 text-xs">/</span>
                        {useLevels && (() => { const l = LEVELS[court.pairA[1].level || 0]; return <span className="text-xs font-black mr-0.5" style={{ color: l.color }}>{l.short}</span>; })()}
                        <span className="font-medium">{court.pairA[1].name}</span>
                        <span className="text-gray-500 text-xs font-bold mx-1">vs</span>
                        {useLevels && (() => { const l = LEVELS[court.pairB[0].level || 0]; return <span className="text-xs font-black mr-0.5" style={{ color: l.color }}>{l.short}</span>; })()}
                        <span className="font-medium">{court.pairB[0].name}</span>
                        <span className="text-gray-600 text-xs">/</span>
                        {useLevels && (() => { const l = LEVELS[court.pairB[1].level || 0]; return <span className="text-xs font-black mr-0.5" style={{ color: l.color }}>{l.short}</span>; })()}
                        <span className="font-medium">{court.pairB[1].name}</span>
                      </div>
                    </div>
                  ))}
                  {round.sittingOut.length > 0 && (
                    <div className="text-xs text-gray-500 px-1">
                      ⏳ Descansan: {round.sittingOut.map(p => p.name).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {localRoundWarnings.length > 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <div className="text-xs font-bold text-yellow-500/70 mb-1.5">Advertencias de emparejamiento</div>
                {localRoundWarnings.map((w, wi) => (
                  <div key={wi} className="text-xs text-yellow-400/60">{w.message}</div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-800 shrink-0 flex gap-3">
            <button
              onClick={handleReshuffle}
              className="flex-1 py-3 rounded-xl font-bold text-sm border border-gray-700 bg-[#1f2937] text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors cursor-pointer"
            >
              🔀 Re-sortear
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-colors cursor-pointer"
              style={{ background: COLOR }}
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>
    )}
    </>
  );
}
