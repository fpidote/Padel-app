# Phase 1: Core Penalty Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 1-Core Penalty Engine
**Areas discussed:** bestSplit upgrade, Court grouping, Relaxation thresholds, warnings[] format

---

## bestSplit Upgrade

| Option | Description | Selected |
|--------|-------------|----------|
| New function alongside (scoredSplit) | Create scoredSplit(g, state, weights); bestSplit stays unchanged | ✓ |
| Extend bestSplit with optional weights | bestSplit(g, ph, weights?) — backward-compatible | |
| Replace bestSplit entirely | Mexicano also gets level penalty | |

**User's choice:** New function alongside (scoredSplit)
**Notes:** Mexicano isolation was the deciding factor. bestSplit must not change signature.

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 penalties from spec | courtHistory added to state; full penalty scoring from day 1 | ✓ |
| Partner + level only first | Ship without courtHistory, add court penalty later | |

**User's choice:** All 4 penalties from spec (courtHistory included from day 1)

---

## Court Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Level-sorted every round | Sort by level desc, split top/bottom — same as buildFirstRound | |
| Rest-balanced first, level as tiebreaker | Sort by soh asc, break ties by level desc | |
| Rotate by round | Odd rounds: level-sorted; Even rounds: rest-balanced | |

**User's choice:** None of the above — user raised concern about overfitting

**Notes:** User observed that consistent level-sorted grouping constrains which players ever get evaluated together, reducing variety and leaving the engine with fewer degrees of freedom.

Follow-up question:

| Option | Description | Selected |
|--------|-------------|----------|
| Rest-balanced primary, level as tiebreaker | Natural variety per round since rest counts change | |
| Level-sorted + shuffle within same level | Sort by level first, shuffle players of the same level | ✓ |
| Penalty-guided greedy grouping | Evaluate multiple candidate groupings with scoring engine | |

**User's choice:** Level-sorted + shuffle within same level
**Notes:** Provides variety without losing level-separation. Each tournament run generates different schedules even with identical player configurations.

---

## Relaxation Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Named constants, tune after testing | RELAX_THRESHOLDS = [2000, 6000, 15000] — easy to adjust | ✓ |
| Derived from penalty weights | Auto-scales if weights change | |
| Ship with defaults, review after real tournament | Conservative defaults, adjust from data | |

**User's choice:** Named constants, tune after testing

| Option | Description | Selected |
|--------|-------------|----------|
| Use (2000/6000/15000) | Research-suggested starting values | ✓ |
| Start stricter (1000/4000/10000) | Less forgiving early | |
| Start more lenient (3000/8000/20000) | More breathing room for large groups | |

**User's choice:** Use (2000/6000/15000) as starting point

---

## warnings[] Format

| Option | Description | Selected |
|--------|-------------|----------|
| Object with round + constraint + message | { round, constraint, message } — structured for filtering | ✓ |
| Simple string array | ['R3: partner repeat allowed'] — simplest | |
| One warning per round object | Co-located with precomputedRounds[] data | |

**User's choice:** Object with round + constraint + message

| Option | Description | Selected |
|--------|-------------|----------|
| Persist to Firestore as t.roundWarnings[] | Accessible in any session | ✓ |
| In-component only | Not persisted — lost on reload | |
| Inside precomputedRounds metadata | Co-located, persisted as part of rounds array | |

**User's choice:** Persist to Firestore as t.roundWarnings[] (separate field)
**Notes:** Messages in Spanish for the admin-facing display. `constraint` field is English string for filtering.

---

## Claude's Discretion

- Exact shuffle implementation (Fisher-Yates or Math.random sort)
- `PENALTY` constant naming and export style
- Internal helper function names beyond `scoredSplit` and `precomputeAllRounds`
- Number of retry attempts per relaxation level

## Deferred Ideas

None — discussion stayed within phase scope.
