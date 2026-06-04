# Player Filter — All-Rounds View

**Date:** 2026-06-04  
**Formats affected:** Americano, El Pozo  
**Status:** Approved

---

## Problem

When filtering by player in the Courts tab, the user must navigate round tabs one by one to see each match. The intent of filtering — "show me everything about this player" — is not fulfilled.

## Goal

When a player is selected in the filter, automatically show all rounds stacked vertically on one page, each displaying only that player's match. Deselecting the filter restores the normal single-round + tabs view.

---

## Behavior

### Trigger

Selecting any option other than "Todos los jugadores" in the filter dropdown activates the all-rounds view. Selecting "Todos" restores the default view.

### Round list order

1. Past rounds (`t.rounds` / `t.pozoRounds`) — completed, read-only
2. Current round in progress — editable for admin, read-only for guests
3. Future precomputed rounds (`t.precomputedRounds`, Americano only) — read-only

### Per-round card

- Each round shows a header: `RONDA N` + status indicator (completed / en curso / próximamente)
- If the player sat out that round: show a "Descansó" badge instead of a match card
- If no rounds exist yet: show an empty state ("Aún no hay rondas")
- The filtered player's name is rendered in **bold** in every match card

### Admin vs guest

- **Admin:** current round shows inline score inputs + Guardar button, reusing existing `onSave` / `onEdit` handlers
- **Guest:** current round shows scores in read-only display

### Round tabs

Round tabs (R1, R2, R3…) are hidden while a player filter is active.

---

## Implementation

### Americano (`PlayAmericano.jsx`)

- Filter state and `matchesSearch` already exist — no changes to that logic
- In the Courts tab render: add a conditional branch on `search !== null`
  - `search === null` → existing behavior (round tabs + single round)
  - `search !== null` → render `<AllRoundsPlayerView>`
- `<AllRoundsPlayerView>` (new component, defined inside `PlayAmericano.jsx`):
  - Past rounds: reuse existing `<HistoryRound rounds={t.rounds} matchesSearch={matchesSearch} ...>`
  - Current round: new `<FilteredCurrentRound>` sub-component
    - Admin: score inputs per filtered court + Guardar button (calls `onSave(ci)`)
    - Guest: read-only score display
  - Future rounds: reuse existing `<FutureRound>` per precomputed round > `t.roundNum`
- Player name bold: apply `font-bold` class to player name spans in `HistoryRound`, `FutureRound`, and `FilteredCurrentRound` when rendering the filtered player's name

### El Pozo (`PlayPozo.jsx`)

- Add `search` state (null | string ID)
- Add `allPozoEntities` computed list:
  - `pozoMode === "fixed"` → `t.pairs` sorted by name
  - `pozoMode === "mixer"` → `t.players` sorted by name
- Add `matchesPozoSearch(court)`:
  - Fixed: match `court.pairA.id` or `court.pairB.id`
  - Mixer: match `court.pairA._playerIds` or `court.pairB._playerIds` contains the selected player ID
- Render filter dropdown in Courts tab (same style as Americano)
- When `search !== null`: render all-rounds view
  - Past rounds from `t.pozoRounds` — read-only
  - Current round from `t.currentPozoRound` — admin-editable / guest-readonly
  - Reuses same `FilteredCurrentRound` pattern (adapted for pozo court structure)
- When `search === null`: existing behavior unchanged

---

## Out of scope

- Relámpago and Mundialito (not in this iteration)
- Persisting the selected filter across page reloads
- Showing standings impact per round in the filtered view
