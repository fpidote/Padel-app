# Requirements — Americano Clásico Level-Aware Matchmaking

**Version:** v1
**Date:** 2026-06-03
**Project:** Padeldesk — Americano Clásico upgrade

---

## v1 Requirements

### Algorithm

- [ ] **ALGO-01**: Pre-calculate all rounds upfront at tournament start, stored in `precomputedRounds[]` before any round is played
- [ ] **ALGO-02**: Penalty-based scoring for each round candidate — partner repeat (+1000), Advanced+Advanced pair (+5000), court repeat (+500), rest imbalance (+2000) — minimize total penalty
- [ ] **ALGO-03**: Dynamic per-round threshold-based relaxation — strict → relax court repeat → relax partner repeat → allow Advanced+Advanced pairing (flags scoped locally per round, never global)
- [ ] **ALGO-04**: Algorithm emits `warnings[]` alongside `precomputedRounds[]` when constraints are relaxed, describing which round and which constraint was relaxed
- [ ] **ALGO-05**: Impossible-constraint detection — when `advancedCount >= 2 * courts`, automatically disable Advanced+Advanced penalty before solver loop (constraint is mathematically unsatisfiable)

### Setup UI

- [ ] **SETUP-01**: Level validation gate — if `useLevels=ON` and no players have a level assigned, display a warning before allowing tournament start (soft warning, organizer can confirm and proceed)
- [ ] **SETUP-02**: Re-shuffle button — after initial pre-calculation, organizer can re-trigger `precomputeAllRounds()` to generate a new schedule if unhappy with the distribution

### Play UI

- [ ] **PLAY-01**: Relaxation warnings panel (admin-only) — displays which rounds had constraints relaxed and the reason (consumed from `warnings[]`)
- [ ] **PLAY-02**: Rest schedule panel — shows all pre-calculated rounds at a glance with sitting-out players per round (consumed from `precomputedRounds[].sittingOut`)

---

## v2 Requirements (deferred)

- Level distribution summary at setup ("3 Advanced, 5 Intermediate…") — data available from `playerInputs`, no algorithm dependency; gather feedback first
- "Emparejamiento calculado" loading state — UX polish; deferred pending performance profiling
- Level balance indicator per court card ("Nivel equilibrado") — purely display; add incrementally

---

## Out of Scope

- **Mexicano mode** — algorithm unchanged; different rotation rules; separate concern
- **Manual pairing override** — breaks partner/rest tracking guarantees; explicitly excluded
- **Penalty weight configuration UI** — implementation detail; exposing it causes confusion
- **Mid-tournament algorithm rerun from scores** — that is Mexicano mode; blurs product distinction
- **Other tournament types** (Relámpago, Mundialito, El Pozo) — unaffected
- **TypeScript migration** — out of scope

---

## Requirement Quality Notes

- **ALGO-01**: "Done" = `t.precomputedRounds` is a non-null array of length `totalRounds` stored in Firestore at `status = "playing"` transition
- **ALGO-02**: Penalty weights are named constants in `americano.js`; scoring is marginal (current round only, not cumulative)
- **ALGO-03**: Relaxation is per-round local; a round that forces a partner repeat does not disable the partner constraint for all subsequent rounds
- **ALGO-05**: Impossible-constraint check runs before the solver loop; result is a flag, not an error
- **SETUP-02**: Re-shuffle generates a new schedule and replaces `precomputedRounds[]` in local state; organizer must explicitly start the tournament to persist

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ALGO-01 | Phase 1 | — |
| ALGO-02 | Phase 1 | — |
| ALGO-03 | Phase 1 | — |
| ALGO-04 | Phase 1 | — |
| ALGO-05 | Phase 1 | — |
| SETUP-01 | Phase 3 | — |
| SETUP-02 | Phase 3 | — |
| PLAY-01 | Phase 3 | — |
| PLAY-02 | Phase 3 | — |

*(Traceability updated by roadmapper)*
