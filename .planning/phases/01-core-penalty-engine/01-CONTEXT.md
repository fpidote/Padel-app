# Phase 1: Core Penalty Engine - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the body of `precomputeAllRounds()` in `src/logic/americano.js`. This is a pure function that takes players + config and returns a complete pre-calculated tournament schedule: an array of rounds, each with court assignments and sitting-out players, optimized using a penalty-based scoring system that enforces skill-level balance, partner rotation, court rotation, and rest fairness.

**In scope:** Algorithm body only. New `scoredSplit()` function. `courtHistory` state. `PENALTY` and `RELAX_THRESHOLDS` constants. `warnings[]` output as `t.roundWarnings[]` field in Firestore. Impossible-constraint detection.

**Out of scope:** UI changes (Phase 3), `onNext()` wiring (Phase 2), Mexicano mode, `buildRoundAmericano()` changes, `buildFirstRoundAmericano()` changes.

</domain>

<decisions>
## Implementation Decisions

### bestSplit Integration

- **D-01:** Create a new `scoredSplit(group, state, weights)` function **alongside** the existing `bestSplit()`. Do NOT modify `bestSplit()`. Mexicano calls `buildRoundAmericano()` → `bestSplit()` — that path stays completely isolated and unchanged.
- **D-02:** `scoredSplit()` evaluates all 4 penalties from day 1: PARTNER_REPEAT, ADVANCED_PAIR, COURT_REPEAT, REST_IMBALANCE. `courtHistory` is a new state field added alongside `partnerHistory`.
- **D-03:** `precomputeAllRounds()` uses `scoredSplit()` exclusively. `buildRoundAmericano()` and `buildFirstRoundAmericano()` continue using `bestSplit()` unchanged.

### Court Grouping Strategy

- **D-04:** Group players into courts using **level-sorted primary (desc), then shuffle within same-level group** before splitting into courts. Sort all players by `level` descending, then within each level group apply a random shuffle. This gives the penalty engine variety to work with while keeping level separation intact.
- **D-05:** During pre-calculation, `pts = 0` for all players — do NOT use score-based sorting. Use `soh` (rest count) only for sitting-out selection, not for court grouping.

### Relaxation Thresholds

- **D-06:** Define relaxation thresholds as named constants exported from `americano.js`:
  ```
  export const RELAX_THRESHOLDS = [2000, 6000, 15000];
  ```
  - Attempt 0 (strict): total penalty ≤ 2000 → accept
  - Attempt 1 (relax court): total penalty ≤ 6000 → accept
  - Attempt 2 (relax partner): total penalty ≤ 15000 → accept
  - Attempt 3 (allow Advanced pairing): threshold = Infinity → always accept
- **D-07:** Thresholds are starting values for tuning after real tournament testing. They are constants (not computed), easy to adjust.
- **D-08:** Relaxation flags are local variables inside the round-building loop — never mutate global state. Each round starts from strict.

### warnings[] Format and Persistence

- **D-09:** Each warning is a structured object: `{ round: number, constraint: string, message: string }`. Example: `{ round: 3, constraint: 'partner_repeat', message: 'Ronda 3: repetición de pareja permitida (sin combinación válida disponible)' }`.
- **D-10:** `warnings[]` is persisted to Firestore as a **separate top-level field** `t.roundWarnings` (not nested inside `precomputedRounds`). Accessible in any session, not just the session that generated it.
- **D-11:** `constraint` values are a fixed set of strings: `'partner_repeat'`, `'court_repeat'`, `'advanced_pair'`. This enables filtering in Phase 2 display.

### Impossible-Constraint Detection

- **D-12:** Before the solver loop, check `if (advancedCount >= 2 * courtsCount)` — when true, set a local `advancedPairingAllowed = true` flag and exclude ADVANCED_PAIR from penalty scoring for the entire tournament. Log a warning when this fires.
- **D-13:** Level is confirmed as integer 0–3 where `level >= 3` = Advanced (verified in `highLevelClash` in existing code). Use `(p.level || 0) >= 3` as the Advanced check.

### Claude's Discretion

- Exact shuffle implementation (Fisher-Yates or `sort(() => Math.random() - 0.5)`) — either is fine
- `PENALTY` constant naming and export style — follow existing `americano.js` conventions
- Internal helper function names beyond `scoredSplit` and `precomputeAllRounds`
- How many retry attempts per relaxation level (1 attempt per level is the simplest correct approach)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core implementation files
- `src/logic/americano.js` — Contains `precomputeAllRounds()` stub to replace, existing `bestSplit()`, `buildRoundAmericano()`, `highLevelClash()`, `pk()` usage, `soh` pattern. Read entirely before touching.
- `src/logic/utils.js` — Contains `pk()` function used for partner history keys. Verify separator character before adding `courtHistory` keys.

### State and schema
- `src/logic/initTournament.js` — Defines tournament state shape. Verify where `precomputedRounds` and `roundWarnings` fields would be initialized.
- `src/hooks/useTournament.js` — Defines `persist()` with `{ merge: true }` contract. New `roundWarnings` field is persisted alongside `data`.

### Project requirements and decisions
- `.planning/REQUIREMENTS.md` — ALGO-01 through ALGO-05 are the requirements for this phase
- `.planning/research/STACK.md` — Algorithm approach, performance constraints, no Web Worker
- `.planning/research/PITFALLS.md` — Critical pitfalls: impossible constraints, permutation explosion, global vs per-round relaxation scope, cumulative vs marginal scoring, pk() key collisions

### Setup context (read-only, no changes in Phase 1)
- `src/components/setup/SetupAmericano.jsx` — Shows how `level` field is set (integers 0–3, cycling via `% 4`), `useLevels` toggle, how `precomputeAllRounds()` is called

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bestSplit(g, ph)` — Evaluates 3 pair-split options per group of 4. `scoredSplit()` is a new function with the same 3-split evaluation logic but configurable penalty weights. Do not duplicate the split enumeration logic — factor it out or mirror the pattern.
- `pk(a, b)` in `utils.js` — Canonical key for partner pairs. Use the same function for `courtHistory` keys (e.g., `` `${p.id}_c${courtIndex}` `` pattern as noted in research).
- `soh` object pattern — Already in `precomputeAllRounds()` for rest-count tracking. Extend with `courtHistory` using the same plain-object pattern.
- `highLevelClash(pair)` — Existing function using `level >= 3`. Phase 1 can reference or inline this logic in `scoredSplit()`.

### Established Patterns
- **Plain objects as hash maps** — `partnerHistory`, `soh` all use `{}` (not Map or Set). `courtHistory` must follow the same pattern.
- **Marginal scoring only** — Current `bestSplit` scores only the current pair candidates. Phase 1 must score the **current round only** — not accumulate across all previous rounds.
- **`precomputeAllRounds` is a pure function** — takes entities + config, returns array. No side effects, no Firestore calls. Tests can call it directly.
- **Existing `soh` initialization** — `let soh = {}` then `soh[p.id] = (soh[p.id] || 0) + 1`. Mirror this for `courtHistory`.

### Integration Points
- `precomputeAllRounds(entities, config)` — same signature, same export. Drop-in replacement body.
- Return type: currently `Array<{ courts, sittingOut }>` — Phase 1 preserves this shape and adds `roundWarnings` as a **separate return value** or handled by the caller in `SetupAmericano`.
- `SetupAmericano.onStart()` calls `precomputeAllRounds()` — the call site persists `t.precomputedRounds`. Phase 1 must also persist `t.roundWarnings` at the same time (or return it alongside for the caller to persist).

</code_context>

<specifics>
## Specific Ideas

- User concern: level-sorted grouping every round causes "overfitting" where Advanced players always see the same partners → resolved by shuffling within same-level groups (D-04).
- Messages in Spanish: `constraint` is an English key for filtering; `message` field should be in Spanish for the admin-facing display in Phase 2 (e.g., `"Ronda 3: repetición de pareja permitida"`).
- `roundWarnings` is a flat array on `t` (not nested per round) — simpler for Phase 2 to filter by `round` number.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Core Penalty Engine*
*Context gathered: 2026-06-03*
