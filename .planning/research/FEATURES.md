# Features Research — Americano Clásico Level-Aware Matchmaking

**Date:** 2026-06-03
**Domain:** Round-robin tournament matchmaking with skill-level constraints

---

## Key Finding

Much of the display infrastructure already exists in the codebase. The new milestone is adding the algorithm that makes those displays *meaningful*, not building new UI from scratch. The trust gap — organizers and players complaining when a pairing *looks* unfair — is the real product problem. Every differentiating feature is about making algorithm decisions legible.

Pre-calculation is the unlock: rest schedule panels, constraint warnings, and total-rounds counts are all available for free once `precomputedRounds[]` is populated correctly.

---

## Table Stakes (absence causes complaints)

| Feature | Complexity | Current Status |
|---------|------------|----------------|
| No Advanced+Advanced pairing (hard constraint) | Low — algorithm only | Missing — algorithm doesn't use levels yet |
| Rest balance visible across all rounds | Medium | Partial — shown per-round; full schedule panel is new |
| Partner repeat avoidance | Low | Partial — history tracked but penalty engine absent |
| "How many rounds total?" visible from round 1 | None | Done — subtitle uses `precomputedRounds.length` |
| Level validation before start (warn if useLevels=ON but all unrated) | Low | Missing |
| Score ties rejected | None | Done |

## Differentiators (competitive advantage)

| Feature | Complexity | Notes |
|---------|------------|-------|
| Constraint relaxation warnings (e.g. "R5 has a repeated partner — no other valid combination existed") | Medium | Algorithm emits `warnings[]`; admin-only display in PlayAmericano |
| Level distribution summary at setup ("3 Advanced, 5 Intermediate…") | Low | Computed from `playerInputs` in SetupAmericano; no algorithm dependency |
| "Emparejamiento calculado" moment at tournament start | Low | Brief loading state after "Iniciar Torneo"; signals intentional calculation |
| Full rest schedule panel (all rounds at a glance) | Medium | Data in `precomputedRounds[].sittingOut`; purely display; safe to defer |
| Level balance indicator per court card ("Nivel equilibrado") | Low | Sum level values per side; admin-only; purely display |

## Anti-Features (do not build)

| Anti-Feature | Why Not |
|--------------|---------|
| Manual pairing override | Breaks partner/rest tracking guarantees; high complexity for rare edge case |
| Per-player rest preferences | Adds setup friction; algorithm handles equity automatically |
| Fairness score export / PDF | Over-engineered; constraint warnings cover the transparency need |
| Penalty weight configuration UI | Implementation detail; exposing it causes confusion |
| Mid-tournament algorithm rerun from scores | That is Mexicano mode; adding it to Clásico blurs product distinction |

---

## Feature Dependencies

```
useLevels toggle ON
  → Level validation gate (warn if all unrated)
    → Pre-calculation runs level-aware engine
      → Advanced+Advanced constraint enforced
      → Penalty weights applied (pair, court, rest)
        → precomputedRounds[] stored in Firestore
          → Round tabs + FutureRound (existing UI) just work
          → Rest schedule panel consumes precomputedRounds[].sittingOut
          → Constraint warnings consume warnings[] emitted by algorithm

Level distribution summary (setup)
  → No algorithm dependency; reads playerInputs directly
  → Must render before "Iniciar Torneo"
```

---

## MVP Priority Order

1. Level-aware pre-calculation engine with penalty scoring (everything depends on this)
2. Level validation gate in SetupAmericano (low effort, prevents silent misconfiguration)
3. Constraint relaxation warnings emitted by algorithm, displayed admin-only (builds trust)
4. Level distribution summary in SetupAmericano (high confidence for organizer, 3 lines JSX)
5. "Emparejamiento calculado" loading state at tournament start (UX moment, perception > reality)

**Defer to next milestone:**
- Full rest schedule panel (data available once algorithm runs; gather feedback first)
- Level balance indicator per court card (purely display; add incrementally)

---

## Open Questions

- Should `warnings[]` be persisted to Firestore or gated in-component via `isAdmin`? Existing `isAdmin` pattern suggests in-component gating is sufficient.
- Should the level validation gate hard-block start, or show a soft warning? Soft is more organizer-friendly for groups where some players prefer not to set a level.
- At what player count does client-side pre-calculation become perceptibly slow on mid-range mobile? Needs a profiling pass.
