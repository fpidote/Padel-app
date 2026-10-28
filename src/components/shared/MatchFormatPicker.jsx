// src/components/shared/MatchFormatPicker.jsx
// Selector único de "cómo se juega cada partido". Los ajustes de la opción elegida aparecen
// justo debajo de ella. Lo usan SetupPairs (con sets) y SetupAmericano (sin sets).
import { useState, useRef, useEffect } from "react";
import { availableMatchFormats, matchFormatOf, matchFormatPatch } from "../../logic/matchFormat";

const CHIP = "flex-1 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors";
const CUSTOM_INPUT =
  "w-16 py-2 rounded-lg text-sm text-center font-bold outline-none transition-colors bg-[#374151] text-gray-300 placeholder:text-gray-600 shrink-0";

function Chip({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={CHIP}
      style={{ background: active ? color : "#374151", color: active ? "#fff" : "#94a3b8" }}
    >
      {children}
    </button>
  );
}

function NumberChoice({ label, values, current, color, custom, max, onPick, onType }) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-semibold block mb-2">{label}</label>
      <div className="flex gap-2">
        {values.map((n) => (
          <Chip key={n} active={current === n} color={color} onClick={() => onPick(n)}>{n}</Chip>
        ))}
        <input
          type="number"
          value={custom}
          onChange={(e) => onType(e.target.value)}
          placeholder="Otro"
          min={1}
          max={max}
          className={CUSTOM_INPUT}
        />
      </div>
    </div>
  );
}

export default function MatchFormatPicker({ config, color, allowSets = false, includeFormat = true, onChange }) {
  const cfg = config || {};
  const current = matchFormatOf(cfg);
  const [custom, setCustom] = useState({ matchMinutes: "", rallyPoints: "", targetGames: "" });
  const timers = useRef({});
  const onChangeRef = useRef(onChange);

  // El guardado diferido usa siempre el onChange más reciente (evita pisar el torneo con una
  // copia vieja) y se cancela al desmontar, por ejemplo al iniciar el torneo.
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  function pickNumber(field, n) {
    clearTimeout(timers.current[field]);
    setCustom((c) => ({ ...c, [field]: "" }));
    onChange({ [field]: n });
  }

  function typeNumber(field, value) {
    setCustom((c) => ({ ...c, [field]: value }));
    clearTimeout(timers.current[field]);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1) {
      timers.current[field] = setTimeout(() => onChangeRef.current({ [field]: num }), 600);
    }
  }

  function settings() {
    const panel = "bg-[#1f2937] border border-gray-700 rounded-xl p-4 mt-2 space-y-4";
    if (current === "timed") {
      const metric = cfg.timedMetric ?? "games";
      return (
        <div className={panel}>
          <p className="text-xs text-gray-500">
            Al terminar el tiempo se anota el resultado. En caso de empate, punto de oro.
          </p>
          <NumberChoice
            label="Minutos por partido"
            values={[8, 10, 12, 15, 20]}
            current={cfg.matchMinutes ?? 10}
            color={color}
            custom={custom.matchMinutes}
            max={90}
            onPick={(n) => pickNumber("matchMinutes", n)}
            onType={(v) => typeNumber("matchMinutes", v)}
          />
          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-2">Qué se anota en cada partido</label>
            <div className="flex gap-2">
              <Chip active={metric === "games"} color={color} onClick={() => onChange({ timedMetric: "games" })}>
                Games ganados
              </Chip>
              <Chip active={metric === "points"} color={color} onClick={() => onChange({ timedMetric: "points" })}>
                Puntos acumulados
              </Chip>
            </div>
          </div>
        </div>
      );
    }
    if (current === "points") {
      return (
        <div className={panel}>
          <p className="text-xs text-gray-500">
            Si el partido termina 16-8, cada jugador acumula esos puntos.
          </p>
          <NumberChoice
            label="Puntos por partido"
            values={[16, 24, 32]}
            current={cfg.rallyPoints ?? 24}
            color={color}
            custom={custom.rallyPoints}
            onPick={(n) => pickNumber("rallyPoints", n)}
            onType={(v) => typeNumber("rallyPoints", v)}
          />
        </div>
      );
    }
    if (current === "games") {
      return (
        <div className={panel}>
          <p className="text-xs text-gray-500">Primero en llegar a X games gana el partido.</p>
          <NumberChoice
            label="Games para ganar"
            values={[4, 6, 8]}
            current={cfg.targetGames ?? 6}
            color={color}
            custom={custom.targetGames}
            onPick={(n) => pickNumber("targetGames", n)}
            onType={(v) => typeNumber("targetGames", v)}
          />
        </div>
      );
    }
    // Los sets no tienen ajustes: la propia opción ya explica que se anota set por set.
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {availableMatchFormats(allowSets).map((opt) => {
        const selected = current === opt.id;
        return (
          <div key={opt.id}>
            <button
              aria-pressed={selected}
              onClick={() => onChange(matchFormatPatch(opt.id, { includeFormat }))}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer"
              style={{
                background: selected ? color + "20" : "#1f2937",
                border: `1px solid ${selected ? color + "50" : "#374151"}`,
              }}
            >
              <span className="text-xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: selected ? color : "#f9fafb" }}>{opt.name}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
              {selected && <span className="text-xs font-bold" style={{ color }}>✓</span>}
            </button>
            {selected && settings()}
          </div>
        );
      })}
    </div>
  );
}
