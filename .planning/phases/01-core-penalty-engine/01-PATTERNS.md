# Phase 1: Core Penalty Engine - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 2 (1 modified with new functions, 1 call-site update)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/logic/americano.js` (new functions: `PENALTY`, `RELAX_THRESHOLDS`, `scoredSplit`, body of `precomputeAllRounds`) | utility / pure algorithm | transform (batch, stateless) | `bestSplit()` + existing `precomputeAllRounds()` stub in same file | exact — same file, same conventions |
| `src/components/setup/SetupAmericano.jsx` (call site: `onStart()`) | component | request-response (async persist) | current `onStart()` in same file | exact — same function, surgical change |

---

## Pattern Assignments

### `src/logic/americano.js` — New constants and `scoredSplit()`

**Analog:** `bestSplit()` in `src/logic/americano.js` (lines 46–76)

**Imports pattern** (lines 1–2) — already present, no change needed:
```js
import { shuffle, pk } from "./utils";
```

**Export style** — follow the existing mix of named exports and unexported helpers:
```js
// Exported: precomputeAllRounds, buildFirstRoundAmericano, buildRoundAmericano
// Not exported: highLevelClash, matchBalance, bestSplit
// New exports follow same rule: PENALTY and RELAX_THRESHOLDS are exported (planner/tests need them);
// scoredSplit and selectSittingOut and levelSortedWithShuffle are NOT exported (internal helpers).
export const PENALTY = { ... };
export const RELAX_THRESHOLDS = [...];
function scoredSplit(...) { ... }          // no export
function selectSittingOut(...) { ... }     // no export
function levelSortedWithShuffle(...) { ... } // no export
```

**Core pattern: 3-split enumeration** (lines 47–60 of `bestSplit`) — mirror exactly, do not rewrite:
```js
// bestSplit enumerates exactly 3 pair-splits for a group of 4 — the exhaustive set
const opts = [
  [ [g[0], g[1]], [g[2], g[3]] ],
  [ [g[0], g[2]], [g[1], g[3]] ],
  [ [g[0], g[3]], [g[1], g[2]] ],
];
let best = opts[0], bs = Infinity;
opts.forEach(([pA, pB]) => {
  const sc = ...;           // penalty scoring
  if (sc < bs) { bs = sc; best = [pA, pB]; }
});
return best;
```
`scoredSplit` mirrors this structure exactly. Replace `const sc = ...` with the four-penalty formula. Return `{ pairs: best, score: bestScore }` instead of just `best`.

**`highLevelClash` reference** (lines 36–38) — callable directly from `scoredSplit`, do NOT duplicate:
```js
function highLevelClash(pair) {
  return pair.every((p) => (p.level || 0) >= 3) ? 1 : 0;
}
```
In `scoredSplit`, apply ADVANCED_PAIR penalty with: `if (highLevelClash(pA)) score += weights.ADVANCED_PAIR;`

**Plain-object state pattern** (lines 10–11 and 17–26 of existing `precomputeAllRounds`) — `courtHistory` must follow the exact same pattern as `ph` and `soh`:
```js
// Existing pattern to mirror:
let ph = {};
let soh = {};
// ... accumulation:
soh[p.id] = (soh[p.id] || 0) + 1;
ph[kA]    = (ph[kA]    || 0) + 1;
// New courtHistory follows same pattern:
let courtHistory = {};
// ... accumulation per round:
courtHistory[`${p.id}_c${courtIndex}`] = (courtHistory[`${p.id}_c${courtIndex}`] || 0) + 1;
```

**`pk()` usage pattern** (lines 22–26 of existing `precomputeAllRounds`) — canonical key for partner pairs, already imported:
```js
const kA = pk(court.pairA[0].id, court.pairA[1].id);
const kB = pk(court.pairB[0].id, court.pairB[1].id);
ph[kA] = (ph[kA] || 0) + 1;
ph[kB] = (ph[kB] || 0) + 1;
```
Use `pk()` for partner keys. Court keys use a separate literal pattern: `` `${p.id}_c${courtIndex}` `` (not via `pk()`).

**`shuffle()` usage pattern** (line 89 of `buildFirstRoundAmericano`) — already imported, call directly:
```js
const all = shuffle(entities);
```
`levelSortedWithShuffle()` calls `shuffle(byLevel[l])` on each same-level group before concatenation.

**Level-sort pattern** (lines 106–116 of `buildFirstRoundAmericano`) — top-half / bottom-half split is the existing round-1 grouping; the new `levelSortedWithShuffle()` replaces score-based sort for pre-computation rounds:
```js
// Existing: sort by level desc (no shuffle within level)
const sorted = [...entities].sort((a, b) => (b.level || 0) - (a.level || 0));
const act = sorted.slice(0, activeCourts * units);
const topH = act.slice(0, activeCourts * 2);
const botH = act.slice(activeCourts * 2);
// New: add within-level shuffle before this, using plain-object grouping:
// { 3: [...], 2: [...], 1: [...], 0: [...] } → shuffled per level → concatenated desc
```

---

### `src/logic/americano.js` — New body of `precomputeAllRounds()`

**Analog:** existing `precomputeAllRounds()` stub (lines 4–34) — same signature, same export, body replaced entirely.

**Function signature** (line 4) — unchanged, copy verbatim:
```js
export function precomputeAllRounds(entities, config) {
```

**Config destructuring** (lines 5–6) — unchanged:
```js
const { courts, mode = "individual", maxRounds } = config;
const isPairs = mode === "pairs";
```

**`totalRounds` cap formula** (line 7) — unchanged, copy verbatim:
```js
const totalRounds = maxRounds ?? Math.min(entities.length - 1, 12);
```

**`activeCourts` formula** (line 85 of `buildFirstRoundAmericano`) — same pattern used there:
```js
const activeCourts = Math.min(courts, Math.floor(entities.length / 4));
```

**State initialization** — extend existing `ph`/`soh` pattern with `courtHistory`:
```js
const ph          = {};
const courtHistory = {};
const soh         = {};
const rounds      = [];
const warnings    = [];
```

**soh accumulation** (lines 17–19 of existing stub) — copy pattern, apply inside round loop on sittingOut players:
```js
prev.sittingOut.forEach((p) => {
  soh[p.id] = (soh[p.id] || 0) + 1;
});
```

**Court object shape** (lines 98–100, 113–114 of `buildFirstRoundAmericano`) — all court objects must use this exact shape:
```js
{ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false }
```

**Round push shape** (lines 14, 30 of existing stub) — unchanged:
```js
rounds.push({ courts: cs, sittingOut });
```

**Return value** — CHANGED from `return rounds` (line 33) to:
```js
return { rounds, warnings };
```

**Error handling** — none in existing logic functions; pure functions have no try/catch. Follow the same convention: no try/catch inside `precomputeAllRounds` or `scoredSplit`. Errors propagate to `onStart()` which already has try/catch.

---

### `src/components/setup/SetupAmericano.jsx` — `onStart()` call-site update

**Analog:** current `onStart()` (lines 156–180) — surgical update, all surrounding code unchanged.

**Async handler pattern with try/catch** — this file does NOT have try/catch in `onStart()` currently, but CLAUDE.md mandates it for all async functions. The existing code is pre-existing debt; do not add try/catch as part of this phase (out of scope per CONTEXT.md phase boundary). Only update the destructuring and persist call.

**Import line** (line 3) — unchanged, `precomputeAllRounds` already imported:
```js
import { buildFirstRoundAmericano, precomputeAllRounds } from "../../logic/americano";
```

**Existing call site to replace** (lines 164–166):
```js
// BEFORE — treats return as array:
const precomputedRounds = (t.config.matchmaking || "americano") === "americano"
  ? precomputeAllRounds(entities, t.config)
  : null;
```

**New call site pattern** (destructure the new `{ rounds, warnings }` return):
```js
// AFTER — destructure new return shape:
let precomputedRounds = null;
let roundWarnings = [];
if ((t.config.matchmaking || "americano") === "americano") {
  const result = precomputeAllRounds(entities, t.config);
  precomputedRounds = result.rounds;
  roundWarnings = result.warnings;
}
```

**`persist()` call pattern** (lines 167–179) — extend with `roundWarnings`, all other fields unchanged:
```js
// BEFORE persist call (lines 167–179):
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

// AFTER — add roundWarnings field:
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
  roundWarnings,    // new — separate top-level field on t (persisted inside data JSON)
});
```

**`persist()` contract** — `persist` is passed as a prop (line 32), already uses `{ merge: true }` internally in `useTournament.js`. No change needed here — just call `await persist({ ... })` as before.

**Debounce pattern** — NOT applicable to `onStart()`. The `debRef` pattern is only for config inputs (lines 57–63, handlers lines 87–138). `onStart()` is a one-shot async action, called from a button click, no debounce.

---

## Shared Patterns

### Plain-object hash maps (partnerHistory / soh / courtHistory)
**Source:** `src/logic/americano.js` lines 10–11, 17–26
**Apply to:** `scoredSplit()`, `precomputeAllRounds()` body, `selectSittingOut()`
```js
// Initialization:
let ph = {};
// Read with fallback:
const count = ph[key] || 0;
// Write / increment:
ph[key] = (ph[key] || 0) + 1;
```
`courtHistory` and `soh` follow identical pattern. No `Map`, no `Set`, no class — plain `{}` only.

### 3-split enumeration (exhaustive, fixed)
**Source:** `src/logic/americano.js` lines 47–60 (`bestSplit`)
**Apply to:** `scoredSplit()` — copy the `opts` array structure verbatim, do not extend to 4+ options
```js
const opts = [
  [ [g[0], g[1]], [g[2], g[3]] ],
  [ [g[0], g[2]], [g[1], g[3]] ],
  [ [g[0], g[3]], [g[1], g[2]] ],
];
```

### Sitting-out selection: soh-based, not pts-based
**Source:** `src/logic/americano.js` lines 128–135 (`buildRoundAmericano`) — pattern to NOT copy verbatim (it uses pts-based sort and pool slicing). During pre-computation, use `soh` only, full pool:
```js
// buildRoundAmericano (existing — DO NOT copy verbatim for pre-computation):
const pool = sorted.slice(-Math.max(cnt * 2, cnt + 2))
  .map(p => ({ ...p, ss: soh[p.id] || 0 }))
  .sort((a, b) => a.ss !== b.ss ? a.ss - b.ss : a.pts - b.pts);
// Pre-computation replacement — use full pool, tiebreak by id (not pts):
const pool = [...entities]
  .map(p => ({ ...p, _soh: soh[p.id] || 0 }))
  .sort((a, b) => a._soh !== b._soh ? a._soh - b._soh : a.id - b.id);
```

### Warning object format
**Source:** CONTEXT.md D-09, D-11 (no existing analog — first occurrence of warnings in codebase)
**Apply to:** warning emission inside the round loop of `precomputeAllRounds()`
```js
warnings.push({
  round:      r + 1,                      // 1-based
  constraint: 'partner_repeat',           // fixed set: 'partner_repeat' | 'court_repeat' | 'advanced_pair'
  message:    `Ronda ${r + 1}: repetición de pareja permitida (sin combinación válida disponible)`,
});
```
One warning per round per constraint type (collapsed — not one per court).

### No-export convention for internal helpers
**Source:** `src/logic/americano.js` — `highLevelClash`, `matchBalance`, `bestSplit` have no `export`
**Apply to:** `scoredSplit`, `selectSittingOut`, `levelSortedWithShuffle` — define without `export`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `PENALTY` / `RELAX_THRESHOLDS` constants | config constants | n/a | No existing named penalty constants in codebase; first occurrence. Style: follow `TOURNAMENT_TYPES` / `TOURNAMENT_RULES` pattern in `constants.js` — `export const NAME = { ... }` |
| Warning accumulation and emission logic | algorithm output | transform | No existing warning system; first occurrence. Use structured object format per D-09. |

---

## Metadata

**Analog search scope:** `src/logic/americano.js`, `src/logic/utils.js`, `src/components/setup/SetupAmericano.jsx`
**Files scanned:** 3 (all read in full)
**Pattern extraction date:** 2026-06-03
