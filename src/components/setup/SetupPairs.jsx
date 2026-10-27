import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { shuffle, buildShareMessage } from "../../logic/utils";
import { validateMundialitoConfig, knockoutInfo, mundialitoThirdPlace, mundialitoFormatOptions, formatTitle, formatDetail, describeFormat } from "../../logic/mundialito";
import { buildPozoRound, shufflePlayers } from "../../logic/pozo";
import MatchFormatPicker from "../shared/MatchFormatPicker";
import LaunchModal, { SummaryRow, SummaryCard } from "../shared/LaunchModal";
import { GroupsPreview, FixturePreview, BracketPreview } from "./DrawPreview";
import { hasDraw, drawIsRandom, drawKey, buildStartDraw, startPatch } from "../../logic/launchDraw";
import { matchFormatSummary } from "../../logic/matchFormat";
import { ligaQualifierOptions, ligaQualifiers, ligaThirdPlace } from "../../logic/liga";

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

export default function SetupPairs({ t, code, isAdmin, saving, persist, typeInfo, onExitEdit }) {
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
  const [saved,         setSaved]         = useState(false);
  const [showLaunch,    setShowLaunch]    = useState(false);
  const [customOpen,    setCustomOpen]    = useState(false);
  const [launchTab,     setLaunchTab]     = useState("sorteo");
  const [drawState,     setDrawState]     = useState(null);
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
  const debTargetRounds = useRef(null);
  const navigate    = useNavigate();
  const p1InputRef  = useRef(null);
  const p2InputRef  = useRef(null);

  const isMixer   = t.type === "pozo" && t.config.pozoMode === "mixer";
  const pairs     = t.pairInputs || [];
  const players   = t.playerInputs || [];
  const isLigaType = t.type === "liga";
  const act       = isLigaType ? 2 : isMixer ? t.config.courts * 4 : t.config.courts * 2;
  const tot       = isMixer ? players.length : pairs.length;
  const sit       = isLigaType ? tot % 2 : Math.max(0, tot - act);
  const need      = Math.max(0, act - tot);

  const statusBg  = need > 0 ? "bg-red-400/10 border-red-400/20"    : sit > 0 ? "bg-yellow-400/10 border-yellow-400/20"    : "bg-green-400/10 border-green-400/20";
  const statusTxt = need > 0 ? "text-red-400"                       : sit > 0 ? "text-yellow-400"                          : "text-green-400";
  const isPozo = t.type === "pozo";

  const statusMsg = isLigaType
    ? need > 0
      ? `⚠️ Faltan ${need} ${need === 1 ? "pareja" : "parejas"}`
      : `${tot} parejas` + (sit > 0 ? " · ⏳ una descansa cada jornada" : " · ✓ listo")
    : isPozo
    ? need > 0
      ? `⚠️ Faltan ${need} ${isMixer ? "jugadores" : "parejas"}`
      : sit === 0
        ? `✅ Pistas completas (Nadie descansa)`
        : `⏳ Descansan ${sit} ${isMixer ? "jugadores" : "parejas"} por ronda`
    : `${tot} parejas · ${t.config.courts} pistas · ${Math.min(tot, act)} juegan` +
      (sit > 0 ? ` · ⏳ ${sit} descansan` : need > 0 ? ` · ⚠️ faltan ${need}` : " · ✓ listo");

  const mundialitoCheck = t.type === "mundialito"
    ? validateMundialitoConfig(tot, t.config.groupCount || 2, t.config.advancePerGroup ?? 2)
    : null;
  // Formatos sugeridos (hasta 5; si el elegido es otro, también se muestra) y modo manual
  const formatOptions = t.type === "mundialito" ? mundialitoFormatOptions(tot) : [];
  const currentFormat = formatOptions.find(
    (o) => o.groupCount === (t.config.groupCount || 2) && o.advancePerGroup === (t.config.advancePerGroup ?? 2),
  );
  const formatCards = formatOptions.slice(0, 5);
  // Con Personalizar abierto el resumen de abajo ya describe lo elegido; no se repite como tarjeta
  if (currentFormat && !formatCards.includes(currentFormat) && !customOpen) formatCards.push(currentFormat);
  const customVisible = tot >= 4 && (customOpen || formatCards.length === 0 || !currentFormat);
  const customSummary = describeFormat(tot, t.config.groupCount || 2, t.config.advancePerGroup ?? 2);
  const ok = isMixer
    ? players.length >= act && players.every(p => p.name.trim())
    : isPozo
      ? pairs.length >= act && pairs.every(p => p.p1.trim() && p.p2.trim())
      : tot >= 2 && pairs.every(p => p.p1.trim() && p.p2.trim()) && (mundialitoCheck?.ok ?? true);

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

  // Sorteo previo (Mundialito, Liga): se genera al abrir "Revisar y lanzar" y ese mismo
  // resultado es el que se guarda al iniciar. Si cambian las parejas o la configuración que
  // afecta al sorteo, el guardado deja de valer y se genera otro.
  const currentDrawKey = drawKey(t);
  const activeDraw = drawState && drawState.key === currentDrawKey ? drawState.draw : null;

  function openLaunch() {
    if (!activeDraw) setDrawState({ key: currentDrawKey, draw: buildStartDraw(t) });
    setLaunchTab("sorteo");
    setShowLaunch(true);
  }
  function reshuffleDraw() {
    setDrawState({ key: currentDrawKey, draw: buildStartDraw(t) });
  }

  async function onStart() {
    const pairsToStart = t.pairInputs.map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
    const finalConfig = { ...t.config, scoringSystem: t.config.scoringSystem || "timed" };

    if (hasDraw(t.type)) {
      await persist({ ...t, config: finalConfig, ...startPatch(t, activeDraw), status: "playing" });
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
    <>    <div className="min-h-screen bg-[#111827] text-gray-50 font-[system-ui]">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">

        {/* ── Volver (solo en modo edición post-inicio) ── */}
        {onExitEdit && (
          <button
            onClick={onExitEdit}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors bg-transparent border-0 p-0"
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
            className={`text-xs px-3 py-2 rounded-xl border transition-colors cursor-pointer shrink-0 font-semibold ${copied
              ? "bg-[#16a34a20] border-[#16a34a50] text-[#4ade80]"
              : "bg-[#1f2937] border-[#374151] text-[#94a3b8]"
            }`}
          >
            {copied ? "✓ Copiado" : "📤 Compartir"}
          </button>
        </div>

        {/* ── Vista no-admin ── */}
        {!isAdmin && (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 mb-4">
            <div className="font-bold">{t.config.name}</div>
            <div className="text-xs text-gray-500 mt-1">{t.type !== "liga" && `${t.config.courts} pistas · `}Esperando al organizador...</div>
          </div>
        )}

        {isAdmin && (
          <>
            {/* ── Nav borrador ── */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => navigate("/")}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
              >
                ← Inicio
              </button>
              <button
                onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
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
              {t.type !== "liga" && <div>
                <label className="text-xs text-gray-400 font-semibold block mb-2">Pistas</label>
                <div className="flex gap-2">
                  {(t.type === "pozo" ? [2,3,4,5,6] : [1,2,3,4,5,6]).map(n => (
                    <button key={n}
                      onClick={() => persist({ ...t, config: { ...t.config, courts: n } })}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${t.config.courts === n ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                      style={t.config.courts === n ? { background: color } : undefined}
                    >{n}</button>
                  ))}
                </div>
              </div>}

              {/* Mundialito: grupos y avance */}
              {t.type === "mundialito" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1">Formato de grupos</label>
                    <p className="text-xs text-gray-500 mb-3">
                      Las parejas se reparten en grupos y juegan todas contra todas; los mejores de cada grupo pasan a un cuadro final.
                    </p>
                    {tot < 4 && (
                      <div className="rounded-xl border border-dashed border-[#374151] bg-[#1f2937]/60 px-3.5 py-3 text-xs text-gray-400 leading-relaxed">
                        Agrega tus parejas (mínimo 4) y aquí verás los formatos posibles. Por ejemplo, con 12 parejas: 4 grupos de 3 donde pasa 1 de cada grupo, o 2 grupos de 6 donde pasan 2.
                      </div>
                    )}
                    {formatCards.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {formatCards.map((o) => {
                          const active = o === currentFormat;
                          return (
                            <button key={`${o.groupCount}-${o.advancePerGroup}`}
                              onClick={() => { setCustomOpen(false); persist({ ...t, config: { ...t.config, groupCount: o.groupCount, advancePerGroup: o.advancePerGroup } }); }}
                              className={`w-full text-left rounded-xl border px-3.5 py-3 cursor-pointer transition-colors ${active ? "text-white" : "bg-[#1f2937] border-[#374151] text-[#cbd5e1]"}`}
                              style={active ? { background: color, borderColor: color } : undefined}
                            >
                              <div className="font-bold text-sm">{o.recommended ? "⭐ " : ""}{formatTitle(o)}</div>
                              <div className={`text-xs mt-1 ${active ? "text-white/80" : "text-gray-400"}`}>{formatDetail(o)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {formatCards.length > 0 && !customVisible && (
                      <button onClick={() => setCustomOpen(true)}
                        className="mt-2 text-xs font-semibold text-gray-400 underline cursor-pointer">
                        ⚙️ Personalizar grupos y clasificados
                      </button>
                    )}
                  </div>
                  {customVisible && (
                    <>
                      <div>
                        <label className="text-xs text-gray-400 font-semibold block mb-2">Número de grupos</label>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: Math.max(1, mundialitoCheck.maxGroups - 1) }, (_, i) => i + 2).map(n => (
                            <button key={n}
                              onClick={() => persist({ ...t, config: { ...t.config, groupCount: n } })}
                              className={`flex-1 min-w-[3rem] py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${t.config.groupCount === n ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                              style={t.config.groupCount === n ? { background: color } : undefined}
                            >{n}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-semibold block mb-2">Parejas que avanzan por grupo</label>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: Math.max(1, mundialitoCheck.maxAdvance) }, (_, i) => i + 1).map(n => (
                            <button key={n}
                              onClick={() => persist({ ...t, config: { ...t.config, advancePerGroup: n } })}
                              className={`flex-1 min-w-[3rem] py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${t.config.advancePerGroup === n ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                              style={t.config.advancePerGroup === n ? { background: color } : undefined}
                            >{n}</button>
                          ))}
                        </div>
                      </div>
                      {customSummary && (
                        <div className="rounded-xl bg-[#1f2937] border border-[#374151] px-3.5 py-3">
                          <div className="font-bold text-sm text-gray-100">{formatTitle(customSummary)}</div>
                          <div className="text-xs mt-1 text-gray-400">{formatDetail(customSummary)}</div>
                        </div>
                      )}
                    </>
                  )}
                  {tot >= 4 && knockoutInfo(t.config.groupCount || 2, t.config.advancePerGroup ?? 2).qualifiers >= 4 && (
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">Partido por el 3.º y 4.º puesto</label>
                      <div className="flex gap-2">
                        {[
                          { id: false, label: "No" },
                          { id: true, label: "Sí" },
                        ].map((opt) => (
                          <button key={String(opt.id)}
                            onClick={() => persist({ ...t, config: { ...t.config, thirdPlace: opt.id } })}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${(t.config.thirdPlace || false) === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                            style={(t.config.thirdPlace || false) === opt.id ? { background: color } : undefined}
                          >{opt.label}</button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Lo juegan los dos perdedores de las semifinales.</p>
                    </div>
                  )}
                  {tot >= 4 && mundialitoCheck.error && (
                    <p className="text-xs text-amber-500 font-semibold">⚠️ {mundialitoCheck.error}</p>
                  )}
                </>
              )}

              {/* Liga: ida/ida y vuelta y fase final opcional */}
              {t.type === "liga" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Formato de vueltas</label>
                    <div className="flex gap-2">
                      {[
                        { id: false, label: "Ida" },
                        { id: true, label: "Ida y vuelta" },
                      ].map((opt) => (
                        <button key={String(opt.id)}
                          onClick={() => persist({ ...t, config: { ...t.config, idaYVuelta: opt.id } })}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${(t.config.idaYVuelta || false) === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                          style={(t.config.idaYVuelta || false) === opt.id ? { background: color } : undefined}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-2">Fase final</label>
                    <div className="flex gap-2">
                      {[
                        { id: false, label: "Solo tabla" },
                        { id: true, label: "Con eliminatoria" },
                      ].map((opt) => (
                        <button key={String(opt.id)}
                          onClick={() => persist({ ...t, config: { ...t.config, playoffEnabled: opt.id } })}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${(t.config.playoffEnabled || false) === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                          style={(t.config.playoffEnabled || false) === opt.id ? { background: color } : undefined}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  {t.config.playoffEnabled && (
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">Parejas que pasan a la eliminatoria</label>
                      <div className="flex gap-2">
                        {ligaQualifierOptions(tot).map(n => (
                          <button key={n}
                            onClick={() => persist({ ...t, config: { ...t.config, advanceQualifiers: n } })}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${ligaQualifiers(t.config, tot) === n ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                            style={ligaQualifiers(t.config, tot) === n ? { background: color } : undefined}
                          >{n}</button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Con menos de 5 parejas pasan 2, con 5 o más hasta 4 y con 9 o más hasta 8.
                      </p>
                    </div>
                  )}
                  {t.config.playoffEnabled && ligaQualifiers(t.config, tot) >= 4 && (
                    <div>
                      <label className="text-xs text-gray-400 font-semibold block mb-2">Partido por el 3.º y 4.º puesto</label>
                      <div className="flex gap-2">
                        {[
                          { id: false, label: "No" },
                          { id: true, label: "Sí" },
                        ].map((opt) => (
                          <button key={String(opt.id)}
                            onClick={() => persist({ ...t, config: { ...t.config, thirdPlace: opt.id } })}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${(t.config.thirdPlace || false) === opt.id ? "text-white" : "bg-[#1f2937] text-[#94a3b8]"}`}
                            style={(t.config.thirdPlace || false) === opt.id ? { background: color } : undefined}
                          >{opt.label}</button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Lo juegan los dos perdedores de las semifinales.</p>
                    </div>
                  )}
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

            {/* ── Formato de partido (no aplica al Pozo) ── */}
            {t.type !== "pozo" && (
              <>
                <SectionHeader>🎾 Formato de partido</SectionHeader>
                <MatchFormatPicker
                  config={t.config}
                  color={color}
                  allowSets={t.type === "mundialito" || t.type === "relampago" || t.type === "liga"}
                  onChange={(patch) => persist({ ...t, config: { ...t.config, ...patch } })}
                />
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
          <div className="mb-4">
            <SectionHeader>Modo de juego</SectionHeader>
            <div className="flex gap-2">
              {[
                { id: "fixed", label: "Parejas fijas" },
                { id: "mixer", label: "Individual (cambia de pareja)" },
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
                  className={`px-[14px] py-[6px] rounded-lg border-2 font-bold cursor-pointer text-[13px] ${t.config.pozoMode === id ? "" : "bg-transparent border-[#334155] text-[#64748b]"}`}
                  style={t.config.pozoMode === id ? { borderColor: color, background: `${color}22`, color } : undefined}
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
          <div className="flex flex-col gap-1.5 mb-4">
            {players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-[#0f172a] border border-[#334155] rounded-[10px] px-[14px] py-[10px]"
              >
                <span className="text-[#f1f5f9] text-[14px]">
                  {idx + 1}. {player.name}
                </span>
                <button
                  onClick={() =>
                    persist({
                      ...t,
                      playerInputs: t.playerInputs.filter((_, i) => i !== idx),
                    })
                  }
                  className="bg-transparent border-0 text-[#ef4444] cursor-pointer text-[18px]"
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
              className={`w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors ${newP1.trim() && newP2.trim() ? "text-white" : "bg-[#374151] text-white"}`}
              style={newP1.trim() && newP2.trim() ? { background: color } : undefined}
            >
              + Agregar pareja
            </button>
          </div>
        )}

        {/* Step 5: input de jugador individual — solo mixer */}
        {isAdmin && isMixer && (
          <div className="flex gap-2 mb-3">
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
              className={`px-4 py-3 rounded-xl font-bold text-sm ${newPlayer.trim() ? "text-white cursor-pointer" : "bg-[#334155] text-[#64748b] cursor-not-allowed"}`}
              style={newPlayer.trim() ? { background: color } : undefined}
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
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0 ${t.config.goldenPoint !== false
                      ? "bg-[#16a34a30] text-[#4ade80] border border-[#4ade8040]"
                      : "bg-[#374151] text-[#94a3b8] border border-transparent"}`}
                  >
                    {t.config.goldenPoint !== false ? "ON" : "OFF"}
                  </button>
                </div>
                {t.type === "relampago" && (
                  <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-700">
                    <div>
                      <div className="text-sm font-semibold text-gray-200">Cabezas de serie</div>
                      <div className="text-xs text-gray-500 mt-0.5">Respetar el orden de carga en vez de sortear el cuadro</div>
                    </div>
                    <button
                      onClick={() => persist({ ...t, config: { ...t.config, seedByOrder: !t.config.seedByOrder } })}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer shrink-0 ${t.config.seedByOrder
                        ? "bg-[#16a34a30] text-[#4ade80] border border-[#4ade8040]"
                        : "bg-[#374151] text-[#94a3b8] border border-transparent"}`}
                    >
                      {t.config.seedByOrder ? "ON" : "OFF"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Botón iniciar ── */}
        {isAdmin && (
          <>
            <button
              data-testid={hasDraw(t.type) ? "btn-open-modal" : undefined}
              onClick={hasDraw(t.type) ? openLaunch : onStart}
              disabled={!ok}
              className={`w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors ${ok ? "text-white cursor-pointer" : "bg-[#374151] text-[#64748b] cursor-not-allowed opacity-50"}`}
              style={ok ? { background: color } : undefined}
            >
              {hasDraw(t.type) ? "📋 Revisar y lanzar" : "🎾 Iniciar Torneo"}
            </button>
            <p className="text-center text-xs text-gray-600 mt-3">
              Una vez guardado el primer resultado no podrás modificar la configuración del torneo.
            </p>
          </>
        )}

      </div>
    </div>
    {showLaunch && activeDraw && (
      <LaunchModal
        color={color}
        tabs={[{ id: "sorteo", label: t.type === "liga" ? "🎲 Fixture" : t.type === "relampago" ? "🎲 Cuadro" : "🎲 Sorteo" }, { id: "resumen", label: "📋 Resumen" }]}
        activeTab={launchTab}
        onTab={setLaunchTab}
        onClose={() => setShowLaunch(false)}
        onReshuffle={launchTab === "sorteo" && drawIsRandom(t) ? reshuffleDraw : null}
        onStart={onStart}
        saving={saving}
      >
        {launchTab === "sorteo" && t.type === "mundialito" && (
          <GroupsPreview groups={activeDraw.groups} advancePerGroup={t.config.advancePerGroup ?? 2} knockout={knockoutInfo(t.config.groupCount || 2, t.config.advancePerGroup ?? 2)} />
        )}
        {launchTab === "sorteo" && t.type === "liga" && (
          <FixturePreview rounds={activeDraw.rounds} matches={activeDraw.matches} />
        )}
        {launchTab === "sorteo" && t.type === "relampago" && (
          <BracketPreview bracket={activeDraw.bracket} seeded={!!t.config.seedByOrder} />
        )}
        {launchTab === "resumen" && (() => {
          const fmt = matchFormatSummary({ ...t.config, scoringFormat: t.config.scoringFormat || (t.type === "liga" ? "sets3" : undefined) });
          return (
            <div className="px-4 py-4 space-y-3">
              <SummaryCard title="Información">
                <SummaryRow label="Nombre" value={t.config.name || "—"} />
                {t.config.datetime && <SummaryRow label="Fecha" value={new Date(t.config.datetime).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })} />}
                {t.config.location && <SummaryRow label="Ubicación" value={t.config.location} />}
              </SummaryCard>
              <SummaryCard title="Participantes">
                <SummaryRow label="Total" value={`${tot} parejas`} />
                {t.type !== "liga" && <SummaryRow label="Pistas" value={t.config.courts} />}
                {t.type === "mundialito" && <SummaryRow label="Grupos" value={t.config.groupCount || 2} />}
                {t.type === "mundialito" && <SummaryRow label="Avanzan por grupo" value={t.config.advancePerGroup ?? 2} />}
                {t.type === "mundialito" && <SummaryRow label="Clasifican a la eliminatoria" value={`${knockoutInfo(t.config.groupCount || 2, t.config.advancePerGroup ?? 2).qualifiers} parejas`} />}
                {t.type === "mundialito" && knockoutInfo(t.config.groupCount || 2, t.config.advancePerGroup ?? 2).byes > 0 && (
                  <SummaryRow label="Pasan directo" value={knockoutInfo(t.config.groupCount || 2, t.config.advancePerGroup ?? 2).byes} />
                )}
                {t.type === "relampago" && <SummaryRow label="Cuadro" value={t.config.seedByOrder ? "Por orden de carga" : "Sorteado al azar"} />}
                {t.type === "liga" && <SummaryRow label="Jornadas" value={activeDraw.rounds.length} />}
                {t.type === "liga" && <SummaryRow label="Ida y vuelta" value={t.config.idaYVuelta ? "Sí" : "No"} />}
                {t.type === "mundialito" && mundialitoThirdPlace(t.config) && <SummaryRow label="Partido por el 3.º puesto" value="Sí" />}
                {t.type === "liga" && ligaThirdPlace(t.config, tot) && <SummaryRow label="Partido por el 3.º puesto" value="Sí" />}
                {t.type === "liga" && <SummaryRow label="Eliminatoria final" value={t.config.playoffEnabled ? `Sí (${ligaQualifiers(t.config, tot)} parejas)` : "No"} />}
              </SummaryCard>
              <SummaryCard title="Formato de partido">
                <SummaryRow label="Formato" value={fmt.label} />
                <SummaryRow label="Detalle" value={fmt.detail} />
                <SummaryRow label="Punto de oro" value={t.config.goldenPoint !== false ? "Activado" : "Desactivado"} />
              </SummaryCard>
            </div>
          );
        })()}
      </LaunchModal>
    )}
    </>
  );
}
