# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Organizer starts Americano Clásico and every player gets fair, level-aware matchups from round 1 through the final round — no manual intervention.
**Current focus:** Phase 1 — Core Penalty Engine

## Current Position

Phase: 1 of 3 (Core Penalty Engine)
Plan: 0 of 1 in current phase
Status: Ready to execute
Last activity: 2026-06-03 — Phase 1 planned; 1 plan in 1 wave

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-calculation: All rounds computed upfront via `precomputeAllRounds()` stub — body to be implemented in Phase 1
- Level constraint: Only enforced when mathematically satisfiable (`advancedCount < 2 * courts`)
- Relaxation scope: Per-round local flags only — never global state mutation
- Penalty weights: PARTNER_REPEAT=1000, ADVANCED_PAIR=5000, COURT_REPEAT=500, REST_IMBALANCE=2000

### Pending Todos

None yet.

### Blockers/Concerns

- Open question: Verify actual integer scale for `p.level` in SetupAmericano before implementing penalty function (research notes `p.level >= 3` as inferred threshold)
- Open question: Decide if `warnings[]` persists to Firestore or is computed in-component gated by `isAdmin` (in-component is simpler)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Level distribution summary at setup | Deferred | Init |
| v2 | "Emparejamiento calculado" loading state | Deferred | Init |
| v2 | Level balance indicator per court card | Deferred | Init |

## Session Continuity

Last session: 2026-06-03
Stopped at: Roadmap and state initialized. No plans written yet.
Resume file: None
