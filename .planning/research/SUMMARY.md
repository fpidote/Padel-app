# Project Research Summary

**Project:** Padeldesk — Americano Clásico Level-Aware Matchmaking Engine
**Domain:** Client-side constraint-based sports scheduling algorithm
**Researched:** 2026-06-03
**Confidence:** HIGH

---

## Executive Summary

This is a targeted algorithm upgrade to an existing, working product. The scaffolding is already in place: `precomputedRounds[]` is stored in Firestore, `precomputeAllRounds()` is exported and called from `SetupAmericano.onStart()`, and `PlayAmericano` already renders future rounds from that array. The gap is exactly two things — the body of `precomputeAllRounds()` (currently a stub) and ~10 lines in `onNext()` that need to read from the pre-computed index rather than calling the on-demand builder.

The correct algorithm is greedy construction with penalty scoring. Brute-force is mathematically impossible at 24 players (96B+ permutations). The greedy approach is O(N²–N³) per round, runs in under 10ms total, and is how real sports scheduling software is built. The existing `bestSplit()` already evaluates the 3 valid pair-splits per group of 4 — level-awareness is added by scoring those same 3 options with penalty weights, not by expanding the search space.

The primary product risk is not technical — it is trust. Organizers and players complain when a pairing looks unfair. Differentiating features (constraint relaxation warnings, level distribution summary, "Emparejamiento calculado" loading moment) are about making algorithm decisions legible. The secondary risk is the impossible-constraint edge case: when `advancedCount >= 2 * courts`, the Advanced+Advanced constraint is structurally impossible and must be detected before the solver loop starts.

---

## Key Findings

### Stack

Build entirely bespoke on existing primitives. No new dependencies.

**Reuse:**
- `pk()` — partner-key generator; assert IDs never contain `_` or change separator to `|`
- `bestSplit()` — 3-way split evaluator; extend with penalty weights, do not replace
- `courtHistory` — new plain-object field (same pattern as `partnerHistory`)
- `PENALTY` constants — new named export: `{ PARTNER_REPEAT:1000, ADVANCED_PAIR:5000, COURT_REPEAT:500, REST_IMBALANCE:2000 }`

**Do NOT use:** Web Workers (overhead > computation time), simulated annealing (overkill), external round-robin libraries (no constraint support), lazy round generation (defeats pre-calculation).

### Features

**Table stakes (must ship):**
- No Advanced+Advanced pairing when satisfiable mathematically
- Partner repeat avoidance with penalty scoring (history exists, scoring engine doesn't)
- Level validation gate: warn if `useLevels=ON` but all players unrated

**Differentiators (low effort, high trust):**
- Constraint relaxation warnings (`warnings[]` from algorithm, admin-only display)
- Level distribution summary at setup ("3 Advanced, 5 Intermediate…") — 3 lines of JSX
- "Emparejamiento calculado" loading state at tournament start

**Defer to v2:** Full rest schedule panel, level balance indicator per court card.

**Anti-features — do not build:** Manual pairing override, penalty weight configuration UI, mid-tournament algorithm rerun.

### Architecture

No new state fields. Three files change; everything else untouched:

| File | Change |
|------|--------|
| `src/logic/americano.js` | New body for `precomputeAllRounds()`; existing signatures stay |
| `src/components/play/PlayAmericano.jsx` | ~10 lines: `onNext()` reads `t.precomputedRounds[t.roundNum]` with fallback |
| `src/components/setup/SetupAmericano.jsx` | try/catch + loading indicator + level validation gate |

Store player IDs only in pre-computed rounds; resolve full objects at render via existing `playersDict`. Max document size ~65KB for 24 players (15% of Firestore 1MB cap).

### Top 5 Pitfalls

1. **Impossible level constraints** — When `advancedCount >= 2 * courts`, Advanced+Advanced pairing is unavoidable. Check this invariant before the solver loop; disable the ADVANCED_PAIR penalty if true.

2. **Permutation explosion** — `bestSplit` evaluates exactly 3 pairings per group of 4. Any rewrite expanding this hits 316B combinations at 24 players. Level-awareness must live inside the existing 3-way evaluation.

3. **Global vs per-round relaxation scope** — Relaxation flags must be local to each round's computation. Setting them globally turns 1 forced repeat into 6+ unnecessary ones.

4. **Cumulative vs marginal penalty** — Sum penalties for the current round only. Summing all historical penalties biases the schedule to degrade in later rounds.

5. **`pk()` key collisions** — `_` separator is ambiguous if IDs ever contain underscores. Assert ID format at engine entry or change separator to `|`.

---

## Roadmap Implications

**3 phases, each independently shippable:**

**Phase 1 — Core Penalty Engine** (`americano.js`)
Everything else gates on this. Level-aware greedy engine, penalty scoring, threshold-based relaxation, `warnings[]` output, `courtHistory` state.

**Phase 2 — PlayAmericano Wire-Up** (~10 lines in `onNext()`)
Null guard makes this backward-compatible. No existing tournament breaks.

**Phase 3 — Setup Validation and UX Polish** (`SetupAmericano`)
Level validation gate, loading state, level distribution summary, relaxation warnings display.

---

## Open Questions

- **Level threshold value** (`p.level >= 3`): Inferred from `highLevelClash`; verify actual integer scale in SetupAmericano before implementing penalty function.
- **Relaxation thresholds** (2000/6000/15000): Starting estimates — declare as named constants, tune empirically after Phase 1 ships.
- **`warnings[]` persistence**: Persist to Firestore or compute in-component gated by `isAdmin`? In-component is simpler and consistent with existing patterns.
- **Level validation gate severity**: Hard-block or soft warning when all players are unrated? Soft is more organizer-friendly.
- **Mobile performance**: Profile at 24 players after Phase 1. If >50ms, wrap in `setTimeout(fn, 0)`.

---

*Research completed: 2026-06-03 | Ready for roadmap: yes*
