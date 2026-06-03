# Architecture Research — Pre-Calculation Engine Integration

**Date:** 2026-06-03
**Confidence:** HIGH — all findings from direct source code analysis

---

## Key Finding

**The scaffolding already exists.** `t.precomputedRounds` is already stored by `SetupAmericano.onStart()`, `precomputeAllRounds()` is already exported from `americano.js`, and `PlayAmericano` already renders future rounds from that array. The feature is ~80% wired up. The gap is the body of `precomputeAllRounds()` and ~10 lines in `onNext()`.

---

## State Model

No new top-level fields required. The existing shape is complete:

```
t.precomputedRounds  — Array<{ courts: Court[], sittingOut: Player[] }>, all rounds at t=0
t.currentRound       — Active courts for score input (unchanged)
t.rounds             — Played history (unchanged)
t.roundNum           — 1-based counter (unchanged)
t.players            — Live stat objects, accumulate pts/gf/gc (unchanged)
```

Pre-computed courts contain player snapshots at pts=0. Stats live only in `t.players`. `PlayAmericano` already handles this split — the `FutureRound` component uses a `playersDict` lookup from `t.players` for current names.

---

## Component Boundaries

| File | Change Scope | What Changes |
|------|-------------|--------------|
| `src/logic/americano.js` | Core | Body of `precomputeAllRounds()` — replace with penalty-based engine. `buildFirstRoundAmericano()` and `buildRoundAmericano()` signatures stay (Mexicano uses them). |
| `src/components/play/PlayAmericano.jsx` | ~10 lines | `onNext()` lines 114–120: replace `buildRoundAmericano()` call with conditional read from `t.precomputedRounds[t.roundNum]` |
| `src/components/setup/SetupAmericano.jsx` | Minor | Wrap `precomputeAllRounds()` in try/catch; add loading indicator; add level validation |
| `src/hooks/useTournament.js` | No change | — |
| `src/logic/initTournament.js` | No change | — |
| All other tournament types | No change | — |

---

## The `onNext()` Fix (~10 lines)

```js
// BEFORE (PlayAmericano.jsx ~line 114-120)
const { courts: nc, sittingOut: nSit } = buildRoundAmericano(
  np, t.config.courts, nh, nso, t.config.mode,
);

// AFTER — conditional read with fallback
const nextIndex = t.roundNum; // roundNum is 1-based; nextIndex is 0-based index for next round
if (t.precomputedRounds && t.precomputedRounds[nextIndex]) {
  nc = t.precomputedRounds[nextIndex].courts;
  nSit = t.precomputedRounds[nextIndex].sittingOut;
} else {
  // Mexicano mode, pairs mode, legacy tournaments, or schedule exhausted
  const result = buildRoundAmericano(np, t.config.courts, nh, nso, t.config.mode);
  nc = result.courts;
  nSit = result.sittingOut;
}
```

---

## Data Flow Change

**Before:** `onNext()` → compute next round on demand → persist

**After:** `onStart()` → compute all rounds once → persist schedule; `onNext()` → read from index → persist

---

## Error Recovery

`SetupAmericano.onStart()` must wrap `precomputeAllRounds()` in try/catch. On failure, persist with `precomputedRounds: null` and let the legacy path handle play. The tournament never becomes unplayable — the fallback guard in `onNext()` always catches a null/missing schedule.

---

## Firestore Size Numbers

| Scenario | Pre-computed | History | Total estimate |
|----------|--------------|---------|----------------|
| 12 players, 8 rounds, 3 courts | ~14 KB | ~14 KB | ~33 KB |
| 16 players, 10 rounds, 4 courts | ~20 KB | ~20 KB | ~45 KB |
| 24 players, 12 rounds, 6 courts | ~29 KB | ~29 KB | ~65 KB |
| 32 players, 20 rounds, 8 courts | ~64 KB | ~64 KB | ~145 KB |

All scenarios below 15% of the 1 MB Firestore document limit. No pagination or structural changes needed.

---

## Build Order (dependency-ordered)

1. **`src/logic/americano.js` — new `precomputeAllRounds()` body** — no upstream dependencies; fully testable in isolation
2. **`src/components/play/PlayAmericano.jsx` — `onNext()` fix** — depends on step 1 producing correct output; can ship with fallback guard before step 1 is final
3. **`src/components/setup/SetupAmericano.jsx` — validation + error handling** — depends on step 1 being stable
4. **`PlayAmericano` rest schedule / constraint warnings display** — optional polish; depends on steps 1+2

Steps 1+2 = complete core feature. Steps 3+4 = polish.

---

## Migration

No migration needed for in-flight tournaments. The `onNext()` guard (`t.precomputedRounds?.[nextIndex]`) falls back to the legacy round-by-round path when `precomputedRounds` is null. Old tournaments continue working exactly as before.

---

## Open Questions

- **Performance:** `precomputeAllRounds()` with 24 players and 12 rounds has not been benchmarked. If the penalty-based engine uses backtracking, it may block the UI thread >50ms on low-end mobile. Consider `setTimeout(fn, 0)` or a Web Worker if testing shows jank.
- **Pairs mode + precomputation:** Currently returns null for pairs mode (SetupAmericano line ~164). Architecture supports it without structural changes — just produce a non-null value when needed.
