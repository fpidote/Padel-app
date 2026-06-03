# Roadmap: Americano Clásico Level-Aware Matchmaking

## Overview

Three focused phases upgrade the Americano Clásico sub-mode from on-the-fly round generation to a fully pre-calculated, penalty-scored, level-aware engine. Phase 1 builds the algorithm core in `americano.js`. Phase 2 wires the play interface to consume pre-calculated data. Phase 3 adds setup validation and UX polish. Each phase is independently shippable and backward-compatible.

## Phases

- [ ] **Phase 1: Core Penalty Engine** - Implement level-aware greedy engine with penalty scoring, relaxation, and warnings output in `americano.js`
- [ ] **Phase 2: PlayAmericano Wire-Up** - Connect `PlayAmericano.jsx` to pre-calculated rounds and surface warnings/rest schedule panels
- [ ] **Phase 3: Setup Validation and UX** - Add level validation gate and re-shuffle button to `SetupAmericano.jsx`

## Phase Details

### Phase 1: Core Penalty Engine
**Goal**: The algorithm pre-calculates all rounds upfront with penalty-scored, level-aware matchmaking
**Mode:** mvp
**Depends on**: Nothing (brownfield — scaffolding already exists)
**Requirements**: ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05
**Success Criteria** (what must be TRUE):
  1. Calling `precomputeAllRounds(players, courts, rounds)` returns a non-null array of length `totalRounds` with valid court assignments and `sittingOut` lists
  2. No Advanced+Advanced pairing appears in the output when `advancedCount < 2 * courts` (mathematically satisfiable constraint)
  3. When `advancedCount >= 2 * courts`, the algorithm detects the impossible constraint, disables the ADVANCED_PAIR penalty, and continues without throwing
  4. The returned value includes a `warnings[]` array that describes each round where a constraint was relaxed and which constraint was relaxed
  5. Running the engine for 24 players completes without blocking the UI (under 50ms in-browser)
**Plans**: 1 plan

Wave 1 *(all tasks atomic — algorithm body + call site update must ship together)*:
- [ ] 01-01-PLAN.md — Penalty engine constants + helpers + precomputeAllRounds() body + SetupAmericano call site update

### Phase 2: PlayAmericano Wire-Up
**Goal**: PlayAmericano renders from pre-calculated rounds and surfaces algorithm output to the organizer
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PLAY-01, PLAY-02
**Success Criteria** (what must be TRUE):
  1. When `t.precomputedRounds` is populated, `onNext()` advances by reading `t.precomputedRounds[t.roundNum]` instead of calling the on-demand builder
  2. When `t.precomputedRounds` is null or empty (legacy tournament), `onNext()` falls back to the previous behavior without errors
  3. An admin-only warnings panel appears when `warnings[]` is non-empty, listing which rounds had relaxed constraints and why
  4. A rest schedule panel shows all rounds at a glance with the sitting-out player(s) per round, readable on a 390px mobile screen
**Plans**: TBD

### Phase 3: Setup Validation and UX
**Goal**: SetupAmericano guides the organizer through level assignment before allowing tournament start
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SETUP-01, SETUP-02
**Success Criteria** (what must be TRUE):
  1. When `useLevels=ON` and every player has level "Unrated", a visible warning appears before the start button — organizer can dismiss and proceed (soft warning, not a hard block)
  2. After initial pre-calculation, a re-shuffle button is visible; clicking it re-runs `precomputeAllRounds()` and replaces the schedule in local state without persisting to Firestore
  3. The re-shuffle button is absent (or disabled) once the tournament status has moved to "playing"
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Penalty Engine | 0/1 | Not started | - |
| 2. PlayAmericano Wire-Up | 0/? | Not started | - |
| 3. Setup Validation and UX | 0/? | Not started | - |
