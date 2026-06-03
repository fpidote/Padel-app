# Phase 2: PlayAmericano Wire-Up - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 1 (modification-only phase)
**Analogs found:** 1 / 1 (all patterns extracted from the same file being modified)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/play/PlayAmericano.jsx` | component | event-driven (onNext mutation) + request-response (tab rendering) | Itself — three internal sub-components serve as intra-file analogs | exact (same file) |

This phase modifies a single file. All patterns are internal to `PlayAmericano.jsx` — the relevant analogs are:
- `FutureRound` (line 696) — read-only round display from `precomputedRounds`
- `HistoryRound` (line 614) — read-only round display with `playersDict` name resolution
- `CourtsAmericano` sitting-out pill (line 472) — the yellow pill that is the established resting-players UI vocabulary
- Existing `isAdmin &&` gate (line 201) — the established admin-only visibility pattern

---

## Pattern Assignments

### Change 1: `onNext()` wire-up (lines 75–136)

**Analog:** `onNext()` itself — only line 114 changes. Everything else is preserved verbatim.

**Current line 114 (replace this):**
```js
// src/components/play/PlayAmericano.jsx line 114
const { courts: nc, sittingOut: nSit } = buildRoundAmericano(
  np,
  t.config.courts,
  nh,
  nso,
  t.config.mode,
);
```

**Replacement pattern — pre-calculated path with legacy fallback:**
```js
// Replace lines 114–120 with:
let nc, nSit;
if (t.precomputedRounds?.length && t.precomputedRounds[t.roundNum]) {
  const preRound = t.precomputedRounds[t.roundNum];
  nc = preRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
  nSit = preRound.sittingOut;
} else {
  ({ courts: nc, sittingOut: nSit } = buildRoundAmericano(
    np,
    t.config.courts,
    nh,
    nso,
    t.config.mode,
  ));
}
```

**Index arithmetic:** `t.roundNum` is 1-based. When on round N, `precomputedRounds[N]` is round N+1 (0-indexed). This is the correct "next round" index. `precomputedRounds[t.roundNum - 1]` would give the CURRENT round — do not use that here.

**Score field re-initialization is mandatory** even though Phase 1 already writes `scoreA: "", scoreB: "", saved: false` into precomputedRounds (verified `americano.js` line 192). The spread override is defensive against future shape drift.

**Unchanged before and after the replacement:**
- Lines 76–113: guard, isPairs, entityKey, np/nh/nso setup, score tally loop — preserved exactly
- Lines 121–135: `newRounds` append, `setLs({})`, `persist({...t, ...})` call — preserved exactly

---

### Change 2: `isFinished` extension (line 144)

**Current (line 144):**
```js
const isFinished = !!(t.config.maxRounds && t.roundNum >= t.config.maxRounds);
```

**Extended pattern:**
```js
const isFinished = !!(
  (t.config.maxRounds && t.roundNum >= t.config.maxRounds)
  || (t.precomputedRounds?.length && t.roundNum > t.precomputedRounds.length)
);
```

**Why `>` not `>=`:** After the last round completes, `onNext()` increments `roundNum` to `length + 1`. The `> length` check catches that exact state. `>= length` would incorrectly fire while the last round is still being played (roundNum equals length when currently on the last round).

---

### Change 3: Tabs array — add conditional 5th tab (lines 171–180)

**Current pattern (lines 171–180):**
```jsx
// src/components/play/PlayAmericano.jsx lines 171–180
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

**Modified pattern — conditional 5th tab via spread:**
```jsx
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

**Tabs component API** (`src/components/shared/Components.jsx` lines 27–37):
```js
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

`tabs` is `[id, label][]`. The spread `...(condition ? [["id", "Label"]] : [])` is the correct pattern for a conditionally-present tab.

---

### Change 4: Descansos tab content block (new, after `{tab === "rules" && ...}` block)

**Analog — `FutureRound` component (lines 728–738) for yellow pill + round rendering:**
```jsx
// src/components/play/PlayAmericano.jsx lines 728–738
<div className="max-w-lg mx-auto">
  {round.sittingOut?.length > 0 && (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
      <span>⏳</span>
      <span className="text-yellow-400 font-semibold shrink-0">Descansarán:</span>
      <span className="text-gray-400">
        {round.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}
      </span>
    </div>
  )}
```

**Analog — `CourtsAmericano` sitting-out pill (lines 472–480) — established yellow pill:**
```jsx
// src/components/play/PlayAmericano.jsx lines 472–480
{t.sittingOut?.length > 0 && (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-sm mb-3">
    <span>⏳</span>
    <span className="text-yellow-400 font-semibold shrink-0">Descansan:</span>
    <span className="text-gray-400">
      {t.sittingOut.map((p) => p.name || `${p.p1}/${p.p2}`).join(" · ")}
    </span>
  </div>
)}
```

**Analog — existing tab block structure (lines 347–375) for content block shape:**
```jsx
// src/components/play/PlayAmericano.jsx lines 347–375
{tab === "rules" && (
  <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
    ...content...
  </div>
)}
```

**Analog — `FutureRound` wrapper + card pattern (lines 747–778) for row card shape:**
```jsx
// src/components/play/PlayAmericano.jsx lines 747–751
<div key={ci} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3 opacity-70">
```

**Descansos tab block to add after `{tab === "rules" && ...}`:**
```jsx
{tab === "descansos" && t.precomputedRounds?.length > 0 && (
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

**Card vocabulary source:**
- `bg-[#1f2937] border border-gray-700` — normal card: from `FutureRound` line 747
- `bg-yellow-400/10 border border-yellow-400/20` — current round highlight: from `CourtsAmericano` line 473 and `FutureRound` line 731
- `max-w-lg mx-auto` — mobile-first width constraint: from `CourtsAmericano` line 471 and `FutureRound` line 729
- `text-yellow-400`, `text-yellow-200`, `text-gray-400`, `text-gray-500` — color roles: from sitting-out pills throughout

---

### Change 5: WarningsBanner sub-component + placement (new, admin-only)

**Analog — `isAdmin &&` gate pattern (line 201):**
```jsx
// src/components/play/PlayAmericano.jsx line 201
{isAdmin && t.config.useLevels && (
  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
    ...
  </div>
)}
```

**Analog — sub-component pattern (FutureRound, line 696):**
```js
// src/components/play/PlayAmericano.jsx line 696
function FutureRound({ round, matchesSearch, isAdmin, useLevels, showLevelsToggle, players }) {
  if (!round) return null;
  ...
}
```

**`useState` for collapse:** Extract as a named sub-component (same pattern as `HistoryRound`, `FutureRound`, `CourtsAmericano` — all defined at file scope below the default export). This keeps the hook call unconditional inside the sub-component, avoiding React rules-of-hooks violations.

**Placement:** Above the `<Tabs ...>` call (lines 171–180), inside the `<div style={{ padding: 16 }}>` wrapper (line 170). This keeps warnings always visible regardless of active tab, matching how `THeader` is always visible.

**WarningsBanner sub-component:**
```jsx
function WarningsBanner({ warnings }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
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

**Usage site (inside `<div style={{ padding: 16 }}>`, before `<Tabs ...>`):**
```jsx
{isAdmin && t.roundWarnings?.length > 0 && (
  <WarningsBanner warnings={t.roundWarnings} />
)}
```

**`t.roundWarnings` is INSIDE `data` JSON** — accessible as `t.roundWarnings` directly, same as `t.players`, `t.rounds`. Not a Firestore top-level field.

---

## Shared Patterns

### isAdmin gate
**Source:** `src/components/play/PlayAmericano.jsx` line 201
**Apply to:** WarningsBanner usage site
```jsx
{isAdmin && <conditional-content />}
```
`isAdmin` is a prop passed to `PlayAmericano` — already in scope. Never use `localStorage` for admin checks (CLAUDE.md §9).

### Optional-chaining guard for Phase 1 fields
**Source:** `src/components/play/PlayAmericano.jsx` lines 167, 219
**Apply to:** All new code touching `t.precomputedRounds` and `t.roundWarnings`
```js
// Line 167 — existing guard pattern
t.precomputedRounds ? t.precomputedRounds.length : (t.config.maxRounds || "∞")

// Line 219 — existing guard pattern
(t.precomputedRounds || t.rounds?.length > 0) && (...)
```
Always use `?.length` or `|| []` before accessing `.length` on fields that may be absent in legacy tournaments.

### Card visual vocabulary
**Source:** `src/components/play/PlayAmericano.jsx` lines 492, 747
**Apply to:** Descansos tab rows
```jsx
// Normal card
className="bg-[#1f2937] rounded-2xl border border-gray-700"

// Current-round / active highlight (yellow)
className="bg-yellow-400/10 border border-yellow-400/20"
```

### sub-component definition site
**Source:** `src/components/play/PlayAmericano.jsx` lines 382, 614, 696
**Apply to:** `WarningsBanner`, and Descansos content (if extracted)

All helper components (`CourtsAmericano`, `HistoryRound`, `FutureRound`) are defined at file scope below the default export `PlayAmericano`. New sub-components follow the same pattern — file-local, not exported, defined after the default export.

### persist call shape
**Source:** `src/components/play/PlayAmericano.jsx` lines 126–135
**Apply to:** `onNext()` (unchanged section, confirmed pattern)
```js
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
```
`persist` comes from `useTournament.js` and always uses `{ merge: true }` internally. Never call `setDoc` directly in Play components.

---

## No Analog Found

No files are without analog. All five changes have verified patterns in the existing codebase.

---

## Metadata

**Analog search scope:** `src/components/play/PlayAmericano.jsx` (primary), `src/components/shared/Components.jsx` (Tabs API)
**Files scanned:** 2 source files read; 5 targeted line ranges extracted
**Pattern extraction date:** 2026-06-03
