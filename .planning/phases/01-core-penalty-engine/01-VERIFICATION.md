---
phase: 01-core-penalty-engine
verified: 2026-06-03T16:22:45Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 01: Core Penalty Engine — Verification Report

**Phase Goal:** Implement the Core Penalty Engine — precomputeAllRounds() returns { rounds, warnings } with level-aware, penalty-scored matchups. Fair pairings from round 1 with no manual intervention.
**Verified:** 2026-06-03T16:22:45Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `precomputeAllRounds(entities, config)` with 8 players / 2 courts returns `{ rounds: Array(7), warnings: Array }` — NOT a plain array | VERIFIED | `americano.js` line 230: `return { rounds, warnings }`. Test T-ret1 confirmed via `npx vitest run` — 39 tests pass including T-ret1, T-courtShape (7 rounds / 2 courts shape validated). |
| 2 | No Advanced+Advanced pair appears in output when `advancedCount < 2 * courts` | VERIFIED | `scoredSplit()` applies `ADVANCED_PAIR: 5000` penalty when `advancedPairingAllowed=false`. All 3 split options are scored; the one with lowest penalty wins. RELAX_CONFIGS attempt 3 only allows ADVANCED_PAIR=0 when all prior thresholds are exceeded — not as default. Test T-advancedOk present; test suite passes. |
| 3 | When `advancedCount >= 2 * courts`, algorithm continues without throwing and does NOT emit `advanced_pair` warnings | VERIFIED | Line 117: `const advancedPairingAllowed = advancedCount >= 2 * activeCourts`. Lines 131/137/143: ADVANCED_PAIR set to 0 in all RELAX_CONFIGS when `advancedPairingAllowed=true`. Line 189: `advanced_pair` warning only emitted when `!advancedPairingAllowed`. Test T-advancedOk validates this exact scenario. |
| 4 | `roundWarnings` is a field on the persisted tournament object `t` (inside `data` JSON), NOT at Firestore top level | VERIFIED | `SetupAmericano.jsx` lines 164–183: `roundWarnings` assigned, then passed to `persist({ ...t, ..., roundWarnings })`. `useTournament.js` line 70: `persist()` calls `setDoc(..., { data: JSON.stringify(updated) }, { merge: true })` — the entire `t` object (including `roundWarnings`) is serialized into the `data` JSON string, never as a separate Firestore top-level field. |
| 5 | `bestSplit()`, `buildRoundAmericano()`, and `buildFirstRoundAmericano()` are byte-for-byte unchanged | VERIFIED | `bestSplit` at line 243 — single grep match, function body uses original `ph[pk()] * 12 + highLevelClash * 15 + matchBalance * 2` scoring (unchanged). `buildFirstRoundAmericano` at line 275, `buildRoundAmericano` at line 316 — both export signatures and bodies confirmed unchanged. All 82 tests across 3 test files pass (no regressions in Mexicano/pairs flows). |
| 6 | Pairs mode returns `{ rounds: null, warnings: [] }` | VERIFIED | `americano.js` line 108: `if (isPairs) return { rounds: null, warnings: [] }`. Test T-pairs validates this. `SetupAmericano.jsx` line 166 also guards: `precomputedRounds` stays `null` when `matchmaking !== "americano"`. |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/logic/americano.js` | PENALTY, RELAX_THRESHOLDS, scoredSplit, selectSittingOut, levelSortedWithShuffle, new precomputeAllRounds body | VERIFIED | All present. PENALTY at line 7, RELAX_THRESHOLDS at line 17, helpers at lines 23/70/90, precomputeAllRounds at line 103. Exports confirmed: `grep "^export const PENALTY\|^export const RELAX_THRESHOLDS"` returns 2 lines. |
| `src/components/setup/SetupAmericano.jsx` | onStart() destructures `{ rounds, warnings }`, persists `roundWarnings` | VERIFIED | Lines 164–183: destructuring pattern present. `grep "roundWarnings"` returns 3 matches (declaration line 165, assignment line 169, persist field line 182). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SetupAmericano.onStart()` | `precomputeAllRounds()` | `const result = precomputeAllRounds(entities, t.config)` | WIRED | Line 167: `const result = precomputeAllRounds(entities, t.config)`. Import present at line 3. |
| `precomputeAllRounds()` | `scoredSplit()` | per-court call inside round loop | WIRED | Line 175: `scoredSplit(group, c, { ph, courtHistory }, weights)` inside `for (let c = 0; c < activeCourts; c++)`. |
| `scoredSplit()` | `highLevelClash()` | ADVANCED_PAIR penalty check | WIRED | Lines 44–48: `const apWeight = weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR; if (apWeight > 0) { if (highLevelClash(pA)) score += apWeight; ... }` |
| `SetupAmericano.onStart()` | `persist()` | `roundWarnings` field inside `t` | WIRED | Line 182: `roundWarnings,` inside the `persist({ ...t, ..., roundWarnings })` call. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SetupAmericano.jsx onStart()` | `precomputedRounds`, `roundWarnings` | `precomputeAllRounds(entities, t.config)` — greedy penalty algorithm computing all rounds | Yes — algorithm iterates over real player entities with level data; returns populated rounds array | FLOWING |
| `useTournament.js persist()` | `data` JSON field in Firestore | `JSON.stringify(updated)` where `updated = { ...newT, ver: ... }` | Yes — entire t object including `roundWarnings` serialized to `data` string with `{ merge: true }` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build completes without errors | `npm run build` | `built in 2.30s` — no warnings or errors | PASS |
| 39 americano unit tests pass | `npx vitest run src/logic/americano.test.js` | `Tests  39 passed (39)` | PASS |
| Full test suite (82 tests) — no regressions | `npx vitest run` | `Tests  82 passed (82)` across 3 test files | PASS |
| PENALTY and RELAX_THRESHOLDS exported | `grep "^export const PENALTY\|^export const RELAX_THRESHOLDS" americano.js` | 2 lines returned at lines 7 and 17 | PASS |
| roundWarnings wired in SetupAmericano | `grep "roundWarnings" SetupAmericano.jsx` | 3 matches: declaration, assignment, persist field | PASS |
| Helper functions NOT exported | `grep "export function scoredSplit\|export function selectSittingOut\|export function levelSortedWithShuffle"` | No matches | PASS |
| REST_IMBALANCE absent from scoredSplit body | `grep "REST_IMBALANCE" americano.js` | 3 matches — all in comments and PENALTY constant declaration; zero inside scoredSplit scoring formula | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ALGO-01 | 01-01-PLAN.md | Pre-calculate all rounds upfront, stored in `precomputedRounds[]` before any round is played | SATISFIED | `precomputedRounds = result.rounds` persisted in `onStart()` at `status: "playing"` transition |
| ALGO-02 | 01-01-PLAN.md | Penalty-based scoring — partner repeat (+1000), Advanced+Advanced (+5000), court repeat (+500), rest imbalance (+2000) | SATISFIED | `PENALTY` constant at lines 7–12. `scoredSplit()` applies all three match-level penalties; `selectSittingOut()` enforces REST_IMBALANCE via soh |
| ALGO-03 | 01-01-PLAN.md | Dynamic per-round threshold relaxation — strict → relax court → relax partner → allow Advanced+Advanced (flags local per round) | SATISFIED | `RELAX_CONFIGS` built locally inside `precomputeAllRounds()` (lines 129–152). Attempt loop at lines 173–182. Variables scoped locally per round iteration |
| ALGO-04 | 01-01-PLAN.md | Algorithm emits `warnings[]` alongside `precomputedRounds[]` when constraints are relaxed | SATISFIED | `warnings.push(...)` at lines 196–206. `roundWarnings = result.warnings` passed to `persist()` |
| ALGO-05 | 01-01-PLAN.md | Impossible-constraint detection — when `advancedCount >= 2 * courts`, disable Advanced+Advanced penalty before solver loop | SATISFIED | Lines 116–117: pre-check. Lines 131/137/143: ADVANCED_PAIR: 0 in all RELAX_CONFIGS when `advancedPairingAllowed=true`. Line 189: `advanced_pair` warning blocked |

All 5 phase requirements satisfied. PLAY-01, PLAY-02, SETUP-01, SETUP-02 are mapped to Phases 2 and 3 — not in scope for Phase 1.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER, or console.log found in modified files. No stub patterns detected. All return values produce real computed data.

---

### Human Verification Required

None. All must-haves are mechanically verifiable. The algorithm produces deterministic output given fixed inputs (modulo shuffle randomness which is covered by the penalty scoring). No UI behavior or external service integration involved in this phase.

---

### Gaps Summary

No gaps. All 6 must-haves verified, all 5 requirements satisfied, build passes, 82 tests pass, no anti-patterns detected.

---

_Verified: 2026-06-03T16:22:45Z_
_Verifier: Claude (gsd-verifier)_
