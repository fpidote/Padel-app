---
phase: 02-playamericano-wire-up
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/play/PlayAmericano.jsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `PlayAmericano.jsx` — the main play component for the Americano tournament format. The file is 917 lines and contains the primary state machine for scoring, round progression, standings, and history display.

Three critical issues were found: all three async mutation functions (`onSave`, `onEdit`, `onNext`) are missing try/catch, which is an explicit violation of the mandatory CLAUDE.md engineering rule. Any Firestore failure in these paths will produce an unhandled promise rejection that silently corrupts UI state. One additional critical bug is a player-filter type mismatch that will silently produce empty results for the search feature in some data configurations.

Four warnings were also found including a dead `modalMsg` state that indicates incomplete feature wiring, a debounced persist with no error handling, and a forbidden import of the legacy `B()` utility.

---

## Critical Issues

### CR-01: `onSave` missing try/catch — unhandled Firestore failure

**File:** `src/components/play/PlayAmericano.jsx:39-60`
**Issue:** `onSave` is an `async` function that calls `await persist(...)` on line 59 with no try/catch block. If Firestore throws (network offline, permission denied, quota exceeded), the error is swallowed as an unhandled promise rejection. The UI will show no feedback to the admin, and the local state (`ls`) will already have been cleared at line 53-58 — making the entered score unrecoverable without a page reload. This is a direct violation of the CLAUDE.md rule: "Siempre usar try/catch en operaciones async. Nunca dejar Promesas sin manejar."

**Fix:**
```js
async function onSave(ci, isCancel = false) {
  const court = t.currentRound[ci];
  const a = parseInt(isCancel ? court.scoreA : (ls[`${ci}_A`] ?? court.scoreA));
  const b = parseInt(isCancel ? court.scoreB : (ls[`${ci}_B`] ?? court.scoreB));
  if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
  const cr = t.currentRound.map((c, i) =>
    i === ci ? { ...c, scoreA: String(a), scoreB: String(b), saved: true } : c,
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
    // Revert local score state so the admin can retry
    setLs((prev) => ({ ...prev, [`${ci}_A`]: String(a), [`${ci}_B`]: String(b) }));
  }
}
```

---

### CR-02: `onEdit` missing try/catch — unhandled Firestore failure

**File:** `src/components/play/PlayAmericano.jsx:62-73`
**Issue:** `onEdit` calls `await persist(...)` on line 72 with no try/catch. A Firestore failure here will leave the court in an inconsistent state: `ls` has been updated with the current scores (line 64-68) but the Firestore document still shows `saved: true`. On the next Firestore snapshot, the remote state will overwrite local state, restoring `saved: true`, while the user sees an edit-mode input — a confusing split-brain state.

**Fix:**
```js
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
    // Revert ls so the court does not appear unlocked
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
  }
}
```

---

### CR-03: `onNext` missing try/catch — round advance silently fails, corrupts round state

**File:** `src/components/play/PlayAmericano.jsx:75-143`
**Issue:** `onNext` is the most critical async handler in the component. It computes the next round, calls `await persist(...)` on line 133, and has no try/catch. If the persist fails, `setLs({})` (line 132) has already been called — clearing all local score state. The tournament document in Firestore is not updated, but the local React state has been discarded. On the next snapshot, old remote state is re-applied, but the admin sees a cleared `ls` with no pending inputs, creating a confusing half-advanced state. Direct violation of CLAUDE.md.

**Fix:**
```js
async function onNext() {
  if (!t.currentRound.every((c) => c.saved)) return;
  // ... (all existing computation stays the same) ...
  const nextState = {
    ...t,
    [entityKey]: np,
    rounds: newRounds,
    currentRound: nc,
    sittingOut: nSit,
    partnerHistory: nh,
    sitOutHistory: nso,
    roundNum: t.roundNum + 1,
  };
  setLs({});
  try {
    await persist(nextState);
  } catch (err) {
    console.error("Error al avanzar ronda:", err);
    // setLs({}) already fired — no easy rollback, but at least surface the error
  }
}
```

---

## Warnings

### WR-01: Player search filter type mismatch — silently returns no results

**File:** `src/components/play/PlayAmericano.jsx:204`
**Issue:** The `onChange` handler for the player filter select converts the option value to a number: `setSearch(e.target.value === "" ? null : Number(e.target.value))`. The `matchesSearch` function at line 166 does `ids.includes(search)`, where `ids` is built from `court.pairA?.id` etc. If any player or pair has a string ID (e.g., from an older tournament document version, or if IDs are ever generated as strings), `Number("abc")` → `NaN`, and `ids.includes(NaN)` is always `false`. This would silently show zero courts with no error. Additionally, `allPlayers` at line 158-160 maps IDs directly as `{ id: p.id }` — if IDs are already numbers, the coercion is harmless, but the `value={p.id}` on the option element at line 209 will be stringified in the DOM. The `Number(e.target.value)` coercion is fragile and only correct by coincidence.

**Fix:** Normalize the comparison by converting both sides to the same type, or store the raw value and compare using `==` (loose equality) rather than `includes` with strict equality semantics:
```js
onChange={(e) => setSearch(e.target.value === "" ? null : e.target.value)}
// then in matchesSearch:
return ids.map(String).includes(String(search));
```

---

### WR-02: `handleNameChange` debounced `persist` call has no error handling

**File:** `src/components/play/PlayAmericano.jsx:448-470`
**Issue:** Inside the `setTimeout` callback (800ms debounce), `persist(...)` is called without `await` and without try/catch. The function is not declared `async`, so the returned promise is silently dropped. A Firestore failure during an inline name edit will produce no feedback to the admin — the name will appear to have changed in the UI (via snapshot reapplication) but actually failed to save.

**Fix:**
```js
debName.current = setTimeout(async () => {
  try {
    if (type === "player") {
      // ... existing logic ...
      await persist({ ...t, players: updatedPlayers, currentRound: updatedRound });
    } else {
      // ... existing logic ...
      await persist({ ...t, pairs: updatedPairs, currentRound: updatedRound });
    }
  } catch (err) {
    console.error("Error al guardar nombre:", err);
  }
}, 800);
```

---

### WR-03: `modalMsg` state is declared but `setModalMsg` is never called

**File:** `src/components/play/PlayAmericano.jsx:36`
**Issue:** `const [modalMsg, setModalMsg] = useState(null)` is declared on line 36 and the `<SimpleModal>` is conditionally rendered at line 420 based on it, but `setModalMsg(...)` is never called anywhere in the file. The modal feature is entirely disconnected — it can never be shown. This is dead state that indicates either incomplete wiring or a leftover from a refactor. At minimum this is misleading to anyone reading the code, and more likely the modal was intended to surface errors from the async handlers (which currently have no error reporting at all — see CR-01/02/03).

**Fix:** Either wire `setModalMsg` into the error catch blocks (e.g., `setModalMsg("Error al guardar resultado. Intenta de nuevo.")`) or remove the state and `SimpleModal` render until it is needed.

---

### WR-04: Import of legacy `B()` function violates CLAUDE.md

**File:** `src/components/play/PlayAmericano.jsx:2`
**Issue:** Line 2 imports `{ B }` from `../../logic/constants`. CLAUDE.md Section 6 ("Lo que NO hacer") explicitly states: "La función `B()` de `constants.js` es legado — no usarla en componentes nuevos, usar Tailwind." `B()` is used in `Components.jsx` (the `THeader` component) but is imported directly in `PlayAmericano.jsx` — though scanning the rendered JSX of `PlayAmericano.jsx` itself reveals the `B()` call is not present in the file's own JSX. The import is therefore unused in `PlayAmericano.jsx` directly.

**Fix:** Remove the unused `B` from the import on line 2:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
// Remove: import { B } from "../../logic/constants"; (already on line 7)
```
Also consolidate the two separate imports from `../../logic/constants` (lines 2 and 7) into one:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```

---

## Info

### IN-01: `onSave` `isCancel` parameter is dead code

**File:** `src/components/play/PlayAmericano.jsx:39`
**Issue:** `onSave(ci, isCancel = false)` accepts an `isCancel` parameter that branches the score source at lines 41-45. However, `onSave` is only ever called as `onSave(ci)` (line 628) — never with `isCancel = true`. The cancel branch is unreachable dead code.

**Fix:** Either remove the `isCancel` parameter and the conditional lines 41-45, or implement the cancel-edit flow that was presumably intended. If the intent was to revert an in-progress edit back to the previously saved score, that logic belongs in `onEdit` (or a new `onCancelEdit` handler) and should be wired to a cancel button.

---

### IN-02: Duplicate import from `../../logic/constants`

**File:** `src/components/play/PlayAmericano.jsx:2,7`
**Issue:** `../../logic/constants` is imported twice — once on line 2 (`import { B }`) and once on line 7 (`import { TOURNAMENT_RULES }`). These should be a single import statement.

**Fix:**
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```
(Remove the line 2 import of `B` entirely — see WR-04.)

---

### IN-03: Extensive use of inline styles violates project conventions

**File:** `src/components/play/PlayAmericano.jsx` — multiple locations
**Issue:** CLAUDE.md Section 7 states: "Sin estilos inline excepto colores dinámicos de formatos." The file contains dozens of `style={{...}}` blocks on non-dynamic elements throughout `HistoryRound`, `StandingsAmericano`, the rules tab, and many button elements. This is acknowledged as existing technical debt in CLAUDE.md Section 11 ("Componentes de Play y Setup aún usan la función `B()` y estilos inline — migrar a Tailwind progresivamente"), so this is not a new violation. Do not introduce additional inline styles in future changes to this file.

**Fix:** Migrate to Tailwind utility classes progressively per the existing deuda técnica plan. New additions to this file should use Tailwind only.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
