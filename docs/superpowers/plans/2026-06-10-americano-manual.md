# Americano Manual — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un modo de emparejamiento "Manual" al torneo Americano donde el organizador construye las rondas a mano (dropdowns por slot) desde una pantalla dedicada en el setup.

**Architecture:** Se agrega `"manual"` como tercer valor de `t.config.matchmaking`. El organizador construye rondas en un nuevo componente `ManualRoundBuilder` (pantalla full-screen con tabs por ronda). Al lanzar, las rondas manuales se escriben como `precomputedRounds` — el mismo formato que ya consume `PlayAmericano`, que no necesita ningún cambio.

**Tech Stack:** React 18, Vitest, Tailwind CSS v4, JavaScript ES2022. Sin TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-10-americano-manual-design.md`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/logic/manualRounds.js` | **Crear** | Funciones puras: calcular descansos, validar rondas, construir rondas vacías, filtrar jugadores disponibles por slot |
| `src/logic/manualRounds.test.js` | **Crear** | Tests unitarios para las funciones de `manualRounds.js` |
| `src/components/setup/ManualRoundBuilder.jsx` | **Crear** | Pantalla full-screen con tabs de rondas y dropdowns por slot |
| `src/components/setup/SetupAmericano.jsx` | **Modificar** | Integrar la opción "Manual", el botón de acceso al builder y el gate de lanzamiento |

`PlayAmericano.jsx`, `americano.js`, `initTournament.js`: **sin cambios**.

---

## Task 1: Funciones de lógica pura (`manualRounds.js`)

**Files:**
- Create: `src/logic/manualRounds.js`
- Create: `src/logic/manualRounds.test.js`

- [ ] **Paso 1.1 — Crear el archivo de tests vacío y escribir los primeros tests (calcularDescansos)**

Crear `src/logic/manualRounds.test.js`:

```js
import { describe, it, expect } from "vitest";
import { calcularDescansos } from "./manualRounds";

const p = (id) => ({ id, name: `J${id}`, level: 0, pts: 0, gf: 0, gc: 0 });

describe("calcularDescansos", () => {
  it("devuelve los jugadores no asignados a ninguna cancha", () => {
    const players = [p(0), p(1), p(2), p(3), p(4), p(5)];
    const courts = [{ pairA: [p(0), p(1)], pairB: [p(2), p(3)] }];
    expect(calcularDescansos(players, courts).map((x) => x.id)).toEqual([4, 5]);
  });

  it("devuelve todos los jugadores si no hay canchas", () => {
    const players = [p(0), p(1)];
    expect(calcularDescansos(players, [])).toHaveLength(2);
  });

  it("ignora slots null al calcular asignados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const courts = [{ pairA: [p(0), null], pairB: [p(2), p(3)] }];
    // p(1) no está asignado (el null no lo asigna)
    expect(calcularDescansos(players, courts).map((x) => x.id)).toEqual([1]);
  });

  it("devuelve array vacío cuando todos están asignados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const courts = [{ pairA: [p(0), p(1)], pairB: [p(2), p(3)] }];
    expect(calcularDescansos(players, courts)).toHaveLength(0);
  });
});
```

- [ ] **Paso 1.2 — Ejecutar los tests y confirmar que fallan**

```bash
npx vitest run src/logic/manualRounds.test.js --reporter=verbose
```

Resultado esperado: `FAIL` con `Cannot find module './manualRounds'`.

- [ ] **Paso 1.3 — Crear `manualRounds.js` con `calcularDescansos`**

Crear `src/logic/manualRounds.js`:

```js
export function calcularDescansos(entities, courts) {
  const assigned = new Set();
  courts.forEach((c) => {
    [...(c.pairA || []), ...(c.pairB || [])].forEach((p) => {
      if (p) assigned.add(p.id);
    });
  });
  return entities.filter((p) => !assigned.has(p.id));
}
```

- [ ] **Paso 1.4 — Ejecutar los tests y confirmar que pasan**

```bash
npx vitest run src/logic/manualRounds.test.js --reporter=verbose
```

Resultado esperado: `4 tests passed`.

- [ ] **Paso 1.5 — Agregar tests para las funciones restantes**

Agregar al final de `src/logic/manualRounds.test.js`:

```js
import {
  calcularDescansos,
  isCourtComplete,
  isRoundComplete,
  buildEmptyRound,
  availablePlayersForSlot,
} from "./manualRounds";

describe("isCourtComplete", () => {
  it("devuelve true cuando los 4 slots tienen jugadores", () => {
    expect(isCourtComplete({ pairA: [p(0), p(1)], pairB: [p(2), p(3)] })).toBe(true);
  });

  it("devuelve false cuando algún slot es null", () => {
    expect(isCourtComplete({ pairA: [p(0), null], pairB: [p(2), p(3)] })).toBe(false);
  });

  it("devuelve false cuando ambos slots de un par son null", () => {
    expect(isCourtComplete({ pairA: [null, null], pairB: [p(2), p(3)] })).toBe(false);
  });
});

describe("isRoundComplete", () => {
  it("devuelve true cuando todas las canchas están completas", () => {
    const round = {
      courts: [
        { pairA: [p(0), p(1)], pairB: [p(2), p(3)] },
        { pairA: [p(4), p(5)], pairB: [p(6), p(7)] },
      ],
    };
    expect(isRoundComplete(round)).toBe(true);
  });

  it("devuelve false cuando alguna cancha tiene un slot null", () => {
    const round = {
      courts: [
        { pairA: [p(0), p(1)], pairB: [p(2), p(3)] },
        { pairA: [p(4), null], pairB: [p(6), p(7)] },
      ],
    };
    expect(isRoundComplete(round)).toBe(false);
  });
});

describe("buildEmptyRound", () => {
  it("crea N canchas con todos los slots en null", () => {
    const round = buildEmptyRound(3);
    expect(round.courts).toHaveLength(3);
    round.courts.forEach((c) => {
      expect(c.pairA).toEqual([null, null]);
      expect(c.pairB).toEqual([null, null]);
      expect(c.scoreA).toBe("");
      expect(c.scoreB).toBe("");
      expect(c.saved).toBe(false);
    });
  });
});

describe("availablePlayersForSlot", () => {
  it("excluye los jugadores asignados en otros slots de la misma ronda", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    // Para pairB slot 0, p(0) y p(1) no deben aparecer
    const available = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toEqual([2, 3]);
  });

  it("incluye el jugador actual del slot aunque esté asignado", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    round.courts[0].pairB[0] = p(2);
    // Para pairB slot 0 (actualmente p(2)), p(2) debe estar disponible
    const available = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toContain(2);
  });

  it("devuelve todos los jugadores si la ronda está vacía", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    const available = availablePlayersForSlot(players, round, 0, "pairA", 0);
    expect(available).toHaveLength(4);
  });
});
```

- [ ] **Paso 1.6 — Ejecutar los tests y confirmar que fallan con "not a function"**

```bash
npx vitest run src/logic/manualRounds.test.js --reporter=verbose
```

Resultado esperado: `FAIL` con errores de importación para las funciones que faltan.

- [ ] **Paso 1.7 — Agregar las funciones restantes a `manualRounds.js`**

Reemplazar el contenido completo de `src/logic/manualRounds.js`:

```js
export function calcularDescansos(entities, courts) {
  const assigned = new Set();
  courts.forEach((c) => {
    [...(c.pairA || []), ...(c.pairB || [])].forEach((p) => {
      if (p) assigned.add(p.id);
    });
  });
  return entities.filter((p) => !assigned.has(p.id));
}

export function isCourtComplete(court) {
  return (
    court.pairA.length === 2 &&
    court.pairA.every(Boolean) &&
    court.pairB.length === 2 &&
    court.pairB.every(Boolean)
  );
}

export function isRoundComplete(round) {
  return round.courts.every(isCourtComplete);
}

export function buildEmptyRound(numCourts) {
  return {
    courts: Array.from({ length: numCourts }, () => ({
      pairA: [null, null],
      pairB: [null, null],
      scoreA: "",
      scoreB: "",
      saved: false,
    })),
    sittingOut: [],
  };
}

// Devuelve los jugadores disponibles para un slot específico de una ronda.
// Excluye todos los jugadores ya asignados en otros slots de esa ronda,
// pero incluye el jugador actualmente en este slot (para que su opción siga visible).
export function availablePlayersForSlot(players, round, courtIdx, pairKey, slotIdx) {
  const currentPlayer = round.courts[courtIdx][pairKey][slotIdx];
  const usedIds = new Set();
  round.courts.forEach((court, ci) => {
    ["pairA", "pairB"].forEach((pk) => {
      court[pk].forEach((player, si) => {
        if (player && !(ci === courtIdx && pk === pairKey && si === slotIdx)) {
          usedIds.add(player.id);
        }
      });
    });
  });
  const available = players.filter((p) => !usedIds.has(p.id));
  if (currentPlayer && !available.find((p) => p.id === currentPlayer.id)) {
    return [currentPlayer, ...available];
  }
  return available;
}
```

- [ ] **Paso 1.8 — Ejecutar todos los tests y confirmar que pasan**

```bash
npx vitest run src/logic/manualRounds.test.js --reporter=verbose
```

Resultado esperado: todos los tests en verde, `X tests passed`.

- [ ] **Paso 1.9 — Commit**

```bash
git add src/logic/manualRounds.js src/logic/manualRounds.test.js
git commit -m "feat: funciones puras para el modo americano manual"
```

---

## Task 2: Componente `ManualRoundBuilder`

**Files:**
- Create: `src/components/setup/ManualRoundBuilder.jsx`

- [ ] **Paso 2.1 — Crear el componente**

Crear `src/components/setup/ManualRoundBuilder.jsx`:

```jsx
import { useState } from "react";
import {
  buildEmptyRound,
  isRoundComplete,
  availablePlayersForSlot,
  calcularDescansos,
} from "../../logic/manualRounds";

const COLOR = "#0284c7";

export default function ManualRoundBuilder({ players, courts, rounds, onChange, onBack }) {
  const [activeRound, setActiveRound] = useState(0);

  function addRound() {
    const next = [...rounds, buildEmptyRound(courts)];
    onChange(next);
    setActiveRound(next.length - 1);
  }

  function updateSlot(roundIdx, courtIdx, pairKey, slotIdx, playerId) {
    const player = playerId
      ? players.find((p) => String(p.id) === playerId) ?? null
      : null;
    onChange(
      rounds.map((r, ri) =>
        ri !== roundIdx
          ? r
          : {
              ...r,
              courts: r.courts.map((c, ci) => {
                if (ci !== courtIdx) return c;
                const pair = [...c[pairKey]];
                pair[slotIdx] = player;
                return { ...c, [pairKey]: pair };
              }),
            }
      )
    );
  }

  const round = rounds[activeRound] ?? null;

  return (
    <div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-16">

        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 font-semibold mb-5 cursor-pointer transition-colors"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          ← Volver al setup
        </button>
        <h2 className="text-xl font-black mb-6" style={{ color: COLOR }}>
          ✏️ Armar Rondas
        </h2>

        {/* Tabs de rondas */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {rounds.map((r, i) => {
            const complete = isRoundComplete(r);
            const isActive = i === activeRound;
            return (
              <button
                key={i}
                onClick={() => setActiveRound(i)}
                className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                style={{
                  background: isActive ? COLOR : "#1f2937",
                  color: isActive ? "#fff" : complete ? "#4ade80" : "#64748b",
                  border: `1px solid ${isActive ? COLOR : complete ? "#4ade8040" : "#374151"}`,
                }}
              >
                R{i + 1} {complete ? "✓" : "✗"}
              </button>
            );
          })}
          <button
            onClick={addRound}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors"
            style={{ background: "#1f2937", border: "1px dashed #374151", color: "#38bdf8" }}
          >
            +
          </button>
        </div>

        {/* Estado vacío */}
        {rounds.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Tocá <span className="font-bold text-sky-400">+</span> para armar la primera ronda
          </div>
        )}

        {/* Editor de ronda */}
        {round && (
          <div className="space-y-4">
            {round.courts.map((court, ci) => (
              <div key={ci} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-700">
                  <span className="text-xs font-bold text-gray-500 tracking-widest">PISTA {ci + 1}</span>
                </div>
                <div
                  className="px-4 py-4 grid items-center gap-3"
                  style={{ gridTemplateColumns: "1fr auto 1fr" }}
                >
                  {/* pairA */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const options = availablePlayersForSlot(players, round, ci, "pairA", si);
                      return (
                        <select
                          key={si}
                          value={court.pairA[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(activeRound, ci, "pairA", si, e.target.value || null)
                          }
                          className="w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          style={{
                            borderColor: court.pairA[si] ? COLOR + "80" : "#374151",
                            color: court.pairA[si] ? "#f1f5f9" : "#64748b",
                          }}
                        >
                          <option value="">— elegir —</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                  </div>

                  {/* vs */}
                  <span className="text-gray-600 font-black text-base self-center">vs</span>

                  {/* pairB */}
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((si) => {
                      const options = availablePlayersForSlot(players, round, ci, "pairB", si);
                      return (
                        <select
                          key={si}
                          value={court.pairB[si]?.id ?? ""}
                          onChange={(e) =>
                            updateSlot(activeRound, ci, "pairB", si, e.target.value || null)
                          }
                          className="w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          style={{
                            borderColor: court.pairB[si] ? COLOR + "80" : "#374151",
                            color: court.pairB[si] ? "#f1f5f9" : "#64748b",
                          }}
                        >
                          <option value="">— elegir —</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Descansos automáticos */}
            {(() => {
              const resting = calcularDescansos(players, round.courts);
              if (!resting.length) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm">
                  <span>⏳</span>
                  <span className="text-yellow-400 font-semibold shrink-0">Descansan:</span>
                  <span className="text-gray-400">{resting.map((p) => p.name).join(" · ")}</span>
                </div>
              );
            })()}

            {/* Estado de la ronda */}
            <div
              className={`px-4 py-2.5 rounded-xl text-sm font-bold ${
                isRoundComplete(round)
                  ? "bg-green-400/10 border border-green-400/20 text-green-400"
                  : "bg-red-400/10 border border-red-400/20 text-red-400"
              }`}
            >
              {isRoundComplete(round)
                ? "✓ Ronda completa"
                : "✗ Faltan jugadores por asignar"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2.2 — Verificar que el build no tiene errores**

```bash
npm run build
```

Resultado esperado: build exitoso, sin errores de compilación (solo advertencias de chunks son OK).

- [ ] **Paso 2.3 — Commit**

```bash
git add src/components/setup/ManualRoundBuilder.jsx
git commit -m "feat: componente ManualRoundBuilder para armar rondas manualmente"
```

---

## Task 3: Integración en `SetupAmericano`

**Files:**
- Modify: `src/components/setup/SetupAmericano.jsx`

- [ ] **Paso 3.1 — Agregar imports al tope del archivo**

En `src/components/setup/SetupAmericano.jsx`, agregar dos imports nuevos justo después de los existentes:

```js
// Reemplazar línea existente:
import { buildFirstRoundAmericano, precomputeAllRounds } from "../../logic/americano";

// Por:
import { buildFirstRoundAmericano, precomputeAllRounds } from "../../logic/americano";
import { calcularDescansos, isCourtComplete } from "../../logic/manualRounds";
import ManualRoundBuilder from "./ManualRoundBuilder";
```

- [ ] **Paso 3.2 — Agregar nuevas variables de estado**

En el bloque de `useState` de `SetupAmericano` (después de la línea `const [showLaunchModal, setShowLaunchModal] = useState(false);`), agregar:

```js
const [localManualRounds,  setLocalManualRounds]  = useState([]);
const [showManualBuilder,  setShowManualBuilder]   = useState(false);
const [manualResetMsg,     setManualResetMsg]      = useState(false);
```

- [ ] **Paso 3.3 — Agregar valores derivados para el modo manual**

Después de la línea `const canReshuffle = ...`, agregar:

```js
const isManual = !isPairs && (t.config.matchmaking || "americano") === "manual";

const manualReady = !isManual || (
  localManualRounds.length >= 1 &&
  localManualRounds.every((r) => r.courts.every(isCourtComplete))
);

const canShowMatchmakingTab = canReshuffle || (isManual && localManualRounds.length > 0);
const roundsToPreview = isManual ? localManualRounds : localPrecomputedRounds;
```

- [ ] **Paso 3.4 — Actualizar la variable `ok` con el gate manual**

Reemplazar la línea:

```js
const ok = isPairs
  ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
  : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0);
```

Por:

```js
const ok = (isPairs
  ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
  : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0))
  && manualReady;
```

- [ ] **Paso 3.5 — Agregar handler para el cambio de modo de emparejamiento**

Antes de la función `handleReshuffle`, agregar:

```js
function handleMatchmakingChange(val) {
  if (val !== "manual") {
    setLocalManualRounds([]);
    setManualResetMsg(false);
  } else {
    setLocalPrecomputedRounds(null);
    setLocalRoundWarnings([]);
  }
  persist({ ...t, config: { ...t.config, matchmaking: val } });
}
```

- [ ] **Paso 3.6 — Agregar handler para el cambio de canchas en modo manual**

Antes de la función `handleReshuffle`, agregar:

```js
function handleCourtsChange(n) {
  if (isManual && localManualRounds.length > 0) {
    setLocalManualRounds([]);
    setManualResetMsg(true);
  }
  setLocalPrecomputedRounds(null);
  setLocalRoundWarnings([]);
  persist({ ...t, config: { ...t.config, courts: n } });
}
```

- [ ] **Paso 3.7 — Actualizar el selector de canchas para usar el nuevo handler**

Buscar el bloque del selector de canchas (sección `🏓 Pistas`) y reemplazar el `onClick` inline por el nuevo handler:

```jsx
// Reemplazar:
onClick={() => { setLocalPrecomputedRounds(null); setLocalRoundWarnings([]); persist({ ...t, config: { ...t.config, courts: n } }); }}

// Por:
onClick={() => handleCourtsChange(n)}
```

- [ ] **Paso 3.8 — Actualizar el selector de emparejamiento para agregar "Manual" y usar el nuevo handler**

Buscar el bloque del selector de emparejamiento en la sección `⚙️ Configuración avanzada`:

```jsx
// Reemplazar:
{[{ id: "americano", label: "Americano" }, { id: "mexicano", label: "Mexicano" }].map(opt => (
  <button key={opt.id} onClick={() => persist({ ...t, config: { ...t.config, matchmaking: opt.id } })} ...>{opt.label}</button>
))}
<p className="text-xs text-gray-600 mt-1.5">{(t.config.matchmaking || "americano") === "americano" ? "Parejas aleatorias cada ronda" : "Desde ronda 2, los mejores juegan entre sí"}</p>

// Por:
{[
  { id: "americano", label: "Americano" },
  { id: "mexicano", label: "Mexicano" },
  { id: "manual", label: "Manual" },
].map(opt => (
  <button key={opt.id} onClick={() => handleMatchmakingChange(opt.id)} className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors" style={{ background: (t.config.matchmaking || "americano") === opt.id ? COLOR : "#374151", color: (t.config.matchmaking || "americano") === opt.id ? "#fff" : "#94a3b8" }}>{opt.label}</button>
))}
<p className="text-xs text-gray-600 mt-1.5">
  {(t.config.matchmaking || "americano") === "americano"
    ? "Parejas aleatorias cada ronda"
    : (t.config.matchmaking || "americano") === "mexicano"
    ? "Desde ronda 2, los mejores juegan entre sí"
    : "Vos elegís los emparejamientos de cada ronda"}
</p>
```

- [ ] **Paso 3.9 — Ocultar la sección "Rondas" en modo manual**

Buscar la `SectionHeader` con `🔄 Rondas` y envolver toda la sección (desde ese `SectionHeader` hasta el `input` de rondas custom) con una condición:

```jsx
{/* ── 6. Rondas — ocultar en modo manual ── */}
{!isManual && (
  <>
    <SectionHeader>🔄 Rondas</SectionHeader>
    <div className="flex gap-2 flex-wrap">
      {/* ... contenido existente sin cambios ... */}
    </div>
  </>
)}
```

- [ ] **Paso 3.10 — Agregar la sección "Rondas manuales" cuando el modo es Manual**

Después del bloque condicional `{!isManual && ...}` de la sección Rondas, agregar:

```jsx
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
      className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors mb-3"
      style={{ background: "#1f2937", border: `1px solid ${COLOR}50`, color: COLOR }}
    >
      ✏️ Armar rondas
    </button>

    {localManualRounds.length === 0 ? (
      <p className="text-xs text-gray-600 text-center">Sin rondas armadas todavía</p>
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
```

- [ ] **Paso 3.11 — Actualizar `handleOpenLaunchModal` para el modo manual**

Reemplazar:

```js
function handleOpenLaunchModal() {
  if (canReshuffle) {
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
```

Por:

```js
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
```

- [ ] **Paso 3.12 — Actualizar `onStart` para el modo manual**

Dentro de `onStart`, en el bloque que construye `precomputedRounds` y `currentRound` (antes del `await persist`), reemplazar:

```js
// Reemplazar el bloque completo de construcción de rondas:
let nc, nSit;
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
  const firstRound = precomputedRounds[0];
  currentRound = firstRound.courts.map((c) => ({ ...c, scoreA: "", scoreB: "", saved: false }));
  sittingOut = firstRound.sittingOut;
} else {
  ({ courts: currentRound, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode));
}

// Por:
let currentRound, sittingOut;
let precomputedRounds = null;
let roundWarnings = [];
if (isManual) {
  precomputedRounds = localManualRounds.map((r) => ({
    ...r,
    sittingOut: calcularDescansos(entities, r.courts),
  }));
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
```

- [ ] **Paso 3.13 — Actualizar el modal para usar `roundsToPreview` y `canShowMatchmakingTab`**

Dentro del modal `{showLaunchModal && ...}`, hacer tres cambios:

**Cambio A** — Tabs del modal: reemplazar `{canReshuffle && (` por `{canShowMatchmakingTab && (`:

```jsx
// Reemplazar:
{canReshuffle && (
  <div className="flex shrink-0" style={{ borderBottom: "1px solid #1f2937" }}>

// Por:
{canShowMatchmakingTab && (
  <div className="flex shrink-0" style={{ borderBottom: "1px solid #1f2937" }}>
```

**Cambio B** — Contenido del tab Emparejamientos: reemplazar `canReshuffle &&` y `localPrecomputedRounds` por las nuevas variables:

```jsx
// Reemplazar:
{canReshuffle && launchModalTab === "emparejamientos" && localPrecomputedRounds && (

// Por:
{canShowMatchmakingTab && launchModalTab === "emparejamientos" && roundsToPreview && (
```

Y dentro de ese bloque, reemplazar `localPrecomputedRounds.map` por `roundsToPreview.map`.

**Cambio C** — Botón Re-sortear: reemplazar `{canReshuffle && launchModalTab === "emparejamientos" && (` conservando solo su aparición junto al botón re-sortear en el footer. El botón ya usa `canReshuffle`, que sigue siendo correcto — solo verificar que `canReshuffle` sigue falso en manual mode (lo es, porque chequea `matchmaking === "americano"`).

- [ ] **Paso 3.14 — Agregar el render del builder full-screen**

Al inicio del `return` principal de `SetupAmericano`, ANTES del `<>` exterior, agregar:

```jsx
// Solo dentro del bloque {isAdmin && ...}, antes del return principal:
if (showManualBuilder) {
  const players = (t.playerInputs || [])
    .map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }))
    .filter((p) => p.name);
  return (
    <ManualRoundBuilder
      players={players}
      courts={t.config.courts}
      rounds={localManualRounds}
      onChange={setLocalManualRounds}
      onBack={() => setShowManualBuilder(false)}
    />
  );
}
```

Este bloque debe estar dentro del componente `SetupAmericano`, antes del `return` que renderiza el setup normal. Como `SetupAmericano` tiene un único `return` con lógica de `isAdmin` dentro, agregar este render condicional antes del `return (` principal:

```jsx
// En SetupAmericano, antes del return principal:
if (showManualBuilder && isAdmin) {
  const players = (t.playerInputs || [])
    .map((p, i) => ({ id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0 }))
    .filter((p) => p.name);
  return (
    <ManualRoundBuilder
      players={players}
      courts={t.config.courts}
      rounds={localManualRounds}
      onChange={setLocalManualRounds}
      onBack={() => setShowManualBuilder(false)}
    />
  );
}
```

- [ ] **Paso 3.15 — Verificar build limpio**

```bash
npm run build
```

Resultado esperado: build exitoso sin errores.

- [ ] **Paso 3.16 — Ejecutar todos los tests**

```bash
npm run test
```

Resultado esperado: todos los tests en verde. Los tests nuevos de `manualRounds.test.js` deben pasar.

- [ ] **Paso 3.17 — Commit final**

```bash
git add src/components/setup/SetupAmericano.jsx
git commit -m "feat: integrar modo Americano Manual en SetupAmericano"
```

---

## Verificación manual post-implementación

Una vez completadas las 3 tareas, verificar el flujo completo con `npm run dev`:

1. Crear un torneo Americano
2. En el setup, ir a "⚙️ Configuración avanzada" → Emparejamiento → seleccionar "Manual"
3. Confirmar que la sección "Rondas" desaparece y aparece "✏️ Rondas manuales"
4. Tocar "✏️ Armar rondas" → confirmar que abre pantalla full-screen
5. Tocar "+" para agregar una ronda → confirmar que aparece la tab R1 ✗
6. Asignar 4 jugadores con los dropdowns → confirmar que los usados desaparecen de las otras opciones
7. Confirmar que aparece "⏳ Descansan: ..." con los jugadores sin asignar
8. Completar todos los slots → confirmar que la tab muestra "✓" y el estado dice "✓ Ronda completa"
9. Agregar varias rondas con "+"
10. Volver al setup con "← Volver al setup" → confirmar que el tracker muestra "N de M rondas completas"
11. Completar todas las rondas → confirmar que "Revisar y lanzar" se habilita
12. Tocar "Revisar y lanzar" → confirmar que la tab "Emparejamientos" muestra las rondas armadas
13. Iniciar el torneo → confirmar que PlayAmericano muestra la ronda 1 con los emparejamientos manuales
