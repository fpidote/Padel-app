---
phase: 02-playamericano-wire-up
fixed_at: 2026-06-03T00:00:00Z
review_path: .planning/phases/02-playamericano-wire-up/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-06-03
**Source review:** .planning/phases/02-playamericano-wire-up/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical + 4 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `onSave` missing try/catch — unhandled Firestore failure

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 29467d6
**Applied fix:** Wrapped `await persist(...)` in try/catch. On failure, `console.error` logs the error, `setModalMsg` shows a user-facing message, and `setLs` reverts the cleared score entries so the admin can retry without losing the entered values.

---

### CR-02: `onEdit` missing try/catch — unhandled Firestore failure

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 29467d6
**Applied fix:** Wrapped `await persist(...)` in try/catch. On failure, `console.error` logs the error, `setModalMsg` shows a user-facing message, and `setLs` deletes the optimistically-set edit-mode keys so the court does not appear unlocked without a backing persist.

---

### CR-03: `onNext` missing try/catch — round advance silently fails

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 29467d6
**Applied fix:** Wrapped `await persist(...)` in try/catch. On failure, `console.error` logs the error and `setModalMsg` shows a user-facing message. `setLs({})` fires before the try block (matching the original code); a full rollback of all computed round state is not attempted as noted in the review — at minimum the error is now surfaced to the admin.

---

### WR-01: Player search filter type mismatch — silently returns no results

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 75465a2
**Applied fix:** Removed `Number(e.target.value)` coercion in both filter `<select>` `onChange` handlers (courts tab and history tab) — now stores the raw string value. Updated `matchesSearch` to compare using `ids.map(String).includes(String(search))` so both sides are normalized to string regardless of the underlying ID type. Both occurrences of the broken `onChange` were fixed.

---

### WR-02: `handleNameChange` debounced `persist` call has no error handling

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 85cb776
**Applied fix:** Changed the `setTimeout` callback to `async () => { ... }`, added `await` before both `persist(...)` calls, and wrapped the body in try/catch with `console.error("Error al guardar nombre:", err)`.

---

### WR-03: `modalMsg` state is declared but `setModalMsg` is never called

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 03ec463
**Applied fix:** Wired `setModalMsg` into the catch blocks of `onSave`, `onEdit`, and `onNext` with descriptive Spanish-language messages. The `<SimpleModal>` render at line 444 was already connected to `modalMsg` — the modal is now fully functional and will surface Firestore errors to the admin.

---

### WR-04: Import of legacy `B()` function violates CLAUDE.md (+ IN-02: duplicate import)

**Files modified:** `src/components/play/PlayAmericano.jsx`
**Commit:** 3b7dc8a
**Applied fix:** Removed the `import { B } from "../../logic/constants"` line (line 2). The existing `import { TOURNAMENT_RULES } from "../../logic/constants"` (line 7) was moved to line 2, eliminating both the forbidden import and the duplicate import in a single edit. Confirmed `B()` has zero usages in the file.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
