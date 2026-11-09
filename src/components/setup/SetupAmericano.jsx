import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { buildFirstRoundAmericano, precomputeAllRounds, isDuplicateName, duplicateNameKeys, normalizeName, MIN_ROUNDS, roundsCountError, restBalance, restBalanceText, fairRoundOptions, classicTotalRounds, courtLabel, normalizeCourtNames } from "../../logic/americano";
import { calcularDescansos, isCourtComplete, findRepeats, repeatsToWarnings, manualPlaysSummary } from "../../logic/manualRounds";
import ManualRoundBuilder from "./ManualRoundBuilder";
import { buildShareMessage } from "../../logic/utils";
import MatchFormatPicker from "../shared/MatchFormatPicker";
import CourtNamesEditor from "../shared/CourtNamesEditor";
import { showToast } from "../../logic/toast";
import { BackButton, SimpleModal } from "../shared/Components";
import LaunchModal, { SummaryRow, SummaryCard } from "../shared/LaunchModal";

const COLOR = "#0284c7";

const LEVELS = [
  { id: 0, label: "Sin definir",  short: "-", color: "#64748b" },
  { id: 1, label: "Principiante", short: "P", color: "#94a3b8" },
  { id: 2, label: "Intermedio",   short: "M", color: "#38bdf8" },
  { id: 3, label: "Avanzado",     short: "A", color: "#84cc16" },
];

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-4">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

export default function SetupAmericano({ t, code, isAdmin, saving, persist, onExitEdit }) {
  const isPairs = t.config.mode === "pairs";

  const [localName,     setLocalName]     = useState(t.config.name        || "");
  const [localDesc,     setLocalDesc]     = useState(t.config.description || "");
  const [localLocation, setLocalLocation] = useState(t.config.location    || "");
  const [localDatetime, setLocalDatetime] = useState(t.config.datetime    || "");
  const [newName,       setNewName]       = useState("");
  const [roundsError,    setRoundsError]   = useState(null);
  const [newLvl,        setNewLvl]        = useState(0);
  const [newP1,         setNewP1]         = useState("");
  const [newP2,         setNewP2]         = useState("");
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [roundsCustom,  setRoundsCustom]  = useState("");
  const [editingIdx,    setEditingIdx]    = useState(null);
  const [editName,      setEditName]      = useState("");
  const [editLvl,       setEditLvl]       = useState(0);
  const [editP1,        setEditP1]        = useState("");
  const [editP2,        setEditP2]        = useState("");
  const [warningDismissed,       setWarningDismissed]       = useState(false);
  const [localPrecomputedRounds, setLocalPrecomputedRounds] = useState(null);
  const [localRoundWarnings,     setLocalRoundWarnings]     = useState([]);
  const [showLaunchModal,        setShowLaunchModal]        = useState(false);
  const [launchModalTab,         setLaunchModalTab]         = useState("emparejamientos");
  const [localManualRounds,  setLocalManualRounds]  = useState(t.config.manualRoundsConfig ?? []);
  const [showManualBuilder,  setShowManualBuilder]   = useState(false);
  const [manualResetMsg,     setManualResetMsg]      = useState(false);

  const debName     = useRef(null);
  const debDesc     = useRef(null);
  const debLocation = useRef(null);
  const debDatetime = useRef(null);
  const debRounds   = useRef(null);
  const debManual   = useRef(null);
  // Último estado del torneo: los guardados con retraso lo leen al ejecutarse, no el de cuando se escribió,
  // para no deshacer cambios hechos entretanto (jugadores agregados, minutos, etc.)
  const tRef = useRef(t);
  tRef.current = t;
  const [pendingManualReset, setPendingManualReset] = useState(null); // { message, confirmLabel, run }
  // Rondas manuales más recientes (incluidas las que aún esperan su guardado retrasado): cualquier otro guardado
  // parte de estas, no de lo que ya hay en el servidor, para no deshacer el último cambio del armador
  const manualRef = useRef(t.config.manualRoundsConfig ?? []);
  const setManual = (rounds) => { manualRef.current = rounds; setLocalManualRounds(rounds); };
  const manualSavePending = useRef(false);
  const cancelManualSave = () => { clearTimeout(debManual.current); manualSavePending.current = false; };
  // Guarda ya el armado pendiente (al volver del armador): no espera los 600 ms
  const flushManualSave = () => {
    if (!manualSavePending.current) return;
    cancelManualSave();
    persistConfig({ manualRoundsConfig: manualRef.current });
  };
  const navigate    = useNavigate();
  const nameInputRef = useRef(null);
  const p1InputRef   = useRef(null);
  const p2InputRef   = useRef(null);

  const units = isPairs ? 2 : 4;
  const tot   = isPairs ? (t.pairInputs?.length ?? 0) : (t.playerInputs?.length ?? 0);
  // Solo se llenan las pistas que alcanzan: con 9 jugadores y 3 pistas juegan 8 en 2 pistas y 1 descansa
  const usedCourts = Math.min(t.config.courts, Math.floor(tot / units));
  const act   = usedCourts * units;
  const sit   = Math.max(0, tot - act);
  const need  = Math.max(0, units - tot);

  const statusBg  = need > 0 ? "bg-red-400/10 border-red-400/20" : sit > 0 ? "bg-yellow-400/10 border-yellow-400/20" : "bg-green-400/10 border-green-400/20";
  const statusTxt = need > 0 ? "text-red-400" : sit > 0 ? "text-yellow-400" : "text-green-400";
  const unusedCourts = need > 0 ? 0 : t.config.courts - usedCourts;
  const statusMsg = `${tot} ${isPairs ? "parejas" : "jugadores"} · ${t.config.courts} pistas${unusedCourts > 0 ? ` (${unusedCourts} sin usar)` : ""} · ${act} juegan` +
    (need > 0 ? ` · ⚠️ faltan ${need}` : sit > 0 ? ` · ⏳ ${sit === 1 ? "1 descansa" : `${sit} descansan`}` : " · ✓ listo");

  const isManual = !isPairs && (t.config.matchmaking || "americano") === "manual";

  const manualReady = !isManual || (
    localManualRounds.length >= MIN_ROUNDS &&
    localManualRounds.every((r) => r.courts.every(isCourtComplete))
  );

  const ok = (isPairs
    ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
    : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0))
    && manualReady;

  // Reparto de partidos: con jugadores de sobra unos descansan más que otros salvo que las rondas cuadren
  // Con parejas fijas no existe Manual: se trata como Americano aunque el dato guardado diga otra cosa
  const matchmakingMode = isPairs && t.config.matchmaking === "manual" ? "americano" : (t.config.matchmaking || "americano");
  const balanceMode = isPairs ? "pairs" : "individual";
  const effectiveRounds = isManual ? null : (t.config.maxRounds ?? (!isPairs && matchmakingMode === "americano" ? classicTotalRounds(tot, null) : null));
  const balance = effectiveRounds ? restBalance({ count: tot, courts: t.config.courts, mode: balanceMode, rounds: effectiveRounds }) : null;
  const fairOptions = !isManual && tot >= (isPairs ? 2 : 4) ? fairRoundOptions({ count: tot, courts: t.config.courts, mode: balanceMode }) : [];

  const scoring   = t.config.scoringSystem || "timed";
  const useLevels = !!t.config.useLevels;

  const allUnrated = useLevels && !isPairs &&
    (t.playerInputs || []).length > 0 &&
    (t.playerInputs || []).every(p => (p.level || 0) === 0);
  const showUnratedWarning = allUnrated && !warningDismissed;

  const canReshuffle = !isPairs &&
    (t.config.matchmaking || "americano") === "americano" &&
    t.status !== "playing" &&
    ok;

  const canShowMatchmakingTab = canReshuffle || (isManual && localManualRounds.length > 0);
  const roundsToPreview = isManual ? localManualRounds : localPrecomputedRounds;
  const manualPlays = isManual
    ? manualPlaysSummary((t.playerInputs || []).map((p, i) => ({ id: i, name: p.name.trim() })).filter((p) => p.name), localManualRounds)
    : null;
  const previewWarnings = isManual ? repeatsToWarnings(findRepeats(localManualRounds)) : localRoundWarnings;

  const scoringLabel  = scoring === "timed" ? "Por tiempo" : scoring === "rally" ? "Por puntos" : "Por games";
  const scoringDetail = scoring === "timed"
    ? `${t.config.matchMinutes ?? 10} min · ${(t.config.timedMetric ?? "games") === "games" ? "Games ganados" : "Puntos acumulados"}`
    : scoring === "rally"
    ? `${t.config.rallyPoints ?? 24} puntos por partido`
    : `${t.config.targetGames ?? 6} games para ganar`;

  // ── Handlers ──────────────────────────────────────────────────
  function persistConfig(patch) {
    const cur = tRef.current;
    const next = { ...cur, config: { ...cur.config, ...patch } };
    tRef.current = next;
    return persist(next);
  }

  // Cambios que invalidan las rondas armadas a mano: si hay, se pide confirmación antes de borrarlas
  const roundsWord = (n) => `${n} ${n === 1 ? "ronda armada" : "rondas armadas"} a mano`;
  function confirmManualReset(what, run) {
    if (isManual && localManualRounds.length > 0) {
      setPendingManualReset({ message: `${what} borrará ${roundsWord(localManualRounds.length)}. ¿Continuar?`, run });
    } else {
      run();
    }
  }

  function handleName(val)     { setLocalName(val);     clearTimeout(debName.current);     debName.current     = setTimeout(() => persistConfig({ name: val }), 600); }
  function handleDesc(val)     { setLocalDesc(val);     clearTimeout(debDesc.current);     debDesc.current     = setTimeout(() => persistConfig({ description: val }), 600); }
  function handleLocation(val) { setLocalLocation(val); clearTimeout(debLocation.current); debLocation.current = setTimeout(() => persistConfig({ location: val }), 600); }
  function handleDatetime(val) { setLocalDatetime(val); clearTimeout(debDatetime.current); debDatetime.current = setTimeout(() => persistConfig({ datetime: val }), 600); }

  function handleRoundsCustom(val) {
    setRoundsCustom(val);
    clearTimeout(debRounds.current);
    const num = parseInt(val);
    setRoundsError(val.trim() === "" ? null : roundsCountError(num));
    if (!roundsCountError(num)) debRounds.current = setTimeout(() => { setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persistConfig({ maxRounds: num }); }, 600);
  }

  function handleMatchmakingChange(val) {
    if (val === matchmakingMode) return;
    if (val !== "manual") {
      confirmManualReset(`Pasar a ${val === "mexicano" ? "Mexicano" : "Americano"}`, () => {
        cancelManualSave();
        setManual([]);
        setManualResetMsg(false);
        persistConfig({ matchmaking: val, manualRoundsConfig: [] });
      });
    } else {
      setManual(t.config.manualRoundsConfig ?? []);
      setLocalPrecomputedRounds(null);
      setLocalRoundWarnings([]);
      setManualResetMsg(false);
      persistConfig({ matchmaking: val });
    }
  }

  function handleCourtsChange(n) {
    if (n === t.config.courts) return;
    const apply = () => {
      setLocalPrecomputedRounds(null);
      setLocalRoundWarnings([]);
      if (isManual && localManualRounds.length > 0) {
        cancelManualSave();
        setManual([]);
        setManualResetMsg(true);
        persistConfig({ courts: n, courtNames: normalizeCourtNames(tRef.current.config.courtNames, n), manualRoundsConfig: [] });
      } else {
        persistConfig({ courts: n, courtNames: normalizeCourtNames(tRef.current.config.courtNames, n) });
      }
    };
    confirmManualReset("Cambiar el número de pistas", apply);
  }

  function handleReshuffle() {
    if (isPairs) return;
    const entities = (t.playerInputs || []).map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }));
    const result = precomputeAllRounds(entities, t.config);
    setLocalPrecomputedRounds(result.rounds);
    setLocalRoundWarnings(result.warnings);
  }

  function handleManualRoundsChange(rounds) {
    setManual(rounds);
    clearTimeout(debManual.current);
    manualSavePending.current = true;
    debManual.current = setTimeout(() => {
      manualSavePending.current = false;
      persistConfig({ manualRoundsConfig: manualRef.current });
    }, 600);
  }

  function handleOpenLaunchModal() {
    if (isManual && localManualRounds.length > 0) {
      setLaunchModalTab("emparejamientos");
    } else if (canReshuffle) {
      if (localPrecomputedRounds === null) {
        const entities = (t.playerInputs || []).map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }));
        const result = precomputeAllRounds(entities, t.config);
        setLocalPrecomputedRounds(result.rounds);
        setLocalRoundWarnings(result.warnings);
      }
      setLaunchModalTab("emparejamientos");
    } else {
      setLaunchModalTab("resumen");
    }
    setShowLaunchModal(true);
  }

  const repeatedNames = duplicateNameKeys(t.playerInputs);

  function addPlayer() {
    if (!newName.trim()) return;
    const name = newName.trim();
    confirmManualReset(`Agregar a ${name}`, () => {
      cancelManualSave();
      setLocalPrecomputedRounds(null);
      setLocalRoundWarnings([]);
      setManual([]);
      setManualResetMsg(false);
      const cur = tRef.current;
      const next = { ...cur, playerInputs: [...(cur.playerInputs || []), { name, level: useLevels ? newLvl : 0 }], config: { ...cur.config, manualRoundsConfig: [] } };
      tRef.current = next;
      persist(next);
      setNewName("");
      nameInputRef.current?.focus();
    });
  }

  // Mismo nombre/nivel en las rondas armadas a mano, para que cambiar el nivel no las borre
  function updatePlayerInManual(rounds, id, patch) {
    const fix = (p) => (p && p.id === id ? { ...p, ...patch } : p);
    return rounds.map((round) => ({
      ...round,
      courts: round.courts.map((court) => ({ ...court, pairA: court.pairA.map(fix), pairB: court.pairB.map(fix) })),
      sittingOut: (round.sittingOut || []).map(fix),
    }));
  }

  function changePlayerLevel(i, level) {
    setLocalPrecomputedRounds(null);
    setLocalRoundWarnings([]);
    const cur = tRef.current;
    const arr = [...(cur.playerInputs || [])];
    arr[i] = { ...arr[i], level };
    cancelManualSave();
    const manual = updatePlayerInManual(manualRef.current, i, { level });
    setManual(manual);
    const next = { ...cur, playerInputs: arr, config: { ...cur.config, manualRoundsConfig: manual } };
    tRef.current = next;
    persist(next);
  }

  function removePlayer(i) {
    const name = (t.playerInputs || [])[i]?.name;
    confirmManualReset(`Quitar a ${name}`, () => {
      cancelManualSave();
      setEditingIdx(null);
      setLocalPrecomputedRounds(null);
      setLocalRoundWarnings([]);
      setManual([]);
      setManualResetMsg(false);
      const cur = tRef.current;
      const next = { ...cur, playerInputs: (cur.playerInputs || []).filter((_, idx) => idx !== i), config: { ...cur.config, manualRoundsConfig: [] } };
      tRef.current = next;
      persist(next);
    });
  }

  function addPair() {
    if (!newP1.trim() || !newP2.trim()) return;
    const arr = t.pairInputs || [];
    persist({ ...t, pairInputs: [...arr, { id: arr.length, p1: newP1.trim(), p2: newP2.trim(), pts: 0, gf: 0, gc: 0 }] });
    setNewP1(""); setNewP2("");
    p1InputRef.current?.focus();
  }

  async function onStart() {
    // Otra pantalla ya cargó un resultado: relanzar con la configuración vieja los borraría
    if (t.scoringStarted) {
      showToast("Ya se cargó un resultado: la configuración del torneo quedó bloqueada.");
      onExitEdit?.();
      return;
    }
    [debName, debDesc, debLocation, debDatetime, debRounds, debManual]
      .forEach(ref => clearTimeout(ref.current));
    try {
      let entities;
      if (isPairs) {
        entities = t.pairInputs.map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
      } else {
        entities = t.playerInputs.map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }));
      }
      let currentRound, sittingOut;
      let precomputedRounds = null;
      let roundWarnings = [];
      if (isManual) {
        precomputedRounds = localManualRounds.map((r) => ({
          ...r,
          sittingOut: calcularDescansos(entities, r.courts),
        }));
        roundWarnings = repeatsToWarnings(findRepeats(localManualRounds));
        const firstRound = precomputedRounds[0];
        currentRound = firstRound.courts.map((c) => ({ ...c, scoreA: "", scoreB: "", saved: false }));
        sittingOut = firstRound.sittingOut;
      } else if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
        if (localPrecomputedRounds !== null) {
          precomputedRounds = localPrecomputedRounds;
          roundWarnings = localRoundWarnings;
        } else {
          const result = precomputeAllRounds(entities, t.config);
          precomputedRounds = result.rounds;
          roundWarnings = result.warnings;
        }
        const firstRound = precomputedRounds[0];
        currentRound = firstRound.courts.map((c) => ({ ...c, scoreA: "", scoreB: "", saved: false }));
        sittingOut = firstRound.sittingOut;
      } else {
        ({ courts: currentRound, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode));
      }
      await persist({
        ...t,
        [isPairs ? "pairs" : "players"]: entities,
        currentRound,
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
    if (isPairs) { const p = (t.pairInputs || [])[i]; setEditP1(p.p1); setEditP2(p.p2); }
    else         { const p = (t.playerInputs || [])[i]; setEditName(p.name); setEditLvl(p.level); }
    setEditingIdx(i);
  }

  function commitEdit(i) {
    setLocalPrecomputedRounds(null);
    setLocalRoundWarnings([]);
    if (isPairs) {
      const arr = [...(t.pairInputs || [])];
      arr[i] = { ...arr[i], p1: editP1.trim() || arr[i].p1, p2: editP2.trim() || arr[i].p2 };
      persist({ ...t, pairInputs: arr });
    } else {
      const arr = [...(t.playerInputs || [])];
      const newName = editName.trim() || arr[i].name;
      arr[i] = { ...arr[i], name: newName, level: editLvl };
      cancelManualSave();
      const existingManual = manualRef.current;
      const updatedManual = updatePlayerInManual(existingManual, i, { name: newName, level: editLvl });
      setManual(updatedManual);
      { const cur = tRef.current; const next = { ...cur, playerInputs: arr, config: { ...cur.config, manualRoundsConfig: updatedManual } }; tRef.current = next; persist(next); }
    }
    setEditingIdx(null);
  }

  async function handleShare() {
    const msg = buildShareMessage(t, code);
    if (navigator.share) {
      try { await navigator.share({ title: t.config.name, text: msg }); } catch (_) {}
    } else {
      try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) {}
    }
  }

  const inputCls    = "w-full bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors";
  const addInputCls = "flex-1 bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none transition-colors min-w-0";

  if (showManualBuilder && isAdmin) {
    const players = (t.playerInputs || [])
      .map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }))
      .filter((p) => p.name);
    return (
      <ManualRoundBuilder
        players={players}
        courts={t.config.courts}
        courtNames={t.config.courtNames}
        rounds={localManualRounds}
        onChange={handleManualRoundsChange}
        onBack={() => { flushManualSave(); setShowManualBuilder(false); }}
        config={{ useLevels: !!t.config.useLevels, maxRounds: t.config.maxRounds ?? 4 }}
      />
    );
  }

  return (
    <>
    {pendingManualReset && (
      <SimpleModal
        icon="⚠️"
        message={pendingManualReset.message}
        confirmLabel="Borrar rondas"
        onClose={() => setPendingManualReset(null)}
        onConfirm={() => { const { run } = pendingManualReset; setPendingManualReset(null); run(); }}
      />
    )}
    <div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">

        {onExitEdit && (
          <button onClick={onExitEdit} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors bg-transparent border-0 p-0">
            ← Volver al torneo
          </button>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-2.5">
            <BackButton />
            <div>
              <h1 className="text-xl font-black" style={{ color: COLOR }}>🔄 Americano</h1>
              <p className="text-xs text-gray-500 mt-1">Código: <span className="text-yellow-400 font-bold tracking-widest">{code}</span></p>
            </div>
          </div>
          <button
            onClick={handleShare}
            className={`text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0 font-semibold border ${copied ? "bg-[#16a34a20] border-[#16a34a50] text-[#4ade80]" : "bg-[#1f2937] border-[#374151] text-[#94a3b8]"}`}
          >
            {copied ? "✓ Copiado" : "📤 Compartir"}
          </button>
        </div>

        {!isAdmin && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mb-4">
            <div className="font-bold text-gray-50">{t.config.name || "Torneo Americano"}</div>
            <div className="text-xs text-gray-500 mt-1">{t.config.courts} pistas · El torneo aún no comenzó</div>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span className="text-xs text-yellow-400/80 font-medium">Esta pantalla se actualizará automáticamente cuando empiece</span>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <div className="flex items-center mb-5">
              <button onClick={() => navigate("/")} className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer bg-transparent border-0 p-0">
                ← Inicio
              </button>
            </div>

            {/* ── 1. Información ── */}
            <SectionHeader>📋 Información</SectionHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Nombre del torneo</label>
                <input data-testid="input-tournament-name" value={localName} onChange={e => handleName(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Fecha y hora</label>
                  <input type="datetime-local" value={localDatetime} onChange={e => handleDatetime(e.target.value)} className="w-full bg-[#1f2937] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-3 py-3 text-sm outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Ubicación</label>
                  <input value={localLocation} onChange={e => handleLocation(e.target.value)} placeholder="Club, dirección..." className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── 2. Modalidad ── */}
            <SectionHeader>🎮 Modalidad</SectionHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[{ id: "individual", label: "👤 Individual" }, { id: "pairs", label: "👥 Parejas Fijas" }].map(opt => (
                  <button key={opt.id}
                    onClick={() => persist({ ...t, config: { ...t.config, mode: opt.id } })}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer ${t.config.mode === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                    style={t.config.mode === opt.id ? { background: COLOR } : undefined}
                  >{opt.label}</button>
                ))}
              </div>
              {!isPairs && (
                <div className="bg-[#1f2937] rounded-xl border border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-200">Usar niveles de jugador</div>
                      <div className="text-xs text-gray-500 mt-0.5">Mezcla jugadores por nivel. Solo visible para el organizador.</div>
                    </div>
                    <button
                      onClick={() => { setWarningDismissed(false); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, useLevels: !useLevels } }); }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0 border ${useLevels ? "bg-[#16a34a30] text-[#4ade80] border-[#4ade8040]" : "bg-[#374151] text-[#94a3b8] border-transparent"}`}
                    >{useLevels ? "ON" : "OFF"}</button>
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
            </div>

            {/* ── 3. Jugadores / Parejas ── */}
            <SectionHeader>{isPairs ? "👥 Parejas" : "👤 Jugadores"}</SectionHeader>
            <div className="space-y-2">
              {isPairs
                ? (t.pairInputs || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-[#1f2937] rounded-xl">
                      <span className="w-6 h-6 rounded-md bg-gray-700 text-gray-400 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      {editingIdx === i ? (
                        <div className="flex-1 flex items-center gap-2 min-w-0" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) commitEdit(i); }}>
                          <input value={editP1} onChange={e => setEditP1(e.target.value)} onKeyDown={e => e.key === "Enter" && commitEdit(i)} autoFocus className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5" />
                          <span className="text-gray-600 font-bold shrink-0">/</span>
                          <input value={editP2} onChange={e => setEditP2(e.target.value)} onKeyDown={e => e.key === "Enter" && commitEdit(i)} className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5" />
                        </div>
                      ) : (
                        <span className="flex-1 text-sm cursor-pointer hover:underline hover:decoration-dotted" onClick={() => startEdit(i)}>
                          <span className="font-medium">{p.p1}</span><span className="text-gray-600 mx-1.5">/</span><span className="font-medium">{p.p2}</span>
                        </span>
                      )}
                      <button onClick={() => { setEditingIdx(null); persist({ ...t, pairInputs: t.pairInputs.filter((_, idx) => idx !== i) }); }} className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none shrink-0">✕</button>
                    </div>
                  ))
                : (t.playerInputs || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-[#1f2937] rounded-xl">
                      <span className="w-6 h-6 rounded-md bg-gray-700 text-gray-400 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      {editingIdx === i ? (
                        <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && commitEdit(i)} onBlur={() => commitEdit(i)} autoFocus className="flex-1 text-sm font-medium bg-transparent border-b border-sky-600 outline-none text-gray-50 py-0.5" />
                      ) : (
                        <span className="flex-1 text-sm font-medium cursor-pointer hover:underline hover:decoration-dotted" onClick={() => startEdit(i)}>{p.name}</span>
                      )}
                      {repeatedNames.has(normalizeName(p.name)) && editingIdx !== i && (
                        <span className="text-[11px] font-semibold text-amber-400 shrink-0">⚠️ repetido</span>
                      )}
                      {useLevels && (() => {
                        const lvl = LEVELS[editingIdx === i ? editLvl : (p.level || 0)];
                        return (
                          <button
                            onClick={() => {
                              if (editingIdx === i) { setEditLvl(l => (l + 1) % 4); }
                              else { changePlayerLevel(i, ((p.level || 0) + 1) % 4); }
                            }}
                            className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md shrink-0 cursor-pointer"
                            style={{ background: lvl.color + "20", color: lvl.color }}
                          >{lvl.short}</button>
                        );
                      })()}
                      <button onClick={() => removePlayer(i)} className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none shrink-0">✕</button>
                    </div>
                  ))
              }
            </div>

            {/* Formulario agregar */}
            <div className="mt-3">
              {isPairs ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input ref={p1InputRef} value={newP1} onChange={e => setNewP1(e.target.value)} onKeyDown={e => e.key === "Tab" && (e.preventDefault(), p2InputRef.current?.focus())} placeholder="Jugador 1" className={addInputCls} />
                    <span className="text-gray-600 font-bold shrink-0">/</span>
                    <input ref={p2InputRef} value={newP2} onChange={e => setNewP2(e.target.value)} onKeyDown={e => e.key === "Enter" && addPair()} placeholder="Jugador 2" className={addInputCls} />
                  </div>
                  <button onClick={addPair} className={`w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors text-white ${newP1.trim() && newP2.trim() ? "" : "bg-[#374151]"}`} style={newP1.trim() && newP2.trim() ? { background: COLOR } : undefined}>+ Agregar pareja</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {useLevels && (
                    <button onClick={() => setNewLvl(l => (l + 1) % 4)} className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 font-bold text-sm cursor-pointer bg-[#1f2937]" style={{ border: `1px solid ${LEVELS[newLvl].color}`, color: LEVELS[newLvl].color }}>
                      {LEVELS[newLvl].short}
                    </button>
                  )}
                  <input ref={nameInputRef} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()} placeholder="Nombre del jugador..." className={addInputCls} />
                  <button onClick={addPlayer} className={`px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 cursor-pointer transition-colors text-white ${newName.trim() ? "" : "bg-[#374151]"}`} style={newName.trim() ? { background: COLOR } : undefined}>Agregar</button>
                </div>
              )}
              {!isPairs && isDuplicateName(newName, t.playerInputs) && (
                <p data-testid="aviso-nombre-repetido" className="mt-2 text-xs font-semibold text-amber-400">
                  ⚠️ Ya hay un jugador llamado «{newName.trim()}». Añádele una inicial o el apellido para distinguirlos; también puedes agregarlo así.
                </p>
              )}
            </div>

            {/* Status bar */}
            <div className={`flex items-center px-4 py-2.5 rounded-xl border text-sm font-medium mt-3 ${statusBg} ${statusTxt}`}>
              {statusMsg}
            </div>

            {/* Unrated warning */}
            {showUnratedWarning && (
              <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-yellow-400">⚠️ Ningún jugador tiene nivel asignado</div>
                    <div className="text-xs text-yellow-300/70 mt-1">El emparejamiento por niveles no tendrá efecto.</div>
                  </div>
                  <button onClick={() => setWarningDismissed(true)} className="text-yellow-500/60 hover:text-yellow-400 text-xs font-bold shrink-0 cursor-pointer">Continuar</button>
                </div>
              </div>
            )}

            {/* ── 4. Pistas ── */}
            <SectionHeader>🏓 Pistas</SectionHeader>
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(n => (
                <button key={n}
                  onClick={() => handleCourtsChange(n)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${t.config.courts === n ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                  style={t.config.courts === n ? { background: COLOR } : undefined}
                >{n}</button>
              ))}
            </div>
            <CourtNamesEditor
              autoSave
              courts={t.config.courts}
              courtNames={t.config.courtNames}
              onSave={(courtNames) => persistConfig({ courtNames })}
            />

            {/* ── 5. Formato de partido ── */}
            <SectionHeader>🎾 Formato de partido</SectionHeader>
            <MatchFormatPicker
              config={t.config}
              color={COLOR}
              includeFormat={false}
              onChange={(patch) => persist({ ...t, config: { ...t.config, ...patch } })}
            />

            {/* ── 6. Emparejamiento: Americano / Mexicano / Manual, siempre a la vista ── */}
            <SectionHeader>🎲 Emparejamiento</SectionHeader>
            <div className="flex gap-2" data-testid="selector-emparejamiento">
              {[
                { id: "americano", label: "Americano" },
                { id: "mexicano", label: "Mexicano" },
                ...(isPairs ? [] : [{ id: "manual", label: "Manual" }]),
              ].map(opt => (
                <button key={opt.id} onClick={() => handleMatchmakingChange(opt.id)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors ${matchmakingMode === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`} style={matchmakingMode === opt.id ? { background: COLOR } : undefined}>{opt.label}</button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {matchmakingMode === "americano"
                ? "Parejas aleatorias cada ronda"
                : matchmakingMode === "mexicano"
                ? "Desde ronda 2, los mejores juegan entre sí"
                : "Tú eliges los emparejamientos de cada ronda"}
            </p>

            {/* ── 7. Rondas — ocultar en modo manual ── */}
            {!isManual && (
              <>
                <SectionHeader>🔄 Rondas</SectionHeader>
                <div className="flex gap-2 flex-wrap">
                  {[null, 4, 6, 8, 10, 12].filter(n => n === null || isPairs || matchmakingMode !== "americano" || n !== classicTotalRounds(tot, null)).map(n => {
                    // Elegir justo el número automático del Clásico equivale a "Automáticas": ese chip queda marcado
                    const selected = (t.config.maxRounds ?? null) === n || (n === null && !isPairs && matchmakingMode === "americano" && t.config.maxRounds === classicTotalRounds(tot, null));
                    return (
                    <button key={n ?? "ilim"}
                      onClick={() => { setRoundsCustom(""); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, maxRounds: n } }); }}
                      className={`px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${selected ? "text-white" : "bg-[#374151] text-[#94a3b8]"}`}
                      style={selected ? { background: COLOR } : undefined}
                    >{n === null ? (!isPairs && matchmakingMode === "americano" ? `Automáticas (${classicTotalRounds(tot, null)})` : "Ilimitadas") : n}</button>
                    );
                  })}
                  <input type="number" value={roundsCustom} onChange={e => handleRoundsCustom(e.target.value)} placeholder="Otro" min={MIN_ROUNDS} max={30} className="w-16 py-2 rounded-lg text-sm text-center font-bold outline-none bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0" />
                </div>
                {roundsError && <p data-testid="error-rondas" className="mt-2 text-xs font-semibold text-amber-400">⚠️ {roundsError}</p>}
                {balance && (
                  <p data-testid="aviso-descansos" className={`mt-2 text-xs font-semibold ${balance.equal ? "text-green-400" : "text-amber-400"}`}>
                    {balance.equal ? "✓" : "⚠️"} {restBalanceText(balance, isPairs)}
                  </p>
                )}
                {fairOptions.length > 0 && !balance?.equal && (
                  <div data-testid="rondas-parejas" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span>Para que todos jueguen lo mismo:</span>
                    {fairOptions.slice(0, 3).map((o) => (
                      <button
                        key={o.rounds}
                        type="button"
                        onClick={() => { setRoundsCustom(""); setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, maxRounds: o.rounds } }); }}
                        className="px-2.5 py-1 rounded-lg font-bold cursor-pointer bg-[#374151] text-gray-200"
                      >{o.rounds} rondas ({o.plays} partidos)</button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Rondas manuales ── */}
            {isManual && (
              <>
                <SectionHeader>✏️ Rondas manuales</SectionHeader>

                {manualResetMsg && (
                  <div className="mb-3 px-4 py-2.5 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-semibold">
                    ⚠️ Cambiaste las pistas — el armado manual se reinició.
                  </div>
                )}

                <button
                  onClick={() => { setManualResetMsg(false); setShowManualBuilder(true); }}
                  className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors mb-3 bg-[#1f2937]"
                  style={{ border: `1px solid ${COLOR}50`, color: COLOR }}
                >
                  ✏️ Armar rondas
                </button>

                {localManualRounds.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center">Sin rondas armadas todavía</p>
                ) : localManualRounds.length < MIN_ROUNDS ? (
                  <p data-testid="error-rondas-manual" className="text-xs text-amber-400 font-semibold text-center">
                    ⚠️ Mínimo {MIN_ROUNDS} rondas: arma al menos otra
                  </p>
                ) : manualReady ? (
                  <p className="text-xs text-green-400 font-bold text-center">
                    ✓ {localManualRounds.length} {localManualRounds.length === 1 ? "ronda lista" : "rondas listas"}
                  </p>
                ) : (
                  <p className="text-xs text-yellow-400 font-semibold text-center">
                    {localManualRounds.filter((r) => r.courts.every(isCourtComplete)).length} de {localManualRounds.length} rondas completas
                  </p>
                )}
              </>
            )}

            {/* ── 8. Configuración avanzada ── */}
            <div className="mt-7">
              <button onClick={() => setShowAdvanced(s => !s)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 font-semibold transition-colors cursor-pointer bg-transparent border-0 p-0">
                <span>{showAdvanced ? "▾" : "▸"}</span> ⚙️ Configuración avanzada
              </button>
              {showAdvanced && (
                <div className="mt-4 bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-200">Punto de oro en el 40-40</div>
                      <div className="text-xs text-gray-500 mt-0.5">ON: un único punto decide el 40-40. OFF: se juega con ventaja.</div>
                    </div>
                    <button onClick={() => persist({ ...t, config: { ...t.config, goldenPoint: !(t.config.goldenPoint !== false) } })} className={`px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0 border ${t.config.goldenPoint !== false ? "bg-[#16a34a30] text-[#4ade80] border-[#4ade8040]" : "bg-[#374151] text-[#94a3b8] border-transparent"}`}>
                      {t.config.goldenPoint !== false ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1.5">Descripción <span className="text-gray-600 font-normal">(opcional)</span></label>
                    <textarea value={localDesc} onChange={e => handleDesc(e.target.value)} placeholder="Reglas especiales, mensaje a los jugadores..." rows={2} className="w-full bg-[#0f172a] border border-gray-700 focus:border-sky-600 rounded-xl text-gray-50 px-4 py-3 text-sm outline-none transition-colors resize-none" />
                  </div>
                </div>
              )}
            </div>

            {/* ── CTA único ── */}
            <button
              data-testid="btn-open-modal"
              onClick={handleOpenLaunchModal}
              disabled={!ok}
              className={`w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors ${ok ? "text-white cursor-pointer" : "bg-[#374151] text-[#64748b] cursor-not-allowed opacity-50"}`}
              style={ok ? { background: COLOR } : undefined}
            >
              📋 Revisar y lanzar
            </button>
            {isManual && !manualReady && (
              <p data-testid="falta-armar-rondas" className="text-center text-xs font-semibold text-amber-400 mt-3">
                Para lanzar, arma al menos {MIN_ROUNDS} rondas completas con «Armar rondas».
              </p>
            )}
            <p className="text-center text-xs text-gray-600 mt-3">
              Una vez guardado el primer resultado no podrás modificar la configuración del torneo.
            </p>
          </>
        )}
      </div>
    </div>

    {/* ── Modal: Revisar y lanzar ── */}
    {showLaunchModal && (
      <LaunchModal
        color={COLOR}
        tabs={canShowMatchmakingTab ? [{ id: "emparejamientos", label: "🎲 Emparejamientos" }, { id: "resumen", label: "📋 Resumen" }] : null}
        activeTab={launchModalTab}
        onTab={setLaunchModalTab}
        onClose={() => setShowLaunchModal(false)}
        onReshuffle={canReshuffle && launchModalTab === "emparejamientos" ? handleReshuffle : null}
        onStart={onStart}
        saving={saving}
      >
            {/* Tab Emparejamientos */}
            {canShowMatchmakingTab && launchModalTab === "emparejamientos" && roundsToPreview && (
              <div className="px-4 py-4 space-y-6">
                {roundsToPreview.map((round, ri) => (
                  <div key={ri}>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ronda {ri + 1}</div>
                    <div className="space-y-2">
                      {round.courts.map((court, ci) => (
                        <div key={ci} className="bg-[#1f2937] rounded-xl px-3 py-2.5 border border-gray-700">
                          <div className="text-xs text-gray-500 font-semibold mb-1">{courtLabel(t.config.courtNames, ci)}</div>
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
                        <div className="text-xs text-gray-500 px-1">⏳ {round.sittingOut.length === 1 ? "Descansa" : "Descansan"}: {round.sittingOut.map(p => p.name).join(", ")}</div>
                      )}
                    </div>
                  </div>
                ))}
                {previewWarnings.length > 0 && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                    <div className="text-xs font-bold text-yellow-500/70 mb-1.5">Advertencias de emparejamiento</div>
                    {previewWarnings.map((w, wi) => <div key={wi} className="text-xs text-yellow-400/60">{w.message}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* Tab Resumen (o vista única si no hay matchmaking) */}
            {(!canShowMatchmakingTab || launchModalTab === "resumen") && (
              <div className="px-4 py-4 space-y-3">
                {!canReshuffle && !isManual && (
                  <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-500">
                    {isPairs
                      ? "El sorteo de la primera ronda se genera al iniciar."
                      : "Emparejamiento Mexicano: desde ronda 2 los mejores juegan entre sí, por eso pueden repetirse compañeros y rivales."}
                  </div>
                )}

                <SummaryCard title="Información">
                    <SummaryRow label="Nombre" value={t.config.name || "—"} />
                    {t.config.datetime && <SummaryRow label="Fecha" value={new Date(t.config.datetime).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })} />}
                    {t.config.location && <SummaryRow label="Ubicación" value={t.config.location} />}
                  </SummaryCard>

                <SummaryCard title="Jugadores">
                    <SummaryRow label="Modalidad" value={isPairs ? "Parejas Fijas" : "Individual"} />
                    <SummaryRow label="Total" value={`${tot} ${isPairs ? "parejas" : "jugadores"}`} />
                    <SummaryRow label="Pistas" value={t.config.courts} />
                    <SummaryRow label="Juegan por ronda" value={`${act} ${isPairs ? "parejas" : "jugadores"}`} />
                    {sit > 0 && <SummaryRow label="Descansan por ronda" value={`${sit} ${isPairs ? (sit === 1 ? "pareja" : "parejas") : (sit === 1 ? "jugador" : "jugadores")}`} yellow />}
                    {!isPairs && <SummaryRow label="Niveles" value={useLevels ? "Activados" : "Desactivados"} />}
                  </SummaryCard>

                <SummaryCard title="Puntuación">
                    <SummaryRow label="Sistema" value={scoringLabel} />
                    <SummaryRow label="Detalle" value={scoringDetail} />
                    <SummaryRow label="Punto de oro" value={t.config.goldenPoint !== false ? "Activado" : "Desactivado"} />
                  </SummaryCard>

                <SummaryCard title="Formato">
                    <SummaryRow label="Rondas" value={isManual ? String(localManualRounds.length) : t.config.maxRounds ? String(t.config.maxRounds) : effectiveRounds ? String(effectiveRounds) : "Ilimitadas"} />
                    {balance && <SummaryRow label={isPairs ? "Partidos por pareja" : "Partidos por jugador"} value={restBalanceText(balance, isPairs)} yellow={!balance.equal} />}
                    {isManual && manualPlays && <SummaryRow label="Partidos por jugador" value={manualPlays.text} yellow={!manualPlays.equal} />}
                    <SummaryRow label="Emparejamiento" value={isManual ? "Manual" : matchmakingMode === "mexicano" ? "Mexicano" : "Americano"} />
                  </SummaryCard>
              </div>
            )}
      </LaunchModal>
    )}
    </>
  );
}
