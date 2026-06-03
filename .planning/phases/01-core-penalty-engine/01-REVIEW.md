---
phase: 01-core-penalty-engine
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/logic/americano.js
  - src/components/setup/SetupAmericano.jsx
  - src/logic/americano.test.js
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-03  
**Depth:** standard  
**Files Reviewed:** 3  
**Status:** issues_found

---

## Summary

The Core Penalty Engine implementation introduces `scoredSplit`, `selectSittingOut`, `levelSortedWithShuffle`, and a rewritten `precomputeAllRounds` returning `{ rounds, warnings }`. The penalty system and relaxation cascade are structurally sound. Two critical bugs were found: a semantic mismatch between the first live round and precomputed history (making rounds 2+ use stale penalty state), and a spurious `advanced_pair` warning that fires even when the ADVANCED_PAIR weight was already zero at the fallback attempt. Five warnings cover missing error handling, a misleading variable name, a test fragility issue, and two silent-error swallows. Three info items cover organizational and convention gaps.

---

## Critical Issues

### CR-01: Precomputed history ignores actual round-1 pairings — round 2+ penalty state is stale

**File:** `src/components/setup/SetupAmericano.jsx:163-183`

**Issue:** `onStart` builds round 1 via `buildFirstRoundAmericano` (uses `bestSplit`) then calls `precomputeAllRounds` independently. `precomputeAllRounds` builds its own internal round 0 using `scoredSplit` — a different algorithm with different partner-history state — and uses that to populate `ph`/`soh`/`courtHistory` before computing rounds 1, 2, … The live tournament then plays round 1 from `buildFirstRoundAmericano`, and when round 2 is needed it reads `precomputedRounds[1]` (index 1 of the precomputed array). This means:

1. The actual round-1 pairings (from `buildFirstRoundAmericano`) are never fed into the precomputed penalty state.
2. `precomputedRounds[0]` represents a shadow "round 0" that was never played and is silently discarded.
3. Rounds 2+ were optimized against the wrong prior state, so partner-repeat and court-repeat avoidance for round 2 is computed as if round 1 had different pairings than what actually occurred.

The consumer of `precomputedRounds` must account for the index offset — but more importantly, the penalty quality guarantee is broken from round 2 onward.

**Fix:** Either (a) make `precomputeAllRounds` accept the already-built first round as a seed so it updates `ph`/`soh`/`courtHistory` from the real round 1 before computing round 2+, or (b) derive round 1 inside `precomputeAllRounds` and replace `buildFirstRoundAmericano` call in `onStart` with a reference to `precomputedRounds[0]`:

```js
// Option B — in onStart (SetupAmericano.jsx)
const result = precomputeAllRounds(entities, t.config);
precomputedRounds = result.rounds;
roundWarnings = result.warnings;

// Use precomputedRounds[0] as the first live round instead of buildFirstRoundAmericano
const { courts: firstCourts, sittingOut: firstSittingOut } =
  precomputedRounds?.[0] ?? buildFirstRoundAmericano(entities, t.config.courts, t.config.mode);
```

And inside `precomputeAllRounds`, round 0 should use `levelSortedWithShuffle` (already done) — no change needed there. The key change is that `currentRound` and `sittingOut` in the persisted state must come from `precomputedRounds[0]`, not from a separate call.

---

### CR-02: Spurious `advanced_pair` warning fires when ADVANCED_PAIR weight was already 0 at attempt 3

**File:** `src/logic/americano.js:189`

**Issue:** `RELAX_CONFIGS[3]` (the last-resort attempt) always has `ADVANCED_PAIR: 0` regardless of `advancedPairingAllowed`:

```js
// Line 149 — RELAX_CONFIGS[3] — always ADVANCED_PAIR: 0
{
  weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100, ADVANCED_PAIR: 0 },
  threshold: Infinity,
},
```

Yet at line 189, a warning is emitted `advanced_pair` when `attemptUsed >= 3 && !advancedPairingAllowed`. Because `ADVANCED_PAIR` is already 0 at attempt 3, the "advanced pairing constraint was relaxed" message is factually incorrect — the constraint was already zero-weighted and could not have driven relaxation. The warning misleads organizers into thinking the matchmaker was forced to break the advanced-separation rule when it was not.

**Fix:** Only emit the `advanced_pair` warning when the ADVANCED_PAIR weight was active (non-zero) in the attempt that forced acceptance. Since attempts 0-2 use non-zero ADVANCED_PAIR weight (when `!advancedPairingAllowed`), the correct check is `attemptUsed >= 2 && !advancedPairingAllowed` (attempt 2 is when `PARTNER_REPEAT` is reduced — if score still exceeds threshold at attempt 2, the force-accept at attempt 3 means both partner_repeat AND advanced_pair were contributing). But the safest, semantically precise fix is to check `attemptUsed >= 1 && !advancedPairingAllowed` only when attempt 0's threshold was exceeded:

```js
// Line 187-189 — replace the advanced_pair condition
if (attemptUsed >= 1) constraintsRelaxed.add("court_repeat");
if (attemptUsed >= 2) constraintsRelaxed.add("partner_repeat");
// Only warn advanced_pair when the constraint was active AND relaxation was needed before attempt 3
// (attempt 3 already has ADVANCED_PAIR=0, so it cannot be the cause of relaxation for that constraint)
if (attemptUsed >= 1 && !advancedPairingAllowed) constraintsRelaxed.add("advanced_pair");
```

This also aligns the warning trigger with when `COURT_REPEAT` was zeroed (attempt 1), at which point `ADVANCED_PAIR` was still active and thus could have been a contributing factor.

---

## Warnings

### WR-01: `onStart` in SetupAmericano has no try/catch — async error is silently swallowed

**File:** `src/components/setup/SetupAmericano.jsx:156`

**Issue:** `onStart` is an `async function` that calls `await persist(...)`. Per CLAUDE.md section 6, all async functions must have try/catch. A Firestore error during `persist` will result in an unhandled promise rejection, leaving the UI stuck in a broken state (the "Iniciar Torneo" button was clicked but the tournament never actually started, with no user feedback).

**Fix:**
```js
async function onStart() {
  try {
    let entities;
    // ... (existing logic)
    await persist({ ... });
    onExitEdit?.();
  } catch (err) {
    console.error("Error al iniciar torneo:", err);
    alert("No se pudo iniciar el torneo. Intenta de nuevo.");
  }
}
```

---

### WR-02: `advancedPairingAllowed` is semantically inverted — name says "allowed" but means "constraint disabled"

**File:** `src/logic/americano.js:117`

**Issue:** The variable is named `advancedPairingAllowed` but it is set to `true` when advanced pairing is an *unavoidable inevitability* (not when it is allowed by policy). When `advancedPairingAllowed === true`, the `ADVANCED_PAIR` penalty is zeroed out — meaning the constraint is *suppressed*, not *permitted*. All four `RELAX_CONFIGS` entries read this flag, and the condition `if (attemptUsed >= 3 && !advancedPairingAllowed)` inverts it again. A future maintainer reading `advancedPairingAllowed = true` in the configs will reasonably assume it means "this is a normal tournament where advanced pairings are fine" rather than "we had too many advanced players and had to give up on this constraint."

**Fix:** Rename to `advancedConstraintUnsatisfiable` or `skipAdvancedPairPenalty`:

```js
// Line 117
const skipAdvancedPairPenalty = advancedCount >= 2 * activeCourts;

// RELAX_CONFIGS (lines 131, 137, 143, 149)
? { ...PENALTY, ADVANCED_PAIR: 0 }   // when skipAdvancedPairPenalty
// etc.

// Line 189
if (attemptUsed >= 3 && !skipAdvancedPairPenalty) constraintsRelaxed.add("advanced_pair");
```

---

### WR-03: Test T11 is fragile — asserts position within `[...pairA, ...pairB]` but `bestSplit` may assign either team as pairA

**File:** `src/logic/americano.test.js:179-192`

**Issue:** T11 checks that player 1 (higher goal-diff) appears at a lower index than player 2 in `[...pairA, ...pairB]`. This depends on `bestSplit` assigning the two players to the first pair (`pairA`) and preserving internal order. `bestSplit` in `americano.js` assigns `best = [pA, pB]` based on whichever option `[group[0], group[1]]` / `[group[0], group[2]]` / `[group[0], group[3]]` wins — there is no guarantee that player 1 lands in `pairA` rather than `pairB`. If `bestSplit` picks the split where player 1 is in `pairB[0]` and player 2 is in `pairA[0]`, the concatenation `[...pairA, ...pairB]` puts player 2 first, failing the assertion. The test is validating sort order but the right observable is which players ended up in the top court, not their intra-group position.

**Fix:** Assert that players 1 and 2 are both in courts[0] (the only court), rather than asserting their relative index within the concatenated pair arrays:

```js
test("T11: cuando pts son iguales, el de mayor gf-gc queda en cancha (ambos top-2 juegan)", () => {
  const players = [ p(1, 0, 2, 5, 2), p(2, 0, 2, 3, 3), p(3, 0, 0), p(4, 0, 0) ];
  const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");
  const ids = [...courts[0].pairA, ...courts[0].pairB].map((x) => x.id);
  // After pts-desc sort, pts-tiebreak-by-gf-gc: 1 and 2 rank above 3 and 4
  expect(ids).toContain(1);
  expect(ids).toContain(2);
});
```

---

### WR-04: Two empty catch blocks in `handleShare` silently swallow all errors

**File:** `src/components/setup/SetupAmericano.jsx:213-221`

**Issue:** `handleShare` has two `catch (_) {}` blocks — both `navigator.share` and `navigator.clipboard.writeText` failures are completely silenced. If clipboard access is denied (e.g., non-secure context, permissions), the user gets no feedback that sharing failed. Per CLAUDE.md section 6, all async operations should have error handling that communicates to the user.

**Fix:**
```js
async function handleShare() {
  const msg = buildShareMessage(t, code);
  if (navigator.share) {
    try {
      await navigator.share({ title: t.config.name, text: msg });
    } catch (_) {
      // User cancelled share dialog — no feedback needed
    }
  } else {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
      // Fallback: show the code so the user can copy manually
      alert(`Código del torneo: ${code}`);
    }
  }
}
```

---

### WR-05: `selectSittingOut` does not guard against `cnt > entities.length` — could produce an empty `active` array

**File:** `src/logic/americano.js:71-84`

**Issue:** `cnt = entities.length - activeCourts * 4`. `activeCourts = Math.min(courts, Math.floor(entities.length / 4))`. By construction `activeCourts * 4 <= entities.length`, so `cnt >= 0`. The guard at line 74 handles `cnt <= 0`. However, if `entities` is an empty array (0 players), `activeCourts = 0`, `cnt = 0`, and the function returns `{ active: [], sittingOut: [] }`. The caller at line 156 then passes `active = []` to `levelSortedWithShuffle`, which returns `[]`. The loop at line 167 iterates `c = 0..<0` (no iterations) and `cs = []`. The round is pushed as `{ courts: [], sittingOut: [] }` — a structurally valid but useless round.

While `precomputeAllRounds` does gate on `ok` in `SetupAmericano`, the logic function itself has no early-exit guard for `entities.length < 4`. If called directly (e.g., in a test or a future code path), it silently produces ghost rounds.

**Fix:** Add a guard at the top of `precomputeAllRounds`:
```js
if (entities.length < 4) return { rounds: [], warnings: [] };
```

---

## Info

### IN-01: `highLevelClash` and `matchBalance` defined after first use — out-of-order declarations

**File:** `src/logic/americano.js:233-241`

**Issue:** `highLevelClash` is used at lines 46-47 inside `scoredSplit`, and `matchBalance` at line 262 inside `bestSplit`, but both are declared at lines 233 and 237 respectively — after all the exported functions that call them. JavaScript hoists `function` declarations so this is not a runtime error, but it violates the conventional top-down readability order and will cause confusion for any linter that enforces declaration order (e.g., `no-use-before-define`).

**Fix:** Move `highLevelClash` and `matchBalance` to before `scoredSplit` (before line 23).

---

### IN-02: `matchBalance` is dead code from the perspective of `precomputeAllRounds`

**File:** `src/logic/americano.js:237-241`

**Issue:** The new penalty engine (`scoredSplit`) does not include a term for team-level balance (the sum of levels of pairA vs pairB). `matchBalance` is only used in the legacy `bestSplit` function. This means `precomputeAllRounds` can produce rounds where a level-4 player and a level-3 player face a level-1 + level-0 pair without penalty, whereas `buildRoundAmericano` (used for Mexicano/runtime generation) would penalize that imbalance. The inconsistency is not surfaced anywhere in comments or warnings.

**Fix (Info — no code change strictly required):** Either add a `MATCH_BALANCE` penalty term to `scoredSplit` for consistency, or add a comment to `scoredSplit` explicitly noting the omission was intentional:
```js
// NOTE: matchBalance (team level-sum difference) is intentionally not penalized here.
// The top/bottom-half grouping via levelSortedWithShuffle already provides structural
// balance — applying an additional balance term would conflict with the partner-repeat
// avoidance objective. See PATTERNS.md §3.
```

---

### IN-03: `console.log` prohibition not enforced — no debug artifacts found, but `persist` calls in `onStart` are fire-and-forget beyond the `await`

**File:** `src/components/setup/SetupAmericano.jsx:156-185`

**Issue:** All debounced `persist` calls in the handler functions (e.g., `handleName`, `handleDesc`, `handleRoundsCustom`) are not awaited and have no error handling. While debounced writes to Firestore intentionally omit await for UX fluency (per CLAUDE.md section 8), a Firestore quota or permission error on these calls would silently fail. This is a known trade-off, not a new regression, but the absence of any error logging means production errors on config saves are invisible.

**Fix (Info — consistent with existing patterns):** At minimum, chain a `.catch` on the debounced persist calls to surface errors in the console:
```js
debName.current = setTimeout(() =>
  persist({ ...t, config: { ...t.config, name: val } }).catch(err =>
    console.error("Error al guardar nombre:", err)
  ), 600);
```

---

_Reviewed: 2026-06-03_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
