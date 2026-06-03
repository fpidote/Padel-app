# Walking Skeleton — Phase 1: Core Penalty Engine

**Type:** Brownfield algorithm-only Walking Skeleton
**Date:** 2026-06-03
**Project:** Padeldesk — Americano Clásico Level-Aware Matchmaking

---

## What "Walking Skeleton" Means Here

This is a brownfield project. The UI, Firebase infrastructure, and tournament lifecycle already exist and work. Phase 1 does not create a new stack — it replaces the body of one existing function and updates one call site. The "skeleton" for this phase is therefore:

> The algorithm returns valid output for a minimal test case, the call site destructures the new return shape correctly, and the tournament object persists both `precomputedRounds` and `roundWarnings` to Firestore in a single `persist()` call.

When Plan 01 completes, the following slice is working end-to-end:

```
organizer clicks "Iniciar Torneo"
  → SetupAmericano.onStart()
    → precomputeAllRounds(entities, config)
      → returns { rounds: Array<Round>, warnings: Array<Warning> }
    → persist({ ...t, precomputedRounds: rounds, roundWarnings: warnings, ... })
      → Firestore document: data JSON contains precomputedRounds and roundWarnings
```

A real organizer can start an 8-player Americano Clásico tournament and the `t.precomputedRounds` array will be non-null, level-aware, and penalty-optimized before round 1 begins.

---

## Architecture Decisions (Non-Negotiable for Phases 2 and 3)

### Return Shape: { rounds, warnings }

`precomputeAllRounds()` returns a plain object, not an array:

```js
{ rounds: Array<{ courts: Court[], sittingOut: Player[] }>, warnings: Warning[] }
```

Phase 2 consumers MUST destructure this shape. They must NOT assume `precomputeAllRounds()` returns an array.

### roundWarnings Storage Location

`t.roundWarnings` is a field inside the tournament object `t`, which gets JSON-serialized as the `data` field in Firestore. It is NOT a Firestore top-level field (unlike `ownerUid` and `createdAt`). Phase 2 reads it as `t.roundWarnings`.

### Penalty Constants — Exported, Stable

```js
export const PENALTY = {
  PARTNER_REPEAT: 1000,
  ADVANCED_PAIR:  5000,
  COURT_REPEAT:    500,
  REST_IMBALANCE: 2000,  // Enforced at sitting-out selection only
};

export const RELAX_THRESHOLDS = [2000, 6000, 15000];
// Attempt 0: threshold 2000 (strict)
// Attempt 1: threshold 6000 (court repeat relaxed)
// Attempt 2: threshold 15000 (partner repeat relaxed)
// Attempt 3: Infinity (all constraints relaxed)
```

These are tuning constants. Phase 3 could expose them to the organizer if needed — they are exported for that reason.

### Level Scale

Player levels are integers 0–3:
- 0: Sin definir (unrated)
- 1: Principiante
- 2: Intermedio
- 3: Avanzado

`(p.level || 0) >= 3` is the "Advanced" check. There is no level 4.

### Isolated Algorithm Functions

| Function | Status | Who Uses It |
|---|---|---|
| `precomputeAllRounds()` | REPLACED body | SetupAmericano.onStart() |
| `scoredSplit()` | NEW (not exported) | precomputeAllRounds() only |
| `selectSittingOut()` | NEW (not exported) | precomputeAllRounds() only |
| `levelSortedWithShuffle()` | NEW (not exported) | precomputeAllRounds() only |
| `bestSplit()` | UNCHANGED | buildRoundAmericano() (Mexicano mode) |
| `buildRoundAmericano()` | UNCHANGED | Mexicano live-round generation |
| `buildFirstRoundAmericano()` | UNCHANGED | SetupAmericano.onStart() (all modes) |

### Persist Contract

`persist()` in `useTournament.js` always uses `{ merge: true }`. Phase 1 call site adds one new field to the existing persist call — no separate Firestore write is needed.

### Player ID Contract

Player IDs are integers 0..N-1, assigned at tournament start by SetupAmericano.onStart(). Court history keys use the pattern `"${p.id}_c${courtIndex}"`. This is safe for current integer IDs. A future string-ID migration would need to audit these keys.

---

## What Phases 2 and 3 Build On

### Phase 2 — PlayAmericano Wire-Up

Phase 2 reads:
- `t.precomputedRounds[roundNum - 1]` to get the pre-calculated round (1-indexed roundNum, 0-indexed array)
- `t.roundWarnings` to display the warnings panel (admin-only)
- `t.precomputedRounds[r].sittingOut` for all rounds to render the rest schedule panel

Phase 2 must NOT call `buildRoundAmericano()` when `t.precomputedRounds` is non-null and non-empty.

### Phase 3 — Setup Validation and UX

Phase 3 reads:
- `t.config.useLevels` + `t.playerInputs` to determine if any player has a level assigned
- Calls `precomputeAllRounds()` again on re-shuffle (stores result in local React state, not persisted until "Iniciar Torneo")

Phase 3 can call `precomputeAllRounds()` as a pure function — it has no side effects.

---

## Minimum Viable Slice (Verified at Plan 01 Completion)

| Check | Expected |
|---|---|
| `precomputeAllRounds(8 players, { courts: 2, mode: "individual", maxRounds: 7 })` | `{ rounds: Array(7), warnings: Array }` |
| `precomputeAllRounds(any, { mode: "pairs" })` | `{ rounds: null, warnings: [] }` |
| 4 Advanced players, 2 courts: `warnings.filter(w => w.constraint === 'advanced_pair')` | `[]` (no advanced_pair warnings) |
| `grep "roundWarnings" SetupAmericano.jsx` | ≥ 2 matches |
| `npm run build` | passes |

---

*Skeleton documented: 2026-06-03*
*Plan 01 implements this skeleton entirely.*
