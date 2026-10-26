# Manual Americano — Autocompletar y Selects Mejorados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar botón "Autocompletar todo" al ManualRoundBuilder que genera todas las rondas con la lógica americano clásica, y mejorar los selects de jugadores para mostrar niveles y permitir reasignar sin borrar primero.

**Architecture:** Tres cambios encadenados: (1) `availablePlayersForSlot` pasa a retornar dos grupos `{ available, assignedElsewhere }` en lugar de un array plano; (2) ManualRoundBuilder consume los grupos con `<optgroup>`, muestra niveles en los labels y hace swap automático al reasignar; (3) nuevo botón "Autocompletar todo" usa `precomputeAllRounds` pasando un nuevo prop `config` desde SetupAmericano.

**Tech Stack:** React 18, Vitest, lógica pura en `src/logic/`, sin TypeScript.

---

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/logic/manualRounds.js` | `availablePlayersForSlot` retorna `{ available, assignedElsewhere }` |
| `src/logic/manualRounds.test.js` | Tests actualizados para nuevo tipo de retorno |
| `src/components/setup/ManualRoundBuilder.jsx` | Selects con optgroups + niveles + swap + botón Autocompletar |
| `src/components/setup/SetupAmericano.jsx` | Pasa nuevo prop `config` a ManualRoundBuilder |

---

## Task 1: Actualizar `availablePlayersForSlot` con retorno agrupado

**Files:**
- Modify: `src/logic/manualRounds.js`
- Test: `src/logic/manualRounds.test.js`

- [ ] **Step 1: Actualizar los tests existentes para el nuevo tipo de retorno**

Reemplazar el bloque `describe("availablePlayersForSlot", ...)` completo en `src/logic/manualRounds.test.js`:

```js
describe("availablePlayersForSlot", () => {
  it("retorna available con jugadores libres y assignedElsewhere con los ocupados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toEqual([2, 3]);
    expect(assignedElsewhere.map((x) => x.id)).toEqual([0, 1]);
  });

  it("incluye el jugador actual del slot en available (no en assignedElsewhere)", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    round.courts[0].pairB[0] = p(2); // jugador actual del slot que estamos consultando
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toContain(2);
    expect(assignedElsewhere.map((x) => x.id)).not.toContain(2);
    expect(assignedElsewhere.map((x) => x.id)).toEqual([0, 1]);
  });

  it("devuelve todos en available y assignedElsewhere vacío si la ronda está vacía", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairA", 0);
    expect(available).toHaveLength(4);
    expect(assignedElsewhere).toHaveLength(0);
  });

  it("prepende el jugador actual en available aunque no esté en la lista de jugadores", () => {
    const players = [p(0), p(1), p(2)]; // p(3) eliminado del torneo pero sigue en el slot
    const round = buildEmptyRound(1);
    round.courts[0].pairB[1] = p(3);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 1);
    expect(available[0].id).toBe(3);
    expect(available).toHaveLength(4); // p(3) prepended + p(0), p(1), p(2)
    expect(assignedElsewhere).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```bash
npx vitest run src/logic/manualRounds.test.js
```

Expected: FAIL — los tests del `describe("availablePlayersForSlot")` fallan porque la función aún retorna array plano.

- [ ] **Step 3: Actualizar `availablePlayersForSlot` en `src/logic/manualRounds.js`**

Reemplazar la función actual (líneas 35-52):

```js
export function availablePlayersForSlot(players, round, courtIdx, pairKey, slotIdx) {
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
  const currentPlayer = round.courts[courtIdx][pairKey][slotIdx];
  const available = players.filter((p) => !usedIds.has(p.id));
  const assignedElsewhere = players.filter((p) => usedIds.has(p.id));
  // Jugador actual que fue eliminado del torneo pero sigue en el slot
  if (
    currentPlayer &&
    !available.find((p) => p.id === currentPlayer.id) &&
    !assignedElsewhere.find((p) => p.id === currentPlayer.id)
  ) {
    return { available: [currentPlayer, ...available], assignedElsewhere };
  }
  return { available, assignedElsewhere };
}
```

- [ ] **Step 4: Ejecutar tests y verificar que pasan**

```bash
npx vitest run src/logic/manualRounds.test.js
```

Expected: PASS — todos los tests del archivo pasan.

- [ ] **Step 5: Commit**

```bash
git add src/logic/manualRounds.js src/logic/manualRounds.test.js
git commit -m "refactor: availablePlayersForSlot retorna { available, assignedElsewhere }"
```

---

## Task 2: Actualizar selects en ManualRoundBuilder — niveles, optgroups y swap

**Files:**
- Modify: `src/components/setup/ManualRoundBuilder.jsx`

- [ ] **Step 1: Agregar constante LEVELS y helper `levelLabel` al inicio del componente**

Justo debajo de `const COLOR = "#0284c7";` (línea 9), agregar:

```js
const LEVELS = [
  { short: "-", color: "#64748b" },
  { short: "P", color: "#94a3b8" },
  { short: "M", color: "#38bdf8" },
  { short: "A", color: "#84cc16" },
];

function levelLabel(p) {
  const lvl = p.level || 0;
  return lvl > 0 ? `[${LEVELS[lvl].short}] ` : "";
}
```

- [ ] **Step 2: Actualizar `updateSlot` para hacer swap automático**

Reemplazar la función `updateSlot` actual (líneas 26-45) con esta versión que limpia el slot anterior cuando el jugador ya está asignado en otro lugar:

```js
function updateSlot(roundIdx, courtIdx, pairKey, slotIdx, playerId) {
  const player = playerId
    ? players.find((p) => String(p.id) === playerId) ?? null
    : null;
  onChange(
    rounds.map((r, ri) => {
      if (ri !== roundIdx) return r;
      const newCourts = r.courts.map((c, ci) => {
        let updated = { ...c, pairA: [...c.pairA], pairB: [...c.pairB] };
        // Limpiar slot previo del jugador (swap implícito)
        if (player) {
          ["pairA", "pairB"].forEach((pk) => {
            updated[pk] = updated[pk].map((p, si) =>
              p?.id === player.id && !(ci === courtIdx && pk === pairKey && si === slotIdx)
                ? null
                : p
            );
          });
        }
        // Asignar al nuevo slot
        if (ci === courtIdx) {
          updated[pairKey] = [...updated[pairKey]];
          updated[pairKey][slotIdx] = player;
        }
        return updated;
      });
      return { ...r, courts: newCourts };
    })
  );
}
```

- [ ] **Step 3: Actualizar los dos bloques `{[0, 1].map((si) => {...})}` para usar el nuevo retorno agrupado y los optgroups**

Hay dos bloques idénticos en el JSX, uno para `pairA` (líneas ~127-150) y otro para `pairB` (líneas ~157-180). Reemplazar **ambos** — cambiar `"pairA"` por `"pairB"` en el segundo bloque:

```jsx
{[0, 1].map((si) => {
  const { available, assignedElsewhere } = availablePlayersForSlot(
    players, round, ci, "pairA", si
  );
  return (
    <select
      key={si}
      value={court.pairA[si]?.id ?? ""}
      onChange={(e) =>
        updateSlot(safeActive, ci, "pairA", si, e.target.value || null)
      }
      className="w-full bg-[#0f172a] border rounded-xl px-3 py-2 text-sm font-bold outline-none"
      style={{
        borderColor: court.pairA[si] ? COLOR + "80" : "#374151",
        color: court.pairA[si] ? "#f1f5f9" : "#64748b",
      }}
    >
      <option value="">— elegir —</option>
      {available.map((p) => (
        <option key={p.id} value={p.id}>
          {levelLabel(p)}{p.name}
        </option>
      ))}
      {assignedElsewhere.length > 0 && (
        <optgroup label="Ya asignados">
          {assignedElsewhere.map((p) => (
            <option key={`e-${p.id}`} value={p.id}>
              {levelLabel(p)}{p.name} ↩
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
})}
```

El bloque de `pairB` es idéntico con `"pairA"` → `"pairB"` y `court.pairA` → `court.pairB`.

- [ ] **Step 4: Verificar build limpio**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/setup/ManualRoundBuilder.jsx
git commit -m "feat: selects con niveles, optgroup de ya-asignados y swap automático en ManualRoundBuilder"
```

---

## Task 3: Botón "Autocompletar todo" y prop `config`

**Files:**
- Modify: `src/components/setup/ManualRoundBuilder.jsx`
- Modify: `src/components/setup/SetupAmericano.jsx`

- [ ] **Step 1: Agregar import de `precomputeAllRounds` en ManualRoundBuilder**

En la línea 1 del archivo, agregar el import:

```js
import { precomputeAllRounds } from "../../logic/americano";
```

- [ ] **Step 2: Agregar prop `config` a la firma del componente**

Cambiar la línea 11:

```js
// antes:
export default function ManualRoundBuilder({ players, courts, rounds, onChange, onBack }) {
// después:
export default function ManualRoundBuilder({ players, courts, rounds, onChange, onBack, config = {} }) {
```

- [ ] **Step 3: Agregar estado `pendingAutoFill` y función `autoFillAll`**

Justo después de `const [activeRound, setActiveRound] = useState(0);` (línea 12), agregar:

```js
const [pendingAutoFill, setPendingAutoFill] = useState(false);

function autoFillAll() {
  const numRounds = rounds.length > 0 ? rounds.length : (config.maxRounds ?? 4);
  const { rounds: generated } = precomputeAllRounds(players, {
    courts,
    maxRounds: numRounds,
    mode: "individual",
    useLevels: config.useLevels,
  });
  onChange(generated);
  setActiveRound(0);
  setPendingAutoFill(false);
}

function handleAutoFillClick() {
  const hasData = rounds.some((r) =>
    r.courts.some((c) => [...c.pairA, ...c.pairB].some(Boolean))
  );
  if (hasData) {
    setPendingAutoFill(true);
  } else {
    autoFillAll();
  }
}
```

- [ ] **Step 4: Agregar botón e inline confirm en el header del JSX**

Reemplazar el bloque del `<h2>` header (líneas ~61-63):

```jsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-xl font-black" style={{ color: COLOR }}>
    ✏️ Armar Rondas
  </h2>
  <button
    onClick={handleAutoFillClick}
    className="text-xs px-3 py-2 rounded-xl font-bold cursor-pointer transition-colors"
    style={{ background: "#1f2937", border: `1px solid ${COLOR}50`, color: COLOR }}
  >
    ↺ Autocompletar todo
  </button>
</div>

{pendingAutoFill && (
  <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
    <span className="text-xs text-yellow-400 font-semibold">
      ⚠️ Esto reemplazará las rondas actuales.
    </span>
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => setPendingAutoFill(false)}
        className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
        style={{ background: "#374151", color: "#94a3b8" }}
      >
        Cancelar
      </button>
      <button
        onClick={autoFillAll}
        className="text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
        style={{ background: "#b45309", color: "#fff" }}
      >
        Reemplazar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Pasar prop `config` desde SetupAmericano**

En `src/components/setup/SetupAmericano.jsx`, en el bloque donde se renderiza `ManualRoundBuilder` (líneas ~319-326), agregar el prop `config`:

```jsx
<ManualRoundBuilder
  players={players}
  courts={t.config.courts}
  rounds={localManualRounds}
  onChange={setLocalManualRounds}
  onBack={() => setShowManualBuilder(false)}
  config={{ useLevels: !!t.config.useLevels, maxRounds: t.config.maxRounds ?? 4 }}
/>
```

- [ ] **Step 6: Verificar build limpio**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 7: Ejecutar todos los tests**

```bash
npm run test
```

Expected: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add src/components/setup/ManualRoundBuilder.jsx src/components/setup/SetupAmericano.jsx
git commit -m "feat: botón Autocompletar todo en ManualRoundBuilder con confirmación inline"
```
