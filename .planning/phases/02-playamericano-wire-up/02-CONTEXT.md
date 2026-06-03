# Phase 2: PlayAmericano Wire-Up - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `PlayAmericano.jsx` to consume pre-calculated rounds from Phase 1 and surface two new informational panels to users. Specifically:

1. **`onNext()` wire-up** — Replace the `buildRoundAmericano()` call with a read from `t.precomputedRounds[t.roundNum]` when pre-calculated rounds exist. Maintain full backward compat for legacy tournaments (null/empty `t.precomputedRounds`) by falling back to the existing `buildRoundAmericano()` path without errors.
2. **Rest schedule panel** — A new "Descansos" tab showing all pre-calculated rounds with their sitting-out players.
3. **Warnings panel** — An admin-only panel surfacing algorithm relaxation warnings from `t.roundWarnings[]`.

**In scope:** `src/components/play/PlayAmericano.jsx` modifications only. No changes to algorithm (`americano.js`), setup flow (`SetupAmericano.jsx`), or other tournament types.

**Out of scope:** SetupAmericano UI changes (Phase 3), Mexicano mode, other tournament types.

</domain>

<decisions>
## Implementation Decisions

### Rest Schedule Panel (PLAY-02)

- **D-01:** The rest schedule lives in a new **"Descansos" tab** — the 5th tab, alongside the existing Pistas / Posiciones / Historial / Reglas tabs.
- **D-02:** Row format: one compact row per round — `R{n} — {name1}, {name2}`. The current round is visually highlighted (same active-state style as other tab/round UI in the component). Example: `R3 — Juan, María` or `R5 — Nadie descansa`.
- **D-03:** The Descansos tab is **visible to everyone** — spectators and admin alike. Rest schedule is useful information for all participants, consistent with how standings and round navigation are already public.
- **D-04:** Rounds where nobody sits out show `"Nadie descansa"` — every round has a row, so the complete schedule is scannable without gaps.
- **D-05:** The Descansos tab only appears when `t.precomputedRounds` is populated (legacy tournaments without pre-calculation don't have a rest schedule to show).

### onNext() Wire-Up (PLAY-01 / Success Criteria 1–2)

- **D-06:** When `t.precomputedRounds` is present and non-empty, `onNext()` reads `t.precomputedRounds[t.roundNum]` to get `{ courts, sittingOut }` for the next round instead of calling `buildRoundAmericano()`. Index logic: `t.roundNum` is 1-based, so `t.precomputedRounds[t.roundNum]` is the next round (0-indexed).
- **D-07:** When `t.precomputedRounds` is null or empty, `onNext()` falls back to `buildRoundAmericano()` — no UI signal, fully transparent. Legacy tournaments behave exactly as before.
- **D-08:** Score tallying, `partnerHistory`, and `sitOutHistory` updates in `onNext()` are preserved unchanged for both paths (pre-calculated and legacy). These fields remain accurate for auditing even if no longer used for round generation.

### Warnings Panel (PLAY-01)

- Not discussed — left to Claude's discretion within these constraints from requirements and Phase 1 decisions:
  - Admin-only (hidden from spectators)
  - Triggers only when `t.roundWarnings` is non-empty
  - Displays `round`, `constraint`, and `message` per warning — messages are already in Spanish from Phase 1
  - `constraint` values: `partner_repeat`, `court_repeat`, `advanced_pair`

### Claude's Discretion

- Exact Tailwind styling for the Descansos tab rows (follow existing `bg-[#1f2937]`, `rounded-2xl`, `border-gray-700` card patterns)
- Whether the Descansos tab shows a compact list or a table
- Warnings panel exact layout (collapsible, badge, inline) — must be admin-only and non-empty-gated
- How pre-calculated `courts` entries (which lack `scoreA`, `scoreB`, `saved`) are initialized when advanced to `currentRound`
- End-of-tournament detection: extend `isFinished` to also check `t.precomputedRounds && t.roundNum > t.precomputedRounds.length` when pre-calculated rounds exist

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary implementation file
- `src/components/play/PlayAmericano.jsx` — Full component. `onNext()` at line 75 is the primary integration point; `buildRoundAmericano()` call at line 114 is what gets replaced. Tabs component usage at line 172 shows how to add a 5th tab. Round-tabs row at line 219 and `FutureRound` component at line 696 show existing precomputedRounds patterns.

### Algorithm and state
- `src/logic/americano.js` — Defines `buildRoundAmericano()` (legacy fallback) and `precomputeAllRounds()` (Phase 1 output). Read to understand return shapes: `buildRoundAmericano` returns `{ courts, sittingOut }`, same shape as each entry in `precomputedRounds`.
- `src/logic/initTournament.js` — Tournament state shape. Verify `precomputedRounds`, `roundWarnings`, `roundNum` field initialization.
- `src/hooks/useTournament.js` — `persist()` with `{ merge: true }` contract. No changes in Phase 2, but all persists in `onNext()` must continue using this.

### Phase 1 context (decisions that Phase 2 consumes)
- `.planning/phases/01-core-penalty-engine/01-CONTEXT.md` — D-09 (warnings format), D-10 (`t.roundWarnings` top-level field), D-11 (constraint string values). Phase 2 displays what Phase 1 produces.

### Requirements
- `.planning/REQUIREMENTS.md` — PLAY-01 and PLAY-02 are the requirements for this phase. Traceability table at bottom.

### Shared components
- `src/components/shared/Components.jsx` — `Tabs` component (used to add the new Descansos tab), `THeader`, `SimpleModal`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FutureRound` (line 696 in `PlayAmericano.jsx`) — Already renders a pre-calculated round's courts in read-only mode. The Descansos tab's row data comes from the same `t.precomputedRounds` array — different rendering, same source.
- `HistoryRound` (line 614) — Read-only round display pattern. Descansos is even simpler (just names + round numbers, no court cards).
- `Tabs` component — Already used at line 172 with 4 entries; adding a 5th entry `["descansos", "💤 Descansos"]` follows the same pattern.
- Sitting-out display pattern (line 472) — The `⏳ Descansan: {names}` yellow pill is the established UI for showing resting players. Descansos tab rows can reuse this styling.

### Established Patterns
- `t.precomputedRounds` guard: multiple places already check `t.precomputedRounds` before using it (line 167, 219, 289). `onNext()` wire-up must follow the same guard pattern.
- `t.roundNum` is 1-based: round 1 = `t.precomputedRounds[0]`, current next round = `t.precomputedRounds[t.roundNum]`.
- Mobile-first max-width: `max-w-lg mx-auto` wrapping in `CourtsAmericano` (line 471). Descansos tab should follow the same constraint.
- Inline styles for dynamic colors (level badges, format colors) — Tailwind classes for everything else.

### Integration Points
- `onNext()` line 114: the `buildRoundAmericano()` call. This is the only place that changes for the wire-up. Everything before it (score tally, `nh`, `nso` updates) and everything after it (persist call) remain unchanged.
- Tabs array at line 173: add `["descansos", "💤 Descansos"]` and a new `{tab === "descansos" && ...}` conditional block.
- `isFinished` at line 144: may need to extend for pre-calculated end-of-schedule detection.

</code_context>

<specifics>
## Specific Ideas

- Row label: `R{n} — {name}` format confirmed (e.g. `R3 — Juan, María` or `R5 — Nadie descansa`)
- Descansos tab is conditional on `t.precomputedRounds` being populated — legacy tournaments skip it entirely
- Warnings panel: user left format to Claude, but it should be admin-only and non-empty-gated

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-PlayAmericano Wire-Up*
*Context gathered: 2026-06-03*
