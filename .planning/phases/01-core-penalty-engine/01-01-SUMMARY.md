---
phase: 01-core-penalty-engine
plan: 01
subsystem: logic
tags: [penalty-engine, americano, scheduling, algorithm]
dependency_graph:
  requires: []
  provides:
    - precomputeAllRounds() returns { rounds, warnings }
    - PENALTY and RELAX_THRESHOLDS exported constants
    - scoredSplit(), selectSittingOut(), levelSortedWithShuffle() internal helpers
  affects:
    - src/logic/americano.js
    - src/components/setup/SetupAmericano.jsx
tech_stack:
  added: []
  patterns:
    - Greedy penalty-scored round pre-computation with 4-level threshold relaxation
    - Collapsed-per-round warning emission (one entry per constraint type per round)
    - advancedPairingAllowed pre-check to disable mathematically unsatisfiable constraints
key_files:
  created: []
  modified:
    - src/logic/americano.js
    - src/components/setup/SetupAmericano.jsx
    - src/logic/americano.test.js
decisions:
  - precomputeAllRounds now returns { rounds, warnings } object instead of plain Array
  - roundWarnings is persisted inside the t object (data JSON field), not at Firestore top level
  - RELAX_CONFIGS built after advancedPairingAllowed check to conditionally set ADVANCED_PAIR to 0
  - courtHistory updated per court via cs.forEach with index ci to avoid double-counting
  - Tests T21-T26 updated to use new return shape; new tests T-ret1/T-pairs/T-warn/T-advancedOk/T-courtShape/T-penalty/T-relax added
metrics:
  duration: ~20 minutes
  completed: 2026-06-03
  tasks_completed: 2
  files_modified: 3
---

# Phase 01 Plan 01: Core Penalty Engine Summary

**One-liner:** Penalty-scored precomputation engine using PARTNER_REPEAT/ADVANCED_PAIR/COURT_REPEAT weights with 4-level threshold relaxation returning { rounds, warnings }.

## What Was Built

### Task 1 — PENALTY constants and helper functions (commit: afee84e)

Added to `src/logic/americano.js` above the existing `precomputeAllRounds` export:

- `export const PENALTY` — four keys: PARTNER_REPEAT=1000, ADVANCED_PAIR=5000, COURT_REPEAT=500, REST_IMBALANCE=2000. REST_IMBALANCE is documented as enforced at sitting-out selection only (not inside scoredSplit).
- `export const RELAX_THRESHOLDS` — [2000, 6000, 15000]. Index 0=strict, 1=relax court, 2=relax partner; attempt 3 uses Infinity.
- `function scoredSplit(group, courtIndex, state, weights)` — evaluates 3 pair-split options using PARTNER_REPEAT, ADVANCED_PAIR, and COURT_REPEAT penalties. REST_IMBALANCE is NOT in the formula.
- `function selectSittingOut(entities, courts, soh)` — selects players to sit out by lowest soh count, tiebreak by id ascending (not pts, because pts=0 during pre-computation per D-05).
- `function levelSortedWithShuffle(active)` — groups players by level descending, shuffles within each level group, concatenates.

### Task 2 — Rewritten precomputeAllRounds() and SetupAmericano call site (commit: f36b80a)

**src/logic/americano.js — new precomputeAllRounds() body:**

- Pairs mode early return: `if (isPairs) return { rounds: null, warnings: [] }`
- ALGO-05 impossible-constraint pre-check: `advancedPairingAllowed = advancedCount >= 2 * activeCourts`. When true, ADVANCED_PAIR is set to 0 in all RELAX_CONFIGS and no `advanced_pair` warnings are emitted.
- 4 RELAX_CONFIGS built locally after the pre-check (flags are local per round per D-08):
  - Attempt 0: full PENALTY weights, threshold 2000 (strict)
  - Attempt 1: COURT_REPEAT=0, threshold 6000
  - Attempt 2: COURT_REPEAT=0, PARTNER_REPEAT=100, threshold 15000
  - Attempt 3: all ADVANCED_PAIR=0 too, threshold Infinity (always accept)
- Round loop: selectSittingOut → levelSortedWithShuffle → per-court relaxation attempts → warning emission (collapsed: one entry per constraint type per round) → state update (ph, courtHistory, soh)
- Returns `{ rounds, warnings }`

**src/components/setup/SetupAmericano.jsx — onStart() updated:**

- Old: `const precomputedRounds = ... ? precomputeAllRounds(...) : null`
- New: destructures `result.rounds` into `precomputedRounds` and `result.warnings` into `roundWarnings`
- `roundWarnings` is persisted as a field on the `t` object inside the same `persist()` call — it is NOT a separate Firestore top-level field (per D-10, CLAUDE.md rule about merge:true)

**src/logic/americano.test.js — updated and extended:**

- Tests T21-T26 updated to use `result.rounds` instead of `rounds` (auto-fix: tests tested old return shape)
- Added T-ret1, T-pairs, T-warn, T-advancedOk, T-courtShape (new behavior coverage)
- Added T-penalty, T-relax (constants coverage)
- Total: 75 tests pass across all 3 test files

## Final Return Shape

```js
precomputeAllRounds(entities, config)
// Returns:
{
  rounds: Array<{
    courts: Array<{ pairA: Player[], pairB: Player[], scoreA: "", scoreB: "", saved: false }>,
    sittingOut: Player[]
  }>,
  warnings: Array<{
    round: number,          // 1-based
    constraint: string,     // 'partner_repeat' | 'court_repeat' | 'advanced_pair'
    message: string         // Spanish description
  }>
}
// Pairs mode: { rounds: null, warnings: [] }
```

## How roundWarnings is Persisted

`roundWarnings` is a field on the tournament object `t`, which gets `JSON.stringify`'d into the `data` field of the Firestore document. It does NOT become a separate top-level Firestore field alongside `ownerUid` and `createdAt`.

```js
// SetupAmericano.onStart() — inside persist():
await persist({
  ...t,
  precomputedRounds,  // result.rounds — Array or null
  roundWarnings,      // result.warnings — Array
  // ... other fields
});
// useTournament.js persist() serializes t to data JSON with { merge: true }
```

## Unchanged Functions (Verified)

- `bestSplit(g, ph)` — byte-for-byte identical (line 243 in americano.js, single grep match confirmed)
- `buildFirstRoundAmericano(entities, courts, mode)` — untouched
- `buildRoundAmericano(entities, n, ph, soh, mode)` — untouched
- `highLevelClash(pair)` — untouched
- `matchBalance(pA, pB)` — untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected courtHistory double-update in round state**
- **Found during:** Task 2 implementation
- **Issue:** Initial version used `cs.forEach(court => { ... for (let c = 0; c < activeCourts; c++) { ...cs[c]... } })` which iterated over all courts inside each court's forEach callback, updating courtHistory `activeCourts` times per court instead of once.
- **Fix:** Changed to `cs.forEach((court, ci) => { [...court.pairA, ...court.pairB].forEach(p => courtHistory[\`${p.id}_c${ci}\`] += 1) })` — one update per player per court.
- **Files modified:** src/logic/americano.js
- **Commit:** f36b80a

**2. [Rule 1 - Bug] Updated tests T21-T26 for new return shape**
- **Found during:** Task 2 — tests assert old plain Array return
- **Issue:** Tests T21-T26 called `precomputeAllRounds(...).toHaveLength(N)` treating return as an array. After the return shape change to `{ rounds, warnings }`, these tests would fail.
- **Fix:** Updated T21-T26 to use `result.rounds.toHaveLength(N)`. Added new tests for new behavior (T-ret1, T-pairs, T-warn, T-advancedOk, T-courtShape, T-penalty, T-relax). Also imported PENALTY and RELAX_THRESHOLDS in the test file.
- **Files modified:** src/logic/americano.test.js
- **Commit:** f36b80a

**3. [Non-issue] Plan verification scripts (`node -e "import(...)`) fail due to Vite module resolution**
- The plan's `<verify>` sections use `node -e "import('./src/logic/americano.js')..."` which fails because Node.js ESM requires explicit `.js` extensions but `americano.js` imports from `"./utils"` (no extension — Vite convention). The equivalent verification was done via vitest (which Vite handles correctly): all 75 tests pass.

## Stub Tracking

No stubs detected. All code is wired:
- `precomputeAllRounds()` computes real rounds (not placeholder data)
- `roundWarnings` is wired from algorithm output to persist call
- `precomputedRounds = result.rounds` (not hardcoded null except for pairs mode by design)

## Threat Flags

No new threat surface beyond the plan's threat model. `roundWarnings` is inside the `data` JSON (not a new Firestore top-level field).

## Build Verification

`npm run build` — PASS (2.08s, no errors or warnings related to changed files)

All tests: 75 passed across 3 test files (americano.test.js, pozo.test.js, stats.test.js)

## Self-Check: PASSED

- FOUND: src/logic/americano.js
- FOUND: src/components/setup/SetupAmericano.jsx
- FOUND: .planning/phases/01-core-penalty-engine/01-01-SUMMARY.md
- FOUND commit afee84e (Task 1)
- FOUND commit f36b80a (Task 2)
- PENALTY exported: 1 match
- roundWarnings in SetupAmericano: 3 matches
- scoredSplit NOT exported: 0 export matches (correct)
- bestSplit function: single match confirmed
