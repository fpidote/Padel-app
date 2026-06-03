# Padeldesk — Americano Clásico Level-Aware Matchmaking

## What This Is

Padeldesk is a real-time padel tournament organizer. This project upgrades the **Americano Clásico** sub-mode with a pre-calculated, level-aware matchmaking engine. Instead of generating rounds one at a time, all rounds are computed upfront using a penalty-based scoring system that enforces skill-level balance, partner rotation, court rotation, and rest fairness across the full tournament.

## Core Value

A tournament organizer can start an Americano Clásico and trust that every player — regardless of level — will face fair matchups from round 1 through the final round, without manual intervention.

## Requirements

### Validated

These capabilities already exist in the codebase and are preserved:

- ✓ Players enter name and level (Advanced / Intermediate / Beginner / Unrated) in SetupAmericano — existing
- ✓ Round-by-round matchmaking generates courts and sitting-out players — existing (`src/logic/americano.js`)
- ✓ Partner history tracked across rounds (`partnerHistory` map) — existing
- ✓ Score input and save per court — existing (`PlayAmericano`)
- ✓ Round advancement with optimistic persist — existing (`useTournament`)
- ✓ Sitting-out player tracking and rotation — existing

### Active

- [x] Pre-calculate all rounds upfront before tournament starts — Validated in Phase 1 (2026-06-03)
- [x] Penalty-based scoring: pairing repeat (+1000), Advanced+Advanced pair (+5000), court repeat (+500), rest imbalance (+2000) — Validated in Phase 1 (2026-06-03)
- [x] No Advanced+Advanced partnerships enforced in initial rounds (level constraint) — Validated in Phase 1 (2026-06-03)
- [x] Dynamic relaxation when strict constraints deadlock: court repeat → partner repeat → Advanced pairing — Validated in Phase 1 (2026-06-03)
- [x] Rest rotation enforcement — no player rests twice before all have rested once — Validated in Phase 1 (2026-06-03)
- [x] Constraint deadlock fallback: prioritize match completion over rule enforcement — Validated in Phase 1 (2026-06-03)
- [ ] Last-round completeness: final round never leaves rest distribution violated
- [ ] Support all player counts from 8 to 24+ without quality degradation
- [ ] SetupAmericano UI validates level assignments before allowing round generation
- [ ] PlayAmericano shows pre-calculated rounds and rest schedule
- [ ] Mexicano mode unchanged

### Out of Scope

- Mexicano level-aware algorithm — same engine does not apply to Mexicano (user decision)
- Other tournament types (Relámpago, Mundialito, El Pozo) — unaffected
- TypeScript migration — project stays JavaScript
- Server-side computation — algorithm runs client-side at tournament start

## Context

**Existing branch:** `feat/americano-balanced-matchmaking` — prior iteration already separates Advanced players across courts and balances teams. This project supersedes that approach with a fully pre-calculated, penalty-scored engine.

**Current algorithm:** `src/logic/americano.js` — computes one round at a time via `buildRoundAmericano()`. Partner history (`partnerHistory`) and sitting-out tracking exist but level data is not used in matchmaking decisions.

**Level data already present:** `SetupAmericano` already collects `level` per player. The data exists — the algorithm just doesn't use it yet.

**Tournament flow:** Setup → Start (all rounds pre-calculated) → Play (round-by-round score input, advancing through pre-calculated schedule).

## Constraints

- **Tech stack**: JavaScript ES2022, React 18, Firebase Firestore, Tailwind CSS v4 — no deviations
- **No TypeScript** — project stays JS until explicit team decision
- **Firestore persist**: Always `{ merge: true }` — required to preserve `ownerUid` and `createdAt`
- **Client-side only**: No backend computation — algorithm must run in-browser at tournament start
- **Performance**: Pre-calculation for 24 players must complete fast enough not to block the UI thread (consider chunking or Web Worker if needed)
- **Scope boundary**: Clásico sub-mode only — Mexicano unchanged

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pre-calculate all rounds upfront | Enables rest schedule display, guarantees fairness before first ball is hit | — Pending |
| Penalty weights: pair=1000, level=5000, court=500, rest=2000 | Level constraint most critical; rest fairness > partner variety > court variety | — Pending |
| Relaxation order: court → partner → Advanced pairing | Degrade gracefully; Advanced pairing last resort | — Pending |
| Clásico only, not Mexicano | Mexicano has different rotation rules; keeps scope tight | ✓ Decided |
| Algorithm stays client-side | No backend; simpler architecture; acceptable for ≤32 players | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-03 after initialization*
