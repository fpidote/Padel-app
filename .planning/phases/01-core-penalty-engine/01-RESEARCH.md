# Phase 1: Core Penalty Engine — Research

**Researched:** 2026-06-03
**Domain:** Client-side JavaScript constraint-based scheduling algorithm
**Confidence:** HIGH — all findings from direct source-code analysis of the live codebase

---

## Summary

Phase 1 is a pure-function replacement: the body of `precomputeAllRounds()` in `src/logic/americano.js`
is currently a working-but-naive implementation that produces rounds without any penalty scoring or
level awareness. The scaffold — the function signature, its export, its call site in `SetupAmericano.onStart()`,
and the `precomputedRounds` field in Firestore — already exists and works. No new files, no new routes,
no UI changes are needed in this phase.

The algorithm is a greedy constructor: for each round it selects sitting-out players via the existing `soh`
rest-count pattern, groups the remaining active players by level (descending with a within-level shuffle for
variety), and for each court of four players evaluates exactly 3 pair-split options (mirroring `bestSplit`)
scored with a four-penalty function. A threshold-based relaxation loop tries up to four progressively looser
configurations before accepting the best available result and emitting a `warnings[]` entry. The entire
computation takes well under 10 ms for the maximum expected player count (24 players, 12 rounds).

The one integration wrinkle: `onStart()` currently persists `precomputedRounds` as a field inside the `t`
object (which gets JSON-stringified into `data`). The decisions require `roundWarnings` to also be persisted
to Firestore. The cleanest way — confirmed by reading `SetupAmericano.onStart()` — is to return
`{ rounds, warnings }` from the new `precomputeAllRounds()` and let the caller persist
`roundWarnings: warnings` alongside `precomputedRounds: rounds` in the same `persist()` call.

**Primary recommendation:** Replace the body of `precomputeAllRounds()`, add `scoredSplit()` above it, add
`PENALTY` and `RELAX_THRESHOLDS` exported constants, and update `SetupAmericano.onStart()` to destructure
the new return value and persist `roundWarnings`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create `scoredSplit(group, state, weights)` alongside existing `bestSplit()`. Do NOT modify `bestSplit()`.
- **D-02:** `scoredSplit()` evaluates all 4 penalties from day 1: PARTNER_REPEAT, ADVANCED_PAIR, COURT_REPEAT, REST_IMBALANCE. `courtHistory` is a new state field added alongside `partnerHistory`.
- **D-03:** `precomputeAllRounds()` uses `scoredSplit()` exclusively. `buildRoundAmericano()` and `buildFirstRoundAmericano()` continue using `bestSplit()` unchanged.
- **D-04:** Group players into courts using level-sorted primary (desc), then shuffle within same-level group before splitting into courts.
- **D-05:** During pre-calculation, `pts = 0` for all players — do NOT use score-based sorting. Use `soh` (rest count) only for sitting-out selection.
- **D-06:** `export const RELAX_THRESHOLDS = [2000, 6000, 15000]`. Attempt 0: threshold 2000. Attempt 1: threshold 6000. Attempt 2: threshold 15000. Attempt 3: Infinity.
- **D-07:** Thresholds are constants (not computed), easy to adjust.
- **D-08:** Relaxation flags are local variables inside the round-building loop — never mutate global state.
- **D-09:** Warning objects: `{ round: number, constraint: string, message: string }`. `message` in Spanish.
- **D-10:** `warnings[]` persisted to Firestore as a separate top-level field `t.roundWarnings` (not nested inside `precomputedRounds`).
- **D-11:** `constraint` values are a fixed set: `'partner_repeat'`, `'court_repeat'`, `'advanced_pair'`.
- **D-12:** Before solver loop, check `if (advancedCount >= 2 * courtsCount)` — set `advancedPairingAllowed = true` and exclude ADVANCED_PAIR from scoring.
- **D-13:** Level is integer 0–3 where `level >= 3` = Advanced. Use `(p.level || 0) >= 3`.

### Claude's Discretion

- Exact shuffle implementation (Fisher-Yates or `sort(() => Math.random() - 0.5)`) — either is fine
- `PENALTY` constant naming and export style — follow existing `americano.js` conventions
- Internal helper function names beyond `scoredSplit` and `precomputeAllRounds`
- How many retry attempts per relaxation level (1 attempt per level is the simplest correct approach)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALGO-01 | Pre-calculate all rounds upfront at tournament start, stored in `precomputedRounds[]` before any round is played | `precomputeAllRounds()` already called in `SetupAmericano.onStart()` and result stored in `persist()` call. Replacing its body satisfies this requirement. |
| ALGO-02 | Penalty-based scoring: PARTNER_REPEAT +1000, ADVANCED_PAIR +5000, COURT_REPEAT +500, REST_IMBALANCE +2000 | `scoredSplit()` implements these weights. `courtHistory` new state field tracks court occupancy. `soh` existing pattern handles rest imbalance at sitting-out selection time. |
| ALGO-03 | Dynamic per-round threshold-based relaxation — strict → relax court → relax partner → allow Advanced pairing. Flags scoped locally per round. | `RELAX_THRESHOLDS` constants drive a 4-attempt loop. Each round starts fresh (local vars, never global mutation). |
| ALGO-04 | Algorithm emits `warnings[]` alongside `precomputedRounds[]` when constraints are relaxed | Return value changes from `Array` to `{ rounds: Array, warnings: Array }`. Caller persists `roundWarnings`. |
| ALGO-05 | Impossible-constraint detection — when `advancedCount >= 2 * courts`, disable Advanced+Advanced penalty before solver loop | Pre-check before round loop sets `advancedPairingAllowed` flag. Flag is never mutated after initial check. |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Penalty scoring algorithm | Pure JS logic (`americano.js`) | — | No DOM, no state, no network — pure function |
| Round pre-computation | Pure JS logic (`americano.js`) | — | Called once at tournament start; result is data |
| Persisting `precomputedRounds` + `roundWarnings` | Setup component (`SetupAmericano.onStart()`) | Firestore via `persist()` | Caller owns the persist call; algorithm is stateless |
| Sitting-out selection | Pure JS logic (within `precomputeAllRounds`) | — | Extends existing `soh` pattern; no UI concern |
| Court history tracking | Pure JS logic (new `courtHistory` state object) | — | Mirror of `partnerHistory`; stays inside the algorithm |
| Advanced-constraint detection | Pure JS logic (pre-check before solver loop) | — | Mathematical invariant check; no user input needed |

---

## Standard Stack

No external packages are installed in Phase 1. All implementation uses existing project primitives.

### Core (Existing, Verified by Direct Code Read)

| Asset | Location | Purpose | Notes |
|-------|----------|---------|-------|
| `pk(a, b)` | `src/logic/utils.js` | Canonical pair key for `partnerHistory` | Numeric IDs: sorted then joined with `_`. Safe for court keys of the form `` `${id}_c${idx}` `` because `_c` cannot collide with numeric-only keys |
| `shuffle(arr)` | `src/logic/utils.js` | Fisher-Yates in-place shuffle; returns new array | Already imported in `americano.js` |
| `bestSplit(g, ph)` | `src/logic/americano.js` | Enumerates 3 pair-split options — pattern to mirror in `scoredSplit` | Do NOT modify |
| `highLevelClash(pair)` | `src/logic/americano.js` | Returns 1 if both players have `level >= 3` | Can be referenced or inlined in `scoredSplit` |
| `buildFirstRoundAmericano` | `src/logic/americano.js` | Already uses level-sorted top-half/bottom-half grouping | Do NOT modify |
| `precomputeAllRounds(entities, config)` | `src/logic/americano.js` | Export signature stays identical | Body is replaced |

### No Package Legitimacy Audit Required

Phase 1 installs zero external packages. All code is bespoke JavaScript within the existing file.

---

## Architecture Patterns

### System Architecture Diagram

```
SetupAmericano.onStart()
  │
  ├─ buildFirstRoundAmericano(entities, courts, mode)   ← UNCHANGED
  │    └─ uses bestSplit()                              ← UNCHANGED
  │
  └─ precomputeAllRounds(entities, config)              ← BODY REPLACED
       │
       ├─ [pre-check] advancedPairingAllowed = advancedCount >= 2 * courts
       │
       ├─ state = { ph: {}, courtHistory: {}, soh: {} }
       │
       └─ for r in 0..totalRounds:
            │
            ├─ selectSittingOut(entities, state.soh)   ← greedy by soh count
            │
            ├─ [level-sorted grouping with within-level shuffle]
            │
            └─ for each group of 4:
                 └─ tryRelaxationLevels(group, courtIndex, state)
                      │
                      ├─ attempt 0: weights=PENALTY, threshold=2000
                      ├─ attempt 1: COURT_REPEAT=0, threshold=6000
                      ├─ attempt 2: COURT_REPEAT=0, PARTNER_REPEAT=100, threshold=15000
                      └─ attempt 3: all weights reduced, threshold=Infinity
                           │
                           └─ scoredSplit(group, courtIdx, state, weights)
                                └─ evaluates 3 pair-split options → returns best + penalty score

       Returns: { rounds: Array<{courts, sittingOut}>, warnings: Array<{round, constraint, message}> }
       │
       └─ SetupAmericano.onStart() calls persist({
            ...t,
            precomputedRounds: rounds,
            roundWarnings: warnings,    ← NEW field
            currentRound: courts,
            ...
          })
```

### Recommended Project Structure

No structural changes. Phase 1 is entirely within the existing file:

```
src/
└── logic/
    └── americano.js   ← Only file modified in Phase 1
```

### Pattern 1: scoredSplit() — Mirror of bestSplit() with Configurable Penalty Weights

**What:** Evaluate the 3 possible pair-splits for a group of 4 players and return the split with the lowest penalty score given the current `state` and `weights`.

**When to use:** Called from within the round-building loop, once per court per relaxation attempt.

**Example:** [VERIFIED: direct source read of `bestSplit` in `src/logic/americano.js`]

```js
// PENALTY constants — exported so tests can import them directly
export const PENALTY = {
  PARTNER_REPEAT: 1000,
  ADVANCED_PAIR:  5000,
  COURT_REPEAT:    500,
  REST_IMBALANCE: 2000,  // Applied at sitting-out selection, not in scoredSplit
};

export const RELAX_THRESHOLDS = [2000, 6000, 15000];

// Three pair-split options for a group of 4 — mirrors bestSplit enumeration exactly
const SPLIT_OPTS = (g) => [
  [[g[0], g[1]], [g[2], g[3]]],
  [[g[0], g[2]], [g[1], g[3]]],
  [[g[0], g[3]], [g[1], g[2]]],
];

function scoredSplit(group, courtIndex, state, weights) {
  const { ph, courtHistory } = state;
  let best = null, bestScore = Infinity;

  SPLIT_OPTS(group).forEach(([pA, pB]) => {
    let score = 0;

    // Partner repeat penalty
    score += (ph[pk(pA[0].id, pA[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);
    score += (ph[pk(pB[0].id, pB[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);

    // Advanced+Advanced pair penalty (skipped when advancedPairingAllowed = true)
    if ((weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR) > 0) {
      if (pA.every(p => (p.level || 0) >= 3)) score += weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR;
      if (pB.every(p => (p.level || 0) >= 3)) score += weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR;
    }

    // Court repeat penalty
    [...pA, ...pB].forEach(p => {
      score += (courtHistory[`${p.id}_c${courtIndex}`] || 0) * (weights.COURT_REPEAT ?? PENALTY.COURT_REPEAT);
    });

    if (score < bestScore) {
      bestScore = score;
      best = [pA, pB];
    }
  });

  return { pairs: best, score: bestScore };
}
```

### Pattern 2: Sitting-Out Selection — Extension of Existing `soh` Pattern

**What:** Select which players sit out each round, preferring those who have rested least.

**When to use:** Called at the start of each round iteration in the pre-computation loop.

**Example:** [VERIFIED: direct source read of `precomputeAllRounds` and `buildRoundAmericano` in `src/logic/americano.js`]

```js
// selectSittingOut — pure extension of existing soh pattern
// Returns { active: Player[], sittingOut: Player[] }
function selectSittingOut(entities, courts, soh) {
  const units = 4;
  const activeCourts = Math.min(courts, Math.floor(entities.length / units));
  const cnt = entities.length - activeCourts * units;

  if (cnt <= 0) return { active: entities, sittingOut: [] };

  // Among the bottom pool, pick by fewest rests then by index (pts=0 during pre-calc, so pts tie always)
  const pool = [...entities]
    .map(p => ({ ...p, _soh: soh[p.id] || 0 }))
    .sort((a, b) => a._soh !== b._soh ? a._soh - b._soh : a.id - b.id);

  const sittingOutIds = new Set(pool.slice(0, cnt).map(p => p.id));
  return {
    sittingOut: entities.filter(p => sittingOutIds.has(p.id)),
    active:     entities.filter(p => !sittingOutIds.has(p.id)),
  };
}
```

**Key detail:** Sort criterion uses `a.id - b.id` as tiebreaker (not `a.pts`) because all `pts = 0` during pre-computation. This matches D-05.

### Pattern 3: Level-Sorted Grouping with Within-Level Shuffle (D-04)

**What:** Sort active players by level descending, shuffle within each same-level group, then use the first `activeCourts * 2` as "top half" and remainder as "bottom half" — mirroring the existing `buildFirstRoundAmericano` pattern.

**Example:** [VERIFIED: direct source read of `buildFirstRoundAmericano` lines 106–116]

```js
// Level-sorted grouping with within-level shuffle — prevents overfitting
function levelSortedWithShuffle(active) {
  // Group by level
  const byLevel = {};
  active.forEach(p => {
    const l = p.level || 0;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(p);
  });

  // Shuffle within each level group, then concatenate descending
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);
  return levels.flatMap(l => shuffle(byLevel[l]));
}
```

### Pattern 4: Relaxation Loop (D-06, D-08)

**What:** Four progressive attempts per round, each with looser penalty weights and a higher acceptance threshold. Flags are local to the round loop body.

**Example:** [ASSUMED — first-principles derivation matching D-06]

```js
// Relaxation configurations — index = attempt number
const RELAX_CONFIGS = [
  { weights: { ...PENALTY },                                                         threshold: RELAX_THRESHOLDS[0] },
  { weights: { ...PENALTY, COURT_REPEAT: 0 },                                        threshold: RELAX_THRESHOLDS[1] },
  { weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100 },                   threshold: RELAX_THRESHOLDS[2] },
  { weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100, ADVANCED_PAIR: 0 }, threshold: Infinity },
];

// Inside the round loop:
for (let r = 0; r < totalRounds; r++) {
  let roundResult = null;

  for (let attempt = 0; attempt < RELAX_CONFIGS.length; attempt++) {
    const { weights, threshold } = RELAX_CONFIGS[attempt];

    // Build candidate round with these weights
    const candidate = buildCandidateRound(active, state, weights, activeCourts, advancedPairingAllowed);

    if (candidate.totalPenalty <= threshold) {
      roundResult = { ...candidate, relaxLevel: attempt };
      break;
    }

    // If last attempt, accept anyway
    if (attempt === RELAX_CONFIGS.length - 1) {
      roundResult = { ...candidate, relaxLevel: attempt };
    }
  }

  // Emit warning if constraints were relaxed
  if (roundResult.relaxLevel > 0) {
    // ... build warning object(s) from relaxLevel
  }
}
```

### Pattern 5: Return Shape Change — New Two-Value Return from precomputeAllRounds()

**What:** `precomputeAllRounds()` currently returns `Array<{courts, sittingOut}>`. After Phase 1 it returns `{ rounds: Array<{courts, sittingOut}>, warnings: Array<{round, constraint, message}> }`. The call site in `SetupAmericano.onStart()` must be updated to destructure and persist both.

**Example:** [VERIFIED: direct source read of `SetupAmericano.jsx` lines 164–178]

```js
// BEFORE (SetupAmericano.onStart, lines 164-178 approximately):
const precomputedRounds = (t.config.matchmaking || "americano") === "americano"
  ? precomputeAllRounds(entities, t.config)
  : null;
await persist({
  ...t,
  [isPairs ? "pairs" : "players"]: entities,
  currentRound: courts,
  sittingOut,
  status: "playing",
  roundNum: 1,
  rounds: [],
  partnerHistory: {},
  sitOutHistory: {},
  precomputedRounds,
});

// AFTER:
let precomputedRounds = null;
let roundWarnings = [];
if ((t.config.matchmaking || "americano") === "americano") {
  const result = precomputeAllRounds(entities, t.config);
  precomputedRounds = result.rounds;
  roundWarnings = result.warnings;
}
await persist({
  ...t,
  [isPairs ? "pairs" : "players"]: entities,
  currentRound: courts,
  sittingOut,
  status: "playing",
  roundNum: 1,
  rounds: [],
  partnerHistory: {},
  sitOutHistory: {},
  precomputedRounds,
  roundWarnings,             // NEW — separate top-level Firestore field
});
```

### Anti-Patterns to Avoid

- **Mutating global `RELAX_CONFIGS` weights:** Relaxation must use local weight overrides per round, not mutate the constant. Construct `{ ...PENALTY, COURT_REPEAT: 0 }` fresh each attempt.
- **Score-based sort during pre-computation:** All `pts = 0`; sorting by `pts` is meaningless and can produce arbitrary ordering depending on JS engine internals. Use `soh` for sitting-out, level for grouping.
- **Cumulative penalty scoring:** `partnerHistory` and `courtHistory` are accumulative counts — but `scoredSplit` uses `count * WEIGHT` which is marginal for the *current pairing decision*, not a running total across all rounds. This is correct. Do not add a "total penalty across all previous rounds" to the score.
- **Expanding beyond 3 split options:** There are exactly 3 distinct unordered pair-splits for a group of 4. Evaluating more is a permutation error. The search space is fixed at 3.
- **Storing full player objects in precomputedRounds:** Store player ID references only; resolve names at render time. This keeps Firestore document size small and prevents stale name issues. (Note: existing code already stores full objects in `currentRound` — consistency with the existing pattern is acceptable for Phase 1, but see Pitfall 12 in PITFALLS.md for the size estimate. The max is ~65 KB for 24 players × 12 rounds, well within the 1 MB Firestore limit.)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pair canonical keys | Custom key function | `pk(a, b)` from `utils.js` | Already handles numeric sort and `_` separator; changing it would break `partnerHistory` for the rest of the system |
| Array shuffle | `sort(() => Math.random() - 0.5)` | `shuffle(arr)` from `utils.js` | Fisher-Yates is already imported in `americano.js`; consistent entropy |
| 3-split enumeration | Rewriting the 3-option list | Mirror `bestSplit`'s `opts` array directly | There are exactly 3 options; any other enumeration adds confusion or bugs |
| Court occupancy tracking | External Map or Set | Plain `{}` object (`courtHistory`) | Matches existing `partnerHistory` and `soh` plain-object pattern; V8-optimized |

**Key insight:** The entire algorithm builds on three existing primitives: `pk()`, `shuffle()`, and the 3-split enumeration from `bestSplit()`. The upgrade is weighted penalty scoring and threshold relaxation on top of these primitives — not a ground-up rewrite.

---

## Runtime State Inventory

Phase 1 is a pure greenfield logic addition (no rename, refactor, or migration). This section is omitted.

---

## Common Pitfalls

### Pitfall 1: Advanced Pair Penalty Misapplied When Mathematically Unsatisfiable

**What goes wrong:** With 4 Advanced players and 2 courts, every round will produce at least one Advanced+Advanced pair. The algorithm runs all 4 relaxation attempts, emits a warning on every round, and produces a noisy `roundWarnings[]` with 12+ entries — all "advanced_pair" for every round.

**Why it happens:** D-12 check is skipped or placed too late (inside the round loop instead of before it).

**How to avoid:** The `advancedPairingAllowed` flag must be set once before the round loop using `const advancedCount = entities.filter(p => (p.level || 0) >= 3).length`. When `advancedPairingAllowed = true`, pass `ADVANCED_PAIR: 0` in all relaxation weight configs and do not emit `'advanced_pair'` warnings.

**Warning signs:** More warnings than total rounds; all warnings have `constraint: 'advanced_pair'`.

---

### Pitfall 2: Relaxation Flag Bleeds Between Rounds

**What goes wrong:** The relaxation level from round R is not reset before round R+1. If round 5 required relaxation level 2 (partner repeats allowed), round 6 also skips strict and partner-sensitive checks even when a valid strict solution exists.

**Why it happens:** `relaxLevel` variable declared in outer scope and not reset at round loop top.

**How to avoid:** Declare the attempt variable `let roundResult = null` inside the `for (let r = ...)` loop body. Each round always starts the relaxation loop from attempt 0.

**Warning signs:** `roundWarnings` has a "block" pattern — warnings appear on every round from round 5 onward even for 8-player tournaments.

---

### Pitfall 3: pk() Key Collision with Court Keys

**What goes wrong:** Court history keys use `` `${p.id}_c${courtIndex}` `` — e.g., `"3_c2"`. If a player ID is `"3_c2"` (a string ID), that collides with the court key. Currently IDs are numeric integers (see `SetupAmericano.onStart()`: `entities = t.playerInputs.map((p, i) => ({ id: i, ... }))`), so this is safe. A future string-ID migration would silently corrupt `courtHistory`.

**Why it happens:** Court keys bypass `pk()` (which only works for pair keys). A player with ID `"3_c2"` as string would collide.

**How to avoid:** For Phase 1, IDs are integers 0–N from `SetupAmericano`. The pattern `` `${p.id}_c${courtIndex}` `` is safe because no integer formatted as a string contains `_c`. Add a comment noting the assumption.

**Warning signs:** Court repeat penalties fire in round 1 before any player has used a court.

---

### Pitfall 4: Sitting-Out Pool Boundary Incorrect

**What goes wrong:** The existing `buildRoundAmericano` uses `sorted.slice(-Math.max(cnt * 2, cnt + 2))` to form the candidate pool for sitting-out. This score-based pool slice makes no sense during pre-computation where all `pts = 0`. The entire entities list is essentially the pool.

**Why it happens:** Copying `buildRoundAmericano`'s sitting-out logic verbatim into `precomputeAllRounds`.

**How to avoid:** During pre-computation, use all entities as the candidate pool (or equivalently `sorted.slice(-entities.length)`). The only sort criterion that matters is `soh` count; secondary tiebreaker is `id` index (not `pts`). See Pattern 2 above.

**Warning signs:** Sitting-out distribution after 12 rounds is highly uneven even with 8 players and 2 courts where perfect fairness is achievable.

---

### Pitfall 5: Return Shape Not Updated at Call Site

**What goes wrong:** `precomputeAllRounds()` now returns `{ rounds, warnings }` but `SetupAmericano.onStart()` still treats the return value as an array (the old return shape). `persist({ ..., precomputedRounds: result })` stores the object instead of the array, breaking `PlayAmericano`'s `t.precomputedRounds[roundNum]` index access.

**Why it happens:** The call site update is forgotten or placed in a different task.

**How to avoid:** Both tasks — the algorithm body and the call site update — must ship together. They are a single atomic change. If the plan splits them into separate tasks, the earlier task must not be deployed without the later one.

**Warning signs:** `PlayAmericano` console errors about `t.precomputedRounds[r] is not a function` or `undefined`.

---

### Pitfall 6: REST_IMBALANCE Penalty Applied Inside scoredSplit()

**What goes wrong:** `REST_IMBALANCE` (+2000) is applied as a penalty inside `scoredSplit()` for each player in the group, not just at sitting-out selection time. This double-counts rest pressure and can cause the algorithm to make worse court assignments to compensate for rest imbalance, even when rest selection is already optimal.

**Why it happens:** The research notes "4 penalties from day 1" (D-02) and a developer applies all 4 inside `scoredSplit()`.

**How to avoid:** `REST_IMBALANCE` is enforced exclusively at `selectSittingOut()` time by choosing the player(s) with the fewest rests. It is NOT a parameter of `scoredSplit()`. The `PENALTY.REST_IMBALANCE` constant exists for documentation completeness and Phase 2 display, but it has no place in the court-assignment penalty calculation.

**Warning signs:** Court assignments change wildly round-to-round even with identical player pools; total penalty scores are unexpectedly high (>10,000) on rounds with no partner or court repeats.

---

## Code Examples

### Full precomputeAllRounds() Skeleton

Verified entry points, exit points, and field names from direct source reads:

```js
// Source: direct read of src/logic/americano.js (current stub) + src/components/setup/SetupAmericano.jsx

export const PENALTY = {
  PARTNER_REPEAT: 1000,
  ADVANCED_PAIR:  5000,
  COURT_REPEAT:    500,
  REST_IMBALANCE: 2000,  // Enforced at sitting-out selection, NOT in scoredSplit
};

export const RELAX_THRESHOLDS = [2000, 6000, 15000];

// Returns { rounds: Array<{courts, sittingOut}>, warnings: Array<{round, constraint, message}> }
export function precomputeAllRounds(entities, config) {
  const { courts, mode = "individual", maxRounds } = config;
  const isPairs = mode === "pairs";

  // Pairs mode: no level-aware pre-computation; return null-equivalent for caller to skip
  if (isPairs) return { rounds: null, warnings: [] };

  const totalRounds = maxRounds ?? Math.min(entities.length - 1, 12);
  const activeCourts = Math.min(courts, Math.floor(entities.length / 4));

  // ALGO-05: Impossible-constraint pre-check (D-12)
  const advancedCount = entities.filter(p => (p.level || 0) >= 3).length;
  const advancedPairingAllowed = advancedCount >= 2 * activeCourts;

  // Shared mutable state across rounds (plain objects — D-02)
  const ph          = {};   // partnerHistory: { "0_1": 2, ... }
  const courtHistory = {};   // NEW: { "3_c0": 1, ... }
  const soh         = {};   // sittingOutHistory: { "5": 1, ... }

  const rounds   = [];
  const warnings = [];

  for (let r = 0; r < totalRounds; r++) {
    // ... sitting-out selection, grouping, relaxation loop, state update
    rounds.push({ courts: cs, sittingOut });

    // Update ph, courtHistory, soh from this round's result
  }

  return { rounds, warnings };
}
```

### Player Shape at precomputeAllRounds Call Time

Verified from `SetupAmericano.onStart()` lines 158–162: [VERIFIED: direct source read]

```js
// entities shape — confirmed from SetupAmericano.onStart():
// entities = t.playerInputs.map((p, i) => ({
//   id: i,           // integer 0..N-1
//   name: p.name.trim(),
//   level: p.level,  // integer 0..3 (0 = unrated, 1 = Principiante, 2 = Intermedio, 3 = Avanzado)
//   pts: 0,
//   gf: 0,
//   gc: 0,
// }));
```

Level scale confirmed from `SetupAmericano.jsx` LEVELS constant (lines 14–19):

```js
// LEVELS = [
//   { id: 0, label: "Sin definir",  short: "-", color: "#64748b" },
//   { id: 1, label: "Principiante", short: "P", color: "#94a3b8" },
//   { id: 2, label: "Intermedio",   short: "M", color: "#38bdf8" },
//   { id: 3, label: "Avanzado",     short: "A", color: "#84cc16" },
// ];
// Max level = 3 (Avanzado). (p.level || 0) >= 3 correctly identifies Advanced players.
// Only one level counts as "Advanced" — there is no level 4.
```

### Warning Object Format

```js
// D-09, D-11 — constraint values are fixed strings for Phase 2 filtering
const warning = {
  round: r + 1,                    // 1-based round number
  constraint: 'partner_repeat',    // 'partner_repeat' | 'court_repeat' | 'advanced_pair'
  message: `Ronda ${r + 1}: repetición de pareja permitida (sin combinación válida disponible)`,
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bestSplit(g, ph)` — arbitrary weights (×12 partner repeat, ×15 level clash, ×2 balance) | `scoredSplit(g, courtIdx, state, weights)` — named PENALTY constants, court history, relaxation loop | Phase 1 | Explicit, tuneable, level-aware |
| `precomputeAllRounds` returns `Array<Round>` | Returns `{ rounds: Array<Round>, warnings: Array<Warning> }` | Phase 1 | Caller can persist warnings separately |
| No `courtHistory` tracking | `courtHistory` plain object alongside `partnerHistory` | Phase 1 | Court-repeat penalty becomes possible |
| Score-based sort during pre-computation (meaningless with `pts=0`) | `soh`-only sort for sitting-out; level-sort for grouping | Phase 1 | Deterministic, meaningful ordering |

**Deprecated/outdated:**
- The old `precomputeAllRounds` body (rounds 1–N built with `buildRoundAmericano` which uses score-based sort and no level-aware grouping): replaced entirely. `buildRoundAmericano` itself is not deprecated — it stays for Mexicano mode.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Court key format `` `${p.id}_c${courtIndex}` `` is collision-free given current integer IDs | Pitfall 3 | Low — IDs are 0..N integers; confirmed from SetupAmericano.onStart(). Would become a real risk only if IDs change to strings containing `_c`. |
| A2 | `totalRounds = Math.min(entities.length - 1, 12)` cap matches business expectation for pre-computation | Code Examples | Low — copied directly from existing `precomputeAllRounds` stub; same formula |
| A3 | The pairs-mode path (`isPairs = true`) should return `{ rounds: null, warnings: [] }` so the caller's null-guard stays intact | Code Examples | Low — confirmed from SetupAmericano.onStart(): `precomputedRounds = ... ? precomputeAllRounds(...) : null`; returning `{ rounds: null }` is backward-compatible as long as caller destructures |
| A4 | `RELAX_CONFIGS[3]` using `ADVANCED_PAIR: 0` (zero, not removal) is correct for passing through `scoredSplit` when `advancedPairingAllowed` is also true | Pattern 4 | Low — the guard `if (weights.ADVANCED_PAIR > 0)` makes both paths equivalent; zero and removal produce identical scoring |

---

## Open Questions

1. **pairs-mode return shape**
   - What we know: `SetupAmericano.onStart()` currently does `precomputedRounds = (t.config.matchmaking || "americano") === "americano" ? precomputeAllRounds(entities, t.config) : null`. If matchmaking is not "americano", `precomputedRounds` is null.
   - What's unclear: `isPairs` (mode = "pairs") is a separate axis from `matchmaking`. Currently the existing stub runs the (trivial) loop even for pairs mode and returns an array. After Phase 1, pairs mode has no level-aware pre-computation. Should the new function return `{ rounds: null, warnings: [] }` for pairs mode, or should the call site add an `isPairs` guard before calling?
   - Recommendation: Return `{ rounds: null, warnings: [] }` inside `precomputeAllRounds` when `isPairs` is true. This is self-contained. The call-site change needed for destructuring already touches that line.

2. **Warning deduplication strategy**
   - What we know: Relaxation level is determined per court-group per round. A round with 6 courts could emit 6 separate `partner_repeat` warnings.
   - What's unclear: Should each court emit its own warning, or should the round collapse all per-court warnings into a single warning entry (e.g., `"Ronda 3: 2 de 6 canchas con repetición de pareja"`)?
   - Recommendation: One warning per round per constraint type (collapsed). This keeps `roundWarnings[]` short and is simpler for Phase 2 to display. Track which constraints fired during a round iteration, then emit one entry per constraint at round end.

3. **`maxRounds: null` handling**
   - What we know: When `maxRounds` is null, `totalRounds = Math.min(entities.length - 1, 12)`.
   - What's unclear: The UI allows "Ilimitadas" (null) — but pre-computation requires a finite number. With null, `entities.length - 1` is used (e.g., 23 rounds for 24 players). Is this the intended maximum when the organizer selects "Ilimitadas"?
   - Recommendation: Cap at `Math.min(entities.length - 1, 12)` as the existing stub already does. This is already correct behaviour — just confirm it with a comment.

---

## Environment Availability

Phase 1 is a pure code change. No external tools, services, CLIs, databases, or runtimes are required beyond the existing project setup. This section is skipped.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply directly to this phase:

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| No TypeScript | All code in `.js` files. `precomputeAllRounds`, `scoredSplit`, constants — plain JavaScript only |
| `persist()` always uses `{ merge: true }` | Confirmed in `useTournament.js` — the hook already enforces this; `SetupAmericano.onStart()` calls `persist()`, not `setDoc` directly |
| No `localStorage` for permissions | Not applicable to Phase 1 (pure algorithm) |
| No `console.log` in production | Use `console.error` only in catch blocks. Algorithm function has no catch blocks; no logging needed |
| Commits in Spanish, format `tipo: descripción corta` | Example commit for this phase: `feat: implementar motor de penalización nivel-aware en precomputeAllRounds` |
| No listeners in components | Not applicable — Phase 1 is pure logic |
| `ownerUid` and `createdAt` stay at Firestore document top level, not inside `data` JSON | `roundWarnings` is a new field inside `t` (which maps to `data` JSON) — this is correct. It does NOT go to Firestore top level alongside `ownerUid` |
| `setDoc` with `{ merge: true }` in persist | Already enforced by `useTournament.js` hook |

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `src/logic/americano.js` — complete file, all function bodies and signatures
- Direct source read: `src/logic/utils.js` — `pk()`, `shuffle()` implementations
- Direct source read: `src/components/setup/SetupAmericano.jsx` — `onStart()`, level constants, call site
- Direct source read: `src/hooks/useTournament.js` — `persist()` contract
- Direct source read: `src/logic/initTournament.js` — initial tournament state shape
- Direct source read: `.planning/phases/01-core-penalty-engine/01-CONTEXT.md` — all locked decisions D-01 through D-13
- Direct source read: `.planning/REQUIREMENTS.md` — ALGO-01 through ALGO-05 definitions
- Direct source read: `.planning/research/STACK.md`, `PITFALLS.md`, `ARCHITECTURE.md`, `FEATURES.md`

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — pitfalls derived from code analysis in a prior session; cross-verified against current source

### Tertiary (LOW confidence)

- None — all findings in this research are from direct source reads.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from live source files
- Architecture: HIGH — call site and return shape verified from SetupAmericano and americano.js
- Pitfalls: HIGH — derived from direct code analysis and prior research cross-check
- Penalty weights / thresholds: LOW — values are locked by decisions (D-06, D-07) but their real-world effectiveness requires empirical tuning with actual tournament data

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable codebase; thresholds need revalidation after first real tournament run)
