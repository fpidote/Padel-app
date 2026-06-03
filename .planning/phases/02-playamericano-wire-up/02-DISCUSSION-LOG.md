# Phase 2: PlayAmericano Wire-Up - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 2-PlayAmericano Wire-Up
**Areas discussed:** Rest schedule panel

---

## Area Selection

| Area | Selected |
|------|----------|
| Rest schedule panel | ✓ |
| Warnings panel format | (not selected — left to Claude's discretion) |

---

## Rest Schedule Panel

### Q1: Where should the panel live?

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Descansos' tab | 5th tab alongside Pistas/Posiciones/Historial/Reglas. Clean separation. | ✓ |
| Collapsible section inside Pistas tab | Below court cards, toggled. Avoids new tab but requires scrolling. | |
| Inline at top of Pistas tab | Compact strip always visible above court cards. | |

**User's choice:** New 'Descansos' tab
**Notes:** None provided.

---

### Q2: What format should each row use?

| Option | Description | Selected |
|--------|-------------|----------|
| Round number + names | One row per round: 'R3 — Juan, María'. Compact. | ✓ |
| Round number + names + courts preview | Adds court pairings alongside who rests. Much taller. | |
| You decide | Leave to planner. | |

**User's choice:** Round number + names (compact one-liner per round)
**Notes:** Current round to be highlighted.

---

### Q3: Visible to everyone or admin-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone | Spectators also see it. Consistent with public standings. | ✓ |
| Admin-only | Rest schedule as algorithm detail for organizer only. | |

**User's choice:** Everyone

---

### Q4: Rounds where nobody sits out?

| Option | Description | Selected |
|--------|-------------|----------|
| Show 'Nadie descansa' | Every round has a row. Completeness is obvious. | ✓ |
| Skip empty rounds | Only show rounds with actual sit-outs. Creates gaps. | |
| You decide | Leave to planner. | |

**User's choice:** Show 'Nadie descansa' — every round has a row.

---

## Claude's Discretion

- **Warnings panel (PLAY-01):** User did not select this area. Claude has full discretion on format and placement, constrained only by: admin-only, triggered only when `t.roundWarnings` is non-empty, and must display `round`, `constraint`, and `message` per warning.
- **Descansos tab exact styling:** Tailwind patterns — follow existing card/panel conventions in the component.
- **Pre-calculated courts initialization:** Adding `scoreA`, `scoreB`, `saved` fields when taking `precomputedRounds[].courts` into `currentRound`.
- **`isFinished` extension:** Whether and how to extend the end-of-tournament check for pre-calculated schedules.

## Deferred Ideas

None — discussion stayed within phase scope.
