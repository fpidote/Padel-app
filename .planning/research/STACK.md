# Technology Stack — Americano Level-Aware Matchmaking Engine

**Date:** 2026-06-03
**Scope:** Client-side JavaScript algorithm design for constraint-based round-robin scheduling

---

## Key Finding

**Greedy construction with penalty scoring is the correct and only tractable approach.** Brute-force permutation enumeration is impossible at 24 players (96 billion+ partitions). Performance is not a real concern — the computation takes <10ms. No Web Worker or external library is needed.

---

## 1. Algorithmic Approach

**Recommendation: Greedy construction with penalty scoring and bounded candidate evaluation.**

For 24 players on 6 courts, the number of distinct ways to partition into groups of 4 is ~96 billion. No pruning makes brute-force tractable in a browser. The greedy approach is O(N²–N³) per round, fast enough, and is how real sports scheduling software works.

```
precomputeAllRounds(players, config):
  state = { partnerHistory: {}, courtHistory: {}, restCount: {} }
  for each round r in 0..totalRounds:
    sittingOut = selectSittingOut(players, state.restCount)
    active = players - sittingOut
    courts = buildRound(active, state)
    updateState(state, courts, sittingOut)
    rounds[r] = { courts, sittingOut }
  return rounds

buildRound(active, state):
  1. Sort active players by level (desc) to seed grouping
  2. Greedily assign players to courts, scoring each candidate
  3. For each court of 4, enumerate the 3 split options (existing bestSplit)
  4. Pick lowest-penalty split
```

The 3-split enumeration per group of 4 already exists in `bestSplit()`. The upgrade is: level-aware grouping when forming courts, and applying full penalty weights at both grouping and splitting steps.

---

## 2. Penalty Function Design

```js
export const PENALTY = {
  PARTNER_REPEAT:  1000,
  ADVANCED_PAIR:   5000,
  COURT_REPEAT:     500,
  REST_IMBALANCE:  2000,
};

function scoreSplit(pairA, pairB, courtIndex, state) {
  let score = 0;
  score += (state.partnerHistory[pk(pairA[0].id, pairA[1].id)] || 0) * PENALTY.PARTNER_REPEAT;
  score += (state.partnerHistory[pk(pairB[0].id, pairB[1].id)] || 0) * PENALTY.PARTNER_REPEAT;
  if (pairA.every(p => (p.level || 0) >= 3)) score += PENALTY.ADVANCED_PAIR;
  if (pairB.every(p => (p.level || 0) >= 3)) score += PENALTY.ADVANCED_PAIR;
  [...pairA, ...pairB].forEach(p => {
    score += (state.courtHistory[`${p.id}_c${courtIndex}`] || 0) * PENALTY.COURT_REPEAT;
  });
  return score;
}
```

Rest imbalance is enforced at `selectSittingOut` time via `soh` (existing pattern) — not folded into the court penalty.

---

## 3. Performance: <10ms at 24 Players

For 24 players, 6 courts, 12 rounds:
- Per round: ~600 scoring operations (576 grouping comparisons + 18 split evaluations)
- Total for 12 rounds: ~7,200 operations
- V8 runs simple property-access loops at 100–400M ops/sec

**Estimate: 1–10ms total.** The Firestore `setDoc` call takes longer than the algorithm.

Even at 100x inefficiency this completes in <100ms. The 500ms budget is extremely generous for the greedy approach.

**Confidence: MEDIUM on exact timing** (V8 speed from training data); **HIGH on "no performance problem"** conclusion.

---

## 4. Web Workers: Do Not Use

Worker instantiation + postMessage round-trip adds 10–100ms overhead. The computation takes <10ms on the main thread. Workers are a net **slowdown** for this use case.

**When Workers would become worthwhile:** algorithm switches to simulated annealing with 50K+ iterations, or player count grows to 100+.

---

## 5. No External Libraries

Existing JS round-robin libraries (`clux/tournament`, `roundrobin`, etc.) generate fixture lists — they have no skill levels, partner history, or penalty scoring. The existing codebase already has the right primitives (`pk()`, `bestSplit()`). Build bespoke.

---

## 6. Constraint Relaxation — Threshold-Based Progressive

```js
function buildRoundWithRelaxation(active, state) {
  const attempts = [
    { weights: PENALTY,                                                           threshold: 2000    },
    { weights: { ...PENALTY, COURT_REPEAT: 0 },                                  threshold: 6000    },
    { weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100 },             threshold: 15000   },
    { weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100,
                 ADVANCED_PAIR: 500 },                                            threshold: Infinity},
  ];
  for (const { weights, threshold } of attempts) {
    const result = tryBuildRound(active, state, weights);
    if (result.totalPenalty <= threshold) return result;
  }
}
```

**Use a score threshold, not binary fail/pass.** Thresholds (2000, 6000, 15000) are starting points requiring empirical tuning. Relaxation flags must be local to each round — never global state.

---

## 7. Data Structures

Use plain objects (not Maps or Sets). The existing `pk()` pattern with plain objects is correct and V8-optimized.

```js
const partnerHistory = {};   // { "1_3": 2, "2_4": 1, ... }
const courtHistory   = {};   // { "1_c0": 1, "3_c2": 1, ... }  ← new field
const restCount      = {};   // { "5": 1, "7": 0, ... }
```

`courtHistory` is not currently tracked — add it to `state` and update in `updateState`.

---

## 8. What NOT To Do

| Approach | Why Not |
|---|---|
| Brute-force all permutations | O(N!) — impossible at N>10 |
| Simulated annealing / genetic algorithms | Overkill; non-deterministic timing; no quality gain at this scale |
| Web Worker | Overhead > computation time for this problem size |
| External round-robin library | None handle level constraints |
| TypeScript migration | Out of scope |
| Lazy round generation (on demand) | Defeats pre-calculation requirement |

---

## 9. Confidence Summary

| Area | Confidence | Basis |
|---|---|---|
| Greedy construction is correct | HIGH | Combinatorics is mathematical |
| Performance: <10ms at 24 players | MEDIUM | V8 speed from training data, not live benchmark |
| Web Workers: not worth it | HIGH | MDN documentation + overhead math |
| No useful external libraries | MEDIUM | npm survey from training data |
| Relaxation architecture | HIGH | First principles |
| Threshold values (2000/6000/15000) | LOW | Starting estimates — require empirical tuning |

---

## Open Questions

- **Level encoding:** `p.level >= 3` is inferred from `highLevelClash` in americano.js — confirm actual integer values from SetupAmericano before implementing penalty function.
- **courtHistory tracking:** Not currently in state object — add and update in `updateState`.
- **Relaxation thresholds:** Empirical testing with 8-, 12-, 16-, 24-player distributions needed to tune.
