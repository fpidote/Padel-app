---
phase: 02-playamericano-wire-up
plan: 01
subsystem: frontend
tags: [playamericano, precomputedRounds, descansos-tab, warnings-banner, wire-up]
dependency_graph:
  requires:
    - 01-01 (precomputeAllRounds returns { rounds, warnings }; roundWarnings persisted inside t)
  provides:
    - PlayAmericano consume precomputedRounds para avanzar rondas sin llamar buildRoundAmericano()
    - Tab "Descansos" con horario de descansos por ronda
    - WarningsBanner colapsable para admin cuando hay restricciones relajadas
  affects:
    - src/components/play/PlayAmericano.jsx
tech_stack:
  added: []
  patterns:
    - Condicional spread en array de tabs para tab opcional (precomputedRounds guard)
    - Sub-componente a file scope con useState propio (WarningsBanner sigue patrón de FutureRound)
    - Spread defensivo ({ ...c, scoreA: "", scoreB: "", saved: false }) al avanzar ronda pre-calculada
key_files:
  created: []
  modified:
    - src/components/play/PlayAmericano.jsx
decisions:
  - "onNext() lee t.precomputedRounds[t.roundNum] (próxima ronda, índice 0-based) antes de llamar buildRoundAmericano()"
  - "isFinished extendido con || (t.precomputedRounds?.length && t.roundNum > t.precomputedRounds.length) usando > no >= "
  - "WarningsBanner colocado sobre <Tabs> (no dentro del tab courts) para visibilidad permanente sin importar tab activo"
  - "WarningsBanner definido a file scope como sub-componente para cumplir reglas de hooks de React"
metrics:
  duration: ~2 minutes
  completed: 2026-06-03
  tasks_completed: 2
  files_modified: 1
---

# Phase 02 Plan 01: PlayAmericano Wire-Up Summary

**One-liner:** PlayAmericano conectado a t.precomputedRounds para avanzar rondas pre-calculadas, con tab Descansos y banner de advertencias colapsable para admin.

## What Was Built

### Task 1 — onNext() wire-up e isFinished extension (commit: 4eb5d3f)

Dos ediciones quirúrgicas en `src/components/play/PlayAmericano.jsx`:

**Edición 1 — Reemplazo de línea 114 (buildRoundAmericano → precomputedRounds):**

Reemplazó la llamada directa a `buildRoundAmericano()` con un bloque if/else:
- **Ruta pre-calculada:** cuando `t.precomputedRounds?.length && t.precomputedRounds[t.roundNum]` es truthy, lee `t.precomputedRounds[t.roundNum]` (índice 0-based = siguiente ronda cuando roundNum es 1-based) y reinicializa scores defensivamente vía spread.
- **Fallback legacy:** cuando precomputedRounds es null/undefined/vacío, llama `buildRoundAmericano()` sin cambios.
- El código antes (líneas 76–113: score tally, nh, nso) y después (líneas 121–135: persist call) permanece byte-for-byte igual (D-08).

**Edición 2 — Extensión de isFinished (línea 144):**

```js
const isFinished = !!(
  (t.config.maxRounds && t.roundNum >= t.config.maxRounds)
  || (t.precomputedRounds?.length && t.roundNum > t.precomputedRounds.length)
);
```

Usa `>` no `>=`: cuando roundNum === length, la última ronda aún está siendo jugada. El `>` se dispara solo cuando roundNum === length + 1 (post-advance).

### Task 2 — Tab Descansos y WarningsBanner (commit: 1357711)

Tres adiciones en `src/components/play/PlayAmericano.jsx`:

**WarningsBanner (usage site):** Insertado dentro del `<div style={{ padding: 16 }}>` wrapper, ANTES del `<Tabs>` call. Condición: `isAdmin && t.roundWarnings?.length > 0`. Garantiza visibilidad independiente del tab activo.

**Tabs array — 5to tab condicional:**
```jsx
...(t.precomputedRounds?.length ? [["descansos", "💤 Descansos"]] : []),
```
Torneos legacy (sin precomputedRounds) nunca ven el tab Descansos.

**Bloque Descansos (después de `{tab === "rules" && ...}`):**
- Itera `t.precomputedRounds.map((round, i) => ...)` con `rNum = i + 1`, `isCurrent = rNum === t.roundNum`
- Fila actual: `bg-yellow-400/10 border border-yellow-400/20`, texto `text-yellow-400` / `text-yellow-200`, marcador `" ●"`
- Filas normales: `bg-[#1f2937] border border-gray-700`, texto `text-gray-500` / `text-gray-400`
- `sittingOut` vacío muestra "Nadie descansa" (D-04)
- Visible para todos (admin + espectadores) — D-03

**function WarningsBanner({ warnings }):** Definido a file scope después de FutureRound (línea 826). Tiene su propio `const [open, setOpen] = useState(false)` — no usa estado del componente padre. Muestra `w.message` (ya en español desde Phase 1) en filas amber colapsables.

## Verification Results

```
grep precomputedRounds[t.roundNum]: 2 matches (líneas 115, 116) ✓
grep roundNum > t.precomputedRounds.length: 1 match (línea 153) ✓
grep buildRoundAmericano: 2 matches (import + fallback legacy) ✓
grep "descansos": 2 matches (tabs array + tab block) ✓
grep function WarningsBanner: 1 match (file scope) ✓
grep isAdmin && t.roundWarnings: 1 match (sobre Tabs) ✓
grep Nadie descansa: 1 match (bloque descansos) ✓
npm run build: PASS (1.88s, sin errores) ✓
npx vitest run: 82/82 tests pass ✓
```

## Deviations from Plan

None — plan ejecutado exactamente como escrito.

## Known Stubs

Ninguno. Toda la lógica está conectada:
- `t.precomputedRounds` se lee del estado Firebase (persistido por SetupAmericano Phase 1)
- `t.roundWarnings` se lee del mismo estado Firebase
- `t.roundNum` es el índice real de ronda actual

## Threat Flags

Sin nueva superficie de amenaza más allá del modelo de amenazas del plan. `isAdmin` sigue siendo `auth.currentUser.uid === t.ownerUid` (Firebase Auth puro, sin localStorage).

## Self-Check: PASSED

- FOUND: src/components/play/PlayAmericano.jsx
- FOUND: .planning/phases/02-playamericano-wire-up/02-01-SUMMARY.md
- FOUND commit 4eb5d3f (Task 1: onNext wire-up + isFinished)
- FOUND commit 1357711 (Task 2: Descansos tab + WarningsBanner)
- precomputedRounds[t.roundNum]: 2 matches (if guard + const assignment)
- WarningsBanner: 2 matches (usage site + function definition)
- "descansos": 2 matches (tabs array + tab block)
- npm run build: PASS
- 82/82 tests pass
