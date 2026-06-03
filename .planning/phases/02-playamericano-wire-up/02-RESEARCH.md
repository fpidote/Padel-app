# Phase 2: PlayAmericano Wire-Up — Research

**Researched:** 2026-06-03
**Domain:** React component integration — PlayAmericano.jsx wiring to precomputedRounds / roundWarnings
**Confidence:** HIGH — all findings verified from live codebase; no external dependencies

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rest schedule in a new "Descansos" tab — 5th tab alongside existing four.
- **D-02:** Row format: `R{n} — {name1}, {name2}` (e.g. `R3 — Juan, María` or `R5 — Nadie descansa`). Current round visually highlighted.
- **D-03:** Descansos tab visible to everyone (spectators and admin).
- **D-04:** Every round has a row; rounds with nobody sitting out show `"Nadie descansa"`.
- **D-05:** Descansos tab only appears when `t.precomputedRounds` is populated.
- **D-06:** `onNext()` reads `t.precomputedRounds[t.roundNum]` (0-indexed, since roundNum is 1-based) when precomputedRounds is present and non-empty.
- **D-07:** Fallback to `buildRoundAmericano()` when `t.precomputedRounds` is null/empty — no UI signal.
- **D-08:** Score tallying, `partnerHistory`, `sitOutHistory` updates preserved unchanged for both paths.

### Claude's Discretion

- Exact Tailwind styling for Descansos tab rows.
- Compact list vs. table for Descansos tab.
- Warnings panel exact layout (collapsible, badge, inline) — must be admin-only and non-empty-gated.
- How pre-calculated `courts` entries (lacking `scoreA`, `scoreB`, `saved`) are initialized when advanced to `currentRound`.
- End-of-tournament detection: extend `isFinished` to also check `t.precomputedRounds && t.roundNum > t.precomputedRounds.length`.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | Relaxation warnings panel (admin-only) — displays which rounds had constraints relaxed, consumed from `t.roundWarnings[]` | `t.roundWarnings` is a flat array on `t` (inside `data` JSON). Field confirmed present and populated in SetupAmericano.onStart(). Each entry: `{ round, constraint, message }`. |
| PLAY-02 | Rest schedule panel — shows all pre-calculated rounds with sitting-out players per round, consumed from `t.precomputedRounds[].sittingOut` | `t.precomputedRounds` confirmed present. Each entry is `{ courts, sittingOut }`. `sittingOut` is an array of Player objects with `.name` field. |

</phase_requirements>

---

## Summary

Phase 2 is a surgical integration inside a single 780-line file (`PlayAmericano.jsx`). All algorithm work was completed in Phase 1; this phase wires the already-persisted data to the UI. Three discrete changes are needed: (1) replace the `buildRoundAmericano()` call in `onNext()` with a precomputed-rounds lookup, (2) add a "Descansos" 5th tab rendering the full rest schedule, and (3) surface `t.roundWarnings[]` in an admin-only panel.

The codebase is well-prepared. Phase 1 left `t.precomputedRounds` and `t.roundWarnings` in the persisted state with the exact shapes Phase 2 needs. The component already has guard patterns for `t.precomputedRounds`, an existing `FutureRound` component that reads the same data, and a Tabs component that trivially accepts a 5th entry.

The highest integration risk is the `isFinished` condition and the court-object shape mismatch between pre-calculated rounds (courts with `scoreA: "", scoreB: "", saved: false`) and what `onNext()` currently assigns to `currentRound`. Both are addressed in detail below.

**Primary recommendation:** Follow the three-change approach in strict order — onNext() wire-up first (PLAY-01 partial), then Descansos tab (PLAY-02), then Warnings panel (PLAY-01 completion). Each is independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pre-calculated round lookup in onNext() | Frontend (client-side React) | — | Pure in-memory read from `t` state; no server call |
| Descansos tab rendering | Frontend (client-side React) | — | Display-only; data already in `t.precomputedRounds` |
| Warnings panel rendering | Frontend (client-side React) | — | Display-only; data already in `t.roundWarnings` |
| `isFinished` detection extension | Frontend (client-side React) | — | Derived from `t.roundNum` vs `t.precomputedRounds.length` |
| Persist after onNext() | Firebase/Firestore | useTournament hook | Already handled by existing `persist()` — no changes needed |

---

## Standard Stack

No new packages required. Phase 2 is entirely within the existing stack.

| Technology | Version | Role in Phase 2 |
|-----------|---------|-----------------|
| React | 18.3.1 | Hooks, component state |
| Tailwind CSS v4 | via Vite plugin | Styling new tab content |
| Firebase Firestore | 12.x | `persist()` via `useTournament` — unchanged |

**No npm installs needed for this phase.**

---

## Package Legitimacy Audit

Not applicable — no new packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
t (Firestore state, loaded by useTournament)
│
├── t.precomputedRounds: Array<{ courts, sittingOut }>  ← Phase 1 produced
├── t.roundWarnings:     Array<{ round, constraint, message }>  ← Phase 1 produced
├── t.roundNum:          number (1-based, starts at 1)
├── t.currentRound:      Array<court objects with scoreA/B/saved>
├── t.sittingOut:        Array<Player>
└── t.partnerHistory:    { [pk]: count }

PlayAmericano.jsx
├── onNext()                 ← Change 1: read precomputedRounds[roundNum] instead of buildRoundAmericano()
├── isFinished               ← Extend: also check roundNum > precomputedRounds.length
├── Tabs (4 → 5 tabs)        ← Change 2: add "descansos" entry
│   ├── courts tab
│   ├── standings tab
│   ├── history tab
│   ├── rules tab
│   └── descansos tab (new) ← Renders precomputedRounds rows with R{n} — names format
└── Warnings panel (new)     ← Change 3: admin-only, gated on roundWarnings.length > 0
```

### Recommended Structure for New JSX

```
PlayAmericano (root component)
├── onNext() — modified (lines 75–136)
├── isFinished — modified (line 144)
├── Tabs — modified (line 172–180, add 5th tab)
├── {tab === "descansos"} block — new (after existing tab blocks)
└── {isAdmin && t.roundWarnings?.length > 0} warnings banner — new (inside courts tab or top of component)
```

---

## Complete onNext() Body Analysis

**[VERIFIED: live codebase read]**

`onNext()` spans lines 75–136. Here is a complete line-by-line map:

```
Line 76:  Guard — bail if not all courts saved
Line 77:  isPairs = t.config.mode === "pairs"
Line 78:  entityKey = "pairs" | "players"
Line 79:  np = shallow-copy of all players/pairs
Line 80:  nh = copy of t.partnerHistory
Line 81:  nso = copy of t.sitOutHistory
Lines 82–84:  nso accumulation — sittingOut players get +1 rest count
Lines 85–112: Score tally loop over t.currentRound courts
  - Lines 89–96:  pairs mode — pts/gf/gc per pair
  - Lines 98–111: individual mode — nh update (pk), pts/gf/gc per player
LINE 114:  >>> const { courts: nc, sittingOut: nSit } = buildRoundAmericano(np, t.config.courts, nh, nso, t.config.mode);
           THIS IS THE ONLY LINE THAT CHANGES FOR THE WIRE-UP.
Lines 121–135: Persist call
  - newRounds: append current round to t.rounds
  - setLs({}) — clear local score inputs
  - persist({ ...t, [entityKey]: np, rounds: newRounds, currentRound: nc, sittingOut: nSit,
               partnerHistory: nh, sitOutHistory: nso, roundNum: t.roundNum + 1 })
```

**Critical insight:** Everything before line 114 (score tally, nh, nso) and everything after it (persist call) is preserved exactly as-is for both paths (D-08). Only line 114 changes.

### Wire-Up Pattern for onNext() [VERIFIED: CONTEXT.md D-06, D-07]

```js
// Replace line 114 with:
let nc, nSit;
if (t.precomputedRounds?.length && t.precomputedRounds[t.roundNum]) {
  // Pre-calculated path: read next round (roundNum is 1-based, so [roundNum] is the next round 0-indexed)
  const preRound = t.precomputedRounds[t.roundNum];
  nc = preRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
  nSit = preRound.sittingOut;
} else {
  // Legacy fallback: generate round on-the-fly
  ({ courts: nc, sittingOut: nSit } = buildRoundAmericano(np, t.config.courts, nh, nso, t.config.mode));
}
```

**The `scoreA/scoreB/saved` re-initialization is required.** Pre-calculated courts already have `scoreA: "", scoreB: "", saved: false` from Phase 1 (`americano.js` line 192: `{ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false }`). However, spreading with overrides (`...c, scoreA: "", scoreB: "", saved: false`) is the safe, explicit pattern — prevents stale state if the shape ever drifts. [VERIFIED: americano.js line 192]

**Index arithmetic confirmed:**
- `t.roundNum` starts at 1 (set by `SetupAmericano.onStart()`, `initTournament.js`)
- `t.precomputedRounds[0]` = round 1 (already used as `currentRound` at start)
- When advancing from round 1 to round 2: `t.roundNum === 1`, so `t.precomputedRounds[1]` = round 2 — correct
- `t.precomputedRounds[t.roundNum]` is the next round while the current round is `t.roundNum`
[VERIFIED: CONTEXT.md D-06, PlayAmericano.jsx line 167, 221–226]

---

## Tabs Component API

**[VERIFIED: src/components/shared/Components.jsx lines 27–37]**

```js
// Components.jsx
export function Tabs({ tabs, active, setActive }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
      {tabs.map(([tb, lbl]) => (
        <button key={tb} onClick={() => setActive(tb)}
          style={{ flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: `2px solid ${active === tb ? "#38bdf8" : "transparent"}`,
            color: active === tb ? "#38bdf8" : "#64748b",
            fontWeight: active === tb ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
          {lbl}
        </button>
      ))}
    </div>
  );
}
```

**API contract:**
- `tabs`: array of `[id: string, label: string]` tuples
- `active`: currently active tab id string
- `setActive`: state setter — call `setActive("descansos")` to navigate

**Current usage in PlayAmericano (lines 171–180):**

```js
<Tabs
  tabs={[
    ["courts", "⚔️ Pistas"],
    ["standings", "🏆 Posiciones"],
    ["history", "📜 Historial"],
    ["rules", "📖 Reglas"],
  ]}
  active={tab}
  setActive={setTab}
/>
```

**Adding 5th tab — exact change:**

```js
<Tabs
  tabs={[
    ["courts", "⚔️ Pistas"],
    ["standings", "🏆 Posiciones"],
    ["history", "📜 Historial"],
    ["rules", "📖 Reglas"],
    ...(t.precomputedRounds?.length ? [["descansos", "💤 Descansos"]] : []),
  ]}
  active={tab}
  setActive={setTab}
/>
```

**Note on `flex: 1` behavior:** Each tab button has `flex: 1`. With 5 tabs on a 390px screen, each button gets ~78px — workable since labels are short. No overflow/scroll mechanism is built into the Tabs component; 5 tabs fits within the 390px constraint without modification.

**Conditional tab gate (D-05):** Spread the optional tuple only when `t.precomputedRounds?.length` is truthy. This also means that if a spectator views a legacy tournament, the Descansos tab simply doesn't appear — no special hiding logic needed.

---

## Verified precomputedRounds Shape from americano.js

**[VERIFIED: src/logic/americano.js lines 102–231, 01-01-SUMMARY.md]**

```js
// precomputeAllRounds() returns:
{
  rounds: Array<{
    courts: Array<{
      pairA: Player[],      // array of 2 player objects
      pairB: Player[],      // array of 2 player objects
      scoreA: "",           // empty string
      scoreB: "",           // empty string
      saved: false
    }>,
    sittingOut: Player[]    // array of player objects — may be empty []
  }>,
  warnings: Array<{
    round: number,          // 1-based round number
    constraint: string,     // 'partner_repeat' | 'court_repeat' | 'advanced_pair'
    message: string         // Spanish description, already formatted
  }>
}
// Pairs mode: { rounds: null, warnings: [] }
```

**Player object shape (individual mode):**

```js
{
  id: number,        // integer index 0..N
  name: string,
  level: number,     // 0..3 (0=Sin definir, 1=Principiante, 2=Intermedio, 3=Avanzado)
  pts: number,       // 0 during pre-calculation (D-05)
  gf: number,        // 0 during pre-calculation
  gc: number         // 0 during pre-calculation
}
```

**Descansos tab can access sitting-out player names via `player.name`.** The `sittingOut` array in each pre-calculated round contains the same player objects — `.name` field is always present for individual mode.

---

## roundWarnings Field Path in State

**[VERIFIED: 01-01-SUMMARY.md lines 102–115, SetupAmericano.jsx lines 164–183, useTournament.js lines 60–80]**

**Critical finding: `t.roundWarnings` is INSIDE the `data` JSON field, NOT a Firestore top-level field.**

The 01-CONTEXT.md D-10 originally said "separate top-level Firestore field", but the 01-01-SUMMARY.md documents the deviation: during Phase 1 implementation, `roundWarnings` was kept inside `t` (serialized into `data` JSON via `persist()`) because extracting it as a Firestore top-level field would require breaking the `{ merge: true }` pattern documented in CLAUDE.md.

**Access pattern in PlayAmericano.jsx:**

```js
// t.roundWarnings is directly available — same as t.players, t.rounds, etc.
const warnings = t.roundWarnings || [];
// Gate on non-empty before rendering
{isAdmin && warnings.length > 0 && <WarningsPanel warnings={warnings} />}
```

**Each warning object:**

```js
{
  round:      3,                    // 1-based — matches t.roundNum convention
  constraint: "partner_repeat",     // one of the three fixed strings
  message:    "Ronda 3: repetición de pareja permitida (sin combinación válida disponible)"
}
```

**Messages are already Spanish** (per D-09 from Phase 1) — display `warning.message` directly without translation.

**`constraint` values enable filtering/grouping:**
- `'partner_repeat'` — partner forced to repeat
- `'court_repeat'` — court repeat forced
- `'advanced_pair'` — two advanced players paired together (only when strict Advanced separation couldn't hold)

---

## isFinished Logic — Current and Extension Needed

**[VERIFIED: PlayAmericano.jsx line 144]**

**Current definition:**

```js
// Line 144
const isFinished = !!(t.config.maxRounds && t.roundNum >= t.config.maxRounds);
```

**Problem:** For tournaments with `t.precomputedRounds` but no `t.config.maxRounds` (maxRounds can be null — see `initTournament.js` line 33: `maxRounds: null`), this condition never fires. A player could advance past the end of the pre-calculated schedule.

**Required extension (Claude's Discretion per CONTEXT.md):**

```js
const isFinished = !!(
  (t.config.maxRounds && t.roundNum >= t.config.maxRounds)
  || (t.precomputedRounds?.length && t.roundNum > t.precomputedRounds.length)
);
```

**Why `t.roundNum > t.precomputedRounds.length` (not `>=`):**
- After the last round is completed, `roundNum` is incremented to `length + 1` in the persist call (`roundNum: t.roundNum + 1`)
- At that point `t.precomputedRounds[t.roundNum]` would be `undefined` (out of bounds)
- The `> length` check catches this state correctly
- `>= length` would incorrectly trigger finished when the last round is still being played

**Secondary concern:** If `t.precomputedRounds` is present but `t.precomputedRounds[t.roundNum]` is `undefined` (i.e., end of schedule), the `onNext()` wire-up guard `t.precomputedRounds[t.roundNum]` naturally evaluates as falsy — the legacy fallback fires. But this fallback generating a new round after a pre-calculated schedule ends is wrong behavior. The `isFinished` extension prevents the "Siguiente Ronda" button from appearing at all in that state.

---

## Descansos Tab — Sitting-Out Display Approach

**[VERIFIED: PlayAmericano.jsx lines 472–480 (CourtsAmericano), lines 730–737 (FutureRound), lines 652–658 (HistoryRound)]**

### Established sitting-out pill patterns (three variants to choose from)

**Pattern A — CourtsAmericano (current active round, line 472):**

```jsx
<div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
  <span>⏳</span>
  <span className="text-yellow-400 font-semibold shrink-0">Descansan:</span>
  <span className="text-gray-400">
    {t.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}
  </span>
</div>
```

**Pattern B — FutureRound (line 730, uses "Descansarán" future tense):**

```jsx
<div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
  <span>⏳</span>
  <span className="text-yellow-400 font-semibold shrink-0">Descansarán:</span>
  <span className="text-gray-400">
    {round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}
  </span>
</div>
```

**Pattern C — HistoryRound (line 652, uses inline style):**

```jsx
<div style={{ background: "#fbbf2422", border: "1px solid #fbbf2455", ... }}>
  <span style={{ fontWeight: 700 }}>⏳ Descansaron: </span>
  {round.sittingOut.map((p) => p.name).join(", ")}
</div>
```

### Recommended Descansos tab row design

The Descansos tab is a compact list — not individual court cards. Each row:

```
R3 — Juan, María          (current round, highlighted)
R4 — Carlos               (future round, normal)
R5 — Nadie descansa       (nobody sits out)
```

**Row markup pattern (recommended using Tailwind + Pattern A styling adapted to compact row):**

```jsx
function DescansosList({ precomputedRounds, currentRoundNum }) {
  return (
    <div className="max-w-lg mx-auto">
      {precomputedRounds.map((round, i) => {
        const rNum = i + 1;
        const isCurrent = rNum === currentRoundNum;
        const names = round.sittingOut?.length
          ? round.sittingOut.map(p => p.name).join(", ")
          : "Nadie descansa";

        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-1.5 text-sm ${
              isCurrent
                ? "bg-yellow-400/10 border border-yellow-400/20"
                : "bg-[#1f2937] border border-gray-700"
            }`}
          >
            <span className={`font-black text-xs shrink-0 ${isCurrent ? "text-yellow-400" : "text-gray-500"}`}>
              R{rNum}{isCurrent ? " ●" : ""}
            </span>
            <span className={isCurrent ? "text-yellow-200" : "text-gray-400"}>
              {names}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

This reuses the yellow-pill vocabulary for the current round and the standard card pattern for future/past rows, consistent with the existing FutureRound and CourtsAmericano patterns.

---

## Warnings Panel — Recommended Layout

**Constraints (from REQUIREMENTS.md PLAY-01 and CONTEXT.md):**
- Admin-only
- Non-empty-gated
- Must show: `round`, `constraint`, `message` per warning
- Format left to Claude's discretion

**Recommendation: inline banner above the courts tab content, collapsible**

A collapsible section is the right choice because:
1. Warnings are informational, not actionable — admins should see them once, then collapse
2. A fixed banner would compete with the court cards for vertical space on mobile (390px priority)
3. The `SimpleModal` component exists but is modal-blocking — too heavy for passive info

**Recommended layout:**

```jsx
{/* Inside the PlayAmericano component, just before the Tabs component */}
{isAdmin && t.roundWarnings?.length > 0 && <WarningsBanner warnings={t.roundWarnings} />}

function WarningsBanner({ warnings }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm font-bold">⚠️ Restricciones relajadas</span>
          <span className="text-xs text-amber-500/80 bg-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
            {warnings.length}
          </span>
        </div>
        <span className="text-amber-500/60 text-xs font-bold">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-200/80 bg-amber-500/5 rounded-lg px-3 py-2">
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Placement decision:** Above the Tabs component (outside the `{tab === "courts"}` block) so it's visible regardless of which tab is active. Admins should not have to navigate to a specific tab to see algorithm warnings.

**Alternative considered:** A separate "Advertencias" 6th tab. Rejected — it appears/disappears based on warnings presence, which causes tab-row layout shifts. An inline collapsible panel avoids this.

**Note on `useState` inside `WarningsBanner`:** The warnings panel is rendered inside `PlayAmericano`'s return, not a separate component. Either inline the `open` state into PlayAmericano's existing `useState` declarations, or extract as a named sub-component (the latter is cleaner and matches the component composition pattern in this file).

---

## Common Pitfalls

### Pitfall 1: Off-by-one in roundNum → precomputedRounds index

**What goes wrong:** Using `t.precomputedRounds[t.roundNum - 1]` instead of `t.precomputedRounds[t.roundNum]` for the NEXT round lookup.

**Why it happens:** `t.roundNum` is 1-based, so `precomputedRounds[0]` = round 1. When we're ON round `n`, the next round is `n+1`, which is at index `n` (0-based). Since `t.roundNum === n`, `precomputedRounds[t.roundNum]` = `precomputedRounds[n]` = round `n+1` — correct.

**How to avoid:** Use `t.precomputedRounds[t.roundNum]` (not `[t.roundNum - 1]`). The `[t.roundNum - 1]` pattern is used elsewhere in the file to ACCESS THE CURRENT ROUND for the Descansos tab display — those are different operations. [VERIFIED: CONTEXT.md D-06, PlayAmericano.jsx line 291: `t.precomputedRounds[viewingRound - 1]`]

**Warning signs:** Last round behavior feels off — tournament ending one round too early.

---

### Pitfall 2: Not reinitializing scoreA/scoreB/saved on pre-calculated courts

**What goes wrong:** Spreading a pre-calculated court object directly into `currentRound` without resetting score fields.

**Why it happens:** Pre-calculated courts already have `scoreA: "", scoreB: "", saved: false` from Phase 1. But this is fragile — if the algorithm ever changes those defaults, or if someone edits a pre-calculated round, the stale values would propagate.

**How to avoid:** Always spread and override: `nc = preRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }))`.

---

### Pitfall 3: roundWarnings undefined on legacy tournaments

**What goes wrong:** `t.roundWarnings.length` throws when `t.roundWarnings` is `undefined` (tournaments created before Phase 1 don't have this field).

**How to avoid:** Always use optional chaining and fallback: `t.roundWarnings?.length > 0` or `(t.roundWarnings || []).length > 0`. The gate check `isAdmin && t.roundWarnings?.length > 0` is safe.

---

### Pitfall 4: Descansos tab appearing for pairs-mode tournaments

**What goes wrong:** `t.precomputedRounds` is `null` for pairs-mode tournaments (Phase 1 returns `{ rounds: null, warnings: [] }` for pairs mode). The tab gate `t.precomputedRounds?.length` evaluates `null?.length` = `undefined`, which is falsy — correct behavior, tab won't appear.

**How to avoid:** The `?.length` guard handles this correctly. No explicit pairs-mode check needed.

---

### Pitfall 5: isFinished not extended

**What goes wrong:** `isFinished` remains `!!(t.config.maxRounds && t.roundNum >= t.config.maxRounds)`. For a tournament with `maxRounds: null` and 8 players (7 pre-calculated rounds), after round 7 the "Siguiente Ronda" button remains active. Clicking it calls `onNext()`, which tries `t.precomputedRounds[8]` (undefined), falls back to `buildRoundAmericano()`, and generates a round 8 that was never in the schedule.

**How to avoid:** Extend `isFinished` as described in the "isFinished Logic" section above.

---

### Pitfall 6: Adding useState for WarningsBanner inside render

**What goes wrong:** Defining `const [open, setOpen] = useState(false)` inside the `PlayAmericano` component body as a conditional (inside an `&&` expression) — React hooks cannot be called conditionally.

**How to avoid:** Either (a) add `const [warningsOpen, setWarningsOpen] = useState(false)` unconditionally to PlayAmericano's existing state declarations, or (b) extract WarningsBanner as a named sub-component with its own hook (preferred — consistent with HistoryRound, FutureRound patterns in the file).

---

## Code Examples

### Pattern: Verified onNext() wire-up skeleton

```js
// [VERIFIED: src/components/play/PlayAmericano.jsx lines 75–136]
async function onNext() {
  if (!t.currentRound.every((c) => c.saved)) return;
  const isPairs = t.config.mode === "pairs";
  const entityKey = isPairs ? "pairs" : "players";
  let np = t[entityKey].map((p) => ({ ...p }));
  const nh = { ...t.partnerHistory };
  const nso = { ...t.sitOutHistory };

  // --- UNCHANGED: score tally, nh, nso (lines 82–112) ---
  t.sittingOut.forEach((p) => { nso[p.id] = (nso[p.id] || 0) + 1; });
  t.currentRound.forEach((court) => { /* ... partner history + pts/gf/gc ... */ });

  // --- CHANGED: line 114 replacement ---
  let nc, nSit;
  if (t.precomputedRounds?.length && t.precomputedRounds[t.roundNum]) {
    const preRound = t.precomputedRounds[t.roundNum];
    nc = preRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
    nSit = preRound.sittingOut;
  } else {
    ({ courts: nc, sittingOut: nSit } = buildRoundAmericano(
      np, t.config.courts, nh, nso, t.config.mode,
    ));
  }

  // --- UNCHANGED: persist (lines 121–135) ---
  const newRounds = [
    ...t.rounds,
    { num: t.roundNum, courts: t.currentRound, sittingOut: t.sittingOut },
  ];
  setLs({});
  await persist({
    ...t,
    [entityKey]: np,
    rounds: newRounds,
    currentRound: nc,
    sittingOut: nSit,
    partnerHistory: nh,
    sitOutHistory: nso,
    roundNum: t.roundNum + 1,
  });
}
```

### Pattern: Tabs array with conditional 5th tab

```js
// [VERIFIED: Components.jsx lines 27–37, PlayAmericano.jsx lines 171–180]
<Tabs
  tabs={[
    ["courts", "⚔️ Pistas"],
    ["standings", "🏆 Posiciones"],
    ["history", "📜 Historial"],
    ["rules", "📖 Reglas"],
    ...(t.precomputedRounds?.length ? [["descansos", "💤 Descansos"]] : []),
  ]}
  active={tab}
  setActive={setTab}
/>
```

### Pattern: Descansos tab block (inside the existing tab conditional chain)

```jsx
{tab === "descansos" && t.precomputedRounds?.length && (
  <div className="max-w-lg mx-auto">
    <p className="text-xs text-gray-500 font-semibold mb-3">Jugadores que descansan por ronda</p>
    {t.precomputedRounds.map((round, i) => {
      const rNum = i + 1;
      const isCurrent = rNum === t.roundNum;
      const names = round.sittingOut?.length
        ? round.sittingOut.map(p => p.name).join(", ")
        : "Nadie descansa";
      return (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-1.5 text-sm ${
            isCurrent
              ? "bg-yellow-400/10 border border-yellow-400/20"
              : "bg-[#1f2937] border border-gray-700"
          }`}
        >
          <span className={`font-black text-xs shrink-0 w-8 ${isCurrent ? "text-yellow-400" : "text-gray-500"}`}>
            R{rNum}{isCurrent ? " ●" : ""}
          </span>
          <span className={isCurrent ? "text-yellow-200 font-medium" : "text-gray-400"}>
            {names}
          </span>
        </div>
      );
    })}
  </div>
)}
```

---

## Integration Risks Not Covered in CONTEXT.md

### Risk 1: `t.precomputedRounds` mutation via spread in persist

**Situation:** `onNext()` persist call does `{ ...t, roundNum: t.roundNum + 1 }`. This spreads `t.precomputedRounds` (the full schedule) into every persist call. For a 12-round tournament with 8 players, `precomputedRounds` is an array of 7 rounds × 2 courts × 2 pairs × 2 players = ~280 player objects. This is fine — Firestore documents support up to 1MB, and even a 24-player × 12-round schedule is well under 50KB.

**Verdict:** Not a real risk at current scale. No action needed.

---

### Risk 2: State desync between `t.players` and players inside `precomputedRounds`

**Situation:** Pre-calculated court objects contain player snapshots taken at tournament start. If an admin edits a player name (via the inline name editor in CourtsAmericano), the name update propagates to `t.players` and `t.currentRound` (via the `handleNameChange` debounced persist at lines 409–426), but does NOT update `t.precomputedRounds`.

**Impact on Descansos tab:** If a player's name is edited mid-tournament, the Descansos tab shows the old name (from precomputedRounds). The active round (currentRound) and future rounds in the FutureRound component also show the old name for the same reason — this is pre-existing behavior, not new.

**Verdict:** Known pre-existing pattern. The Descansos tab matches FutureRound's behavior. No action needed in Phase 2. Could be addressed in Phase 3 by resolving player names through `t.players` dict (same approach used in `HistoryRound` via `playersDict`). If desired, the Descansos tab can use `playersDict` to resolve current names.

---

### Risk 3: Pairs mode reaching Descansos tab

**Situation:** Pairs-mode tournaments have `t.precomputedRounds === null`. The conditional `t.precomputedRounds?.length` evaluates to `undefined` (falsy), so neither the 5th tab nor its content block renders. Safe.

**But:** If a user is on the Descansos tab and the tournament transitions (edge case: re-setup changes mode), `tab === "descansos"` would still be `true` while `t.precomputedRounds` becomes null. The guard `{tab === "descansos" && t.precomputedRounds?.length && ...}` handles this — renders nothing.

**Verdict:** Handled by guard pattern. No additional protection needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Sitting-out display | Custom styled component | Reuse yellow pill pattern from lines 472–480 |
| Modal for warnings | Custom modal | `SimpleModal` from Components.jsx exists — but too heavy; inline collapsible preferred |
| Round numbering from precomputedRounds | Custom index tracking | `i + 1` from `.map((round, i) => ...)` — direct |

---

## State of the Art

No deprecated APIs involved. All patterns are current for the project's stack.

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| `buildRoundAmericano()` call each round | `t.precomputedRounds[t.roundNum]` lookup when available | Deterministic schedule, same shape |

---

## Assumptions Log

All claims in this research were verified from the live codebase. No `[ASSUMED]` tags were used.

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

---

## Open Questions

1. **Player name resolution in Descansos tab**
   - What we know: `precomputedRounds[].sittingOut` contains player snapshots from tournament start. `t.players` is updated when names are edited.
   - What's unclear: Should Descansos tab use snapshot names or live `t.players` lookup?
   - Recommendation: Use `t.players` dict lookup (same approach as HistoryRound's `playersDict`) for consistency. This is a small addition that prevents stale names.

2. **WarningsBanner placement: above Tabs vs. inside courts tab**
   - What we know: Placing it above Tabs means it's always visible regardless of active tab. Placing it inside `{tab === "courts"}` means it's only visible on the courts tab.
   - What's unclear: User preference for visibility.
   - Recommendation: Above Tabs — warnings are "set and forget" info; admins should see them once without navigating. Follows existing pattern where THeader is always visible.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 has no external dependencies beyond the project's own code. All changes are in-file modifications to `PlayAmericano.jsx`.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. Section skipped.

---

## Security Domain

**Applicable security concern:** The Warnings panel is admin-only (PLAY-01). The access control pattern is already established in the codebase: `isAdmin` is computed in `useTournament.js` as `auth.currentUser.uid === t.ownerUid` — pure Firebase Auth, no localStorage, no client-side tricks. This phase must use the same `isAdmin` prop that PlayAmericano already receives.

**Gate pattern:**

```js
// Correct (VERIFIED pattern from line 201)
{isAdmin && t.roundWarnings?.length > 0 && <WarningsBanner warnings={t.roundWarnings} />}

// NEVER:
{localStorage.getItem("isAdmin") && ...}  // prohibited by CLAUDE.md §9
```

No new authentication or authorization surface is introduced — `isAdmin` is already available as a prop.

---

## Sources

### Primary (HIGH confidence — verified from live codebase)
- `src/components/play/PlayAmericano.jsx` — full read, lines 1–781
- `src/logic/americano.js` — full read, lines 1–356; precomputeAllRounds shape confirmed
- `src/components/shared/Components.jsx` — full read; Tabs API confirmed
- `src/logic/initTournament.js` — full read; roundNum=1, maxRounds=null confirmed
- `src/hooks/useTournament.js` — full read; persist() with merge:true confirmed
- `src/components/setup/SetupAmericano.jsx` — lines 156–185; roundWarnings persist path confirmed
- `.planning/phases/01-core-penalty-engine/01-01-SUMMARY.md` — roundWarnings inside data JSON confirmed
- `.planning/phases/01-core-penalty-engine/01-VERIFICATION.md` — all Phase 1 facts cross-checked

---

## Metadata

**Confidence breakdown:**
- onNext() wire-up: HIGH — line-by-line verified from source
- Tabs component API: HIGH — verified from Components.jsx
- precomputedRounds shape: HIGH — verified from americano.js + 01-01-SUMMARY.md
- roundWarnings field path: HIGH — verified from 01-01-SUMMARY.md (deviation from original D-10 documented)
- isFinished extension: HIGH — logic derived from verified initTournament.js + PlayAmericano.jsx
- Descansos display patterns: HIGH — three reusable patterns identified in source
- Warnings panel: HIGH — constraints verified; layout is Claude's discretion per CONTEXT.md

**Research date:** 2026-06-03
**Valid until:** Stable — no external dependencies; valid until PlayAmericano.jsx or americano.js changes
