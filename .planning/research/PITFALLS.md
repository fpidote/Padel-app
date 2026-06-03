# Pitfalls Research — Penalty-Based Matchmaking Algorithm

**Date:** 2026-06-03
**Confidence:** HIGH — findings from direct code analysis of americano.js + utils.js + first-principles combinatorics

---

## Critical Pitfalls

### 1. Mathematically Impossible Level Constraints

When `advancedCount >= 2 * courts`, Advanced+Advanced pairing is structurally unavoidable — no solver can prevent it. With 4 Advanced players and 2 courts, every possible assignment puts 2 Advanced on each court, and the 3 possible pair-splits always yield at least one Advanced+Advanced.

**Prevention:** Check this invariant at pre-calculation start, before the solver loop begins. Set `advancedPairingAllowed = true` immediately and skip the +5000 constraint entirely.

```js
const advancedPairingAllowed = advancedCount >= 2 * courtsCount;
```

**Phase:** Core penalty engine.

---

### 2. Permutation Explosion if `bestSplit` is Replaced

The current `bestSplit` evaluates exactly 3 pairings per group of 4 — the only 3 unique ways to split 4 players into 2 pairs. A naive rewrite evaluating all possible court assignments faces (N-1)!! combinations: for 24 players that is **316 billion combinations**. Browser freeze guaranteed.

**Prevention:** Level-awareness must be added to the penalty scoring within the existing 3-way evaluation, not by expanding the search space. Benchmark at 24 players (≤200ms on mobile) before merging any engine change.

**Phase:** Core penalty engine.

---

### 3. Partner History Key Collisions

`pk()` uses `_` as separator. Any player ID containing `_` produces ambiguous keys — `pk("a_b", "c")` = `"a_b_c"` = `pk("a", "b_c")`. Currently dormant (numeric IDs), but a future refactor to string IDs will silently corrupt `partnerHistory`. False repeat penalties in round 1 are the diagnostic signal.

**Prevention:** Assert `!String(id).includes('_')` at engine entry, or change separator to `"|"`.

**Phase:** Core penalty engine.

---

### 4. Rest Imbalance Becomes Mathematically Unsolvable

With 9 players / 2 courts / 7 rounds: 1 player rests per round, 7 rests available — 2 players never rest, 7 rest once. The final distribution (1,1,1,1,1,1,1,0,0) is irreducibly unequal. This is not a bug.

**Prevention:** The spec's guarantee must be "minimize rest imbalance" not "enforce equal rest". The +2000 penalty handles this gracefully **only if it is never hardcoded as a hard constraint**. Dangerous configurations: any tournament where `rounds < N` and `rounds mod (N/R) != 0`.

**Phase:** Core penalty engine.

---

### 5. Penalty Weight Miscalibration — Three Failure Modes

**5a. Dominance cliff:** When one penalty is an order of magnitude larger, the smaller penalty is never optimized. Pair=1000 vs Court=500 means court variety is absorbed freely once any partner history exists. This may be intentional — document it as a decision.

**5b. Rest penalty on wrong entity:** Computing rest imbalance as `abs(soh[p] - averageSoh)` instead of raw `soh[p]` introduces order-dependent tiebreaking inconsistency.

**5c. Cumulative vs marginal:** If historical penalties from all previous rounds are summed, early-round violations accumulate weight over time, biasing the schedule to degrade late. Always compute **marginal cost of the current round only**.

**Phase:** Core penalty engine.

---

### 6. Global vs Per-Round Relaxation Scope (Most Likely Bug Source)

If a relaxation flag is set globally when round R deadlocks, all subsequent rounds never re-attempt the strict constraint — even when a valid solution exists. A tournament with 1 forced partner repeat ends up with 6+ repeats because the constraint is never re-tightened.

**Prevention:** Relaxation flags must be **local variables scoped to a single round's computation**, never global state. Re-evaluate from strict for each new round.

**Phase:** Relaxation logic.

---

## Moderate Pitfalls

### 7. History Accumulation Must Stay Synchronous

`precomputeAllRounds` updates `partnerHistory` and `sittingOutHistory` from the previous round's output. Must stay synchronous — never `await` between rounds or history state will be stale.

### 8. `pts=0` During Pre-Calculation Makes Score-Based Sorting Meaningless

All players start at 0 pts, so any sort by score produces arbitrary order during pre-calc. Use `sittingOutHistory` count only for sitting-out selection during pre-calculation; reserve score-based selection for live round advancement.

### 9. `maxRounds` Cap Means Full Coverage Is Never Guaranteed

`maxRounds` caps at `entities.length - 1` (e.g., 12 rounds for 24 players, not 23). Do not imply "every player partners every other player" in documentation or UI copy.

---

## Minor Pitfalls

### 10. Level Threshold Hardcoded

`level >= 3` for Advanced is scattered inline. Move to a named constant `ADVANCED_LEVEL_THRESHOLD` in `constants.js` and validate level values at tournament start.

### 11. Symmetric Test Cases Miss Real Edge Cases

Most test setups use 8 players, 2 Advanced, 2 courts. The configurations that expose bias: 3 Advanced in 8 players, all-Advanced, 9/11/13 players (odd), 24 players. Each test should assert **fairness properties** (max partner repeats, max rest count difference) rather than exact schedules.

### 12. Firestore Document Size with Full Player Objects

Storing full player objects in pre-calculated rounds per court slot adds up. For 24 players × 12 rounds × 4 players per court × object size, this could approach the 1 MB limit.

**Prevention:** Store player IDs only in pre-calculated rounds; resolve full objects at render time via `playersDict` (already done in `FutureRound`). Also prevents stale names if an organizer edits a player after pre-calculation.

---

## Phase-Specific Warning Summary

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Core penalty engine | Permutation explosion if `bestSplit` replaced | Benchmark at 24 players before merging |
| Level constraint enforcement | Impossible when `advancedCount >= 2*courts` | Check invariant before solver loop |
| Partner history tracking | `pk()` key collisions if IDs change format | Assert ID format at engine entry |
| Relaxation logic | Global vs per-round relaxation scope | Scope relaxation flags as local vars |
| Rest selection during pre-calc | `pts=0` makes score-based sort meaningless | Use `soh`-only during pre-calc |
| Penalty weight tuning | Dominance cliff; cumulative vs marginal | Write priority ordering tests first |
| Firestore persist | Document size with full objects | Store IDs only, resolve at render |
| Testing | Symmetric configs miss asymmetric edge cases | Include odd counts and all-Advanced |
