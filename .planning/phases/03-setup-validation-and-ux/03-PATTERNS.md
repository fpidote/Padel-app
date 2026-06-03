# Phase 3: Setup Validation and UX - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 1 (SetupAmericano.jsx — single file modified)
**Analogs found:** 2 / 2 (WarningsBanner in PlayAmericano.jsx; existing isAdmin+debounce patterns in SetupAmericano.jsx itself)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/setup/SetupAmericano.jsx` | component (setup) | request-response (admin triggers persist on start) | `src/components/play/PlayAmericano.jsx` (WarningsBanner sub-component) + `src/components/setup/SetupAmericano.jsx` itself (existing state/debounce patterns) | exact — same file + exact pattern from sibling component |

---

## Pattern Assignments

### `src/components/setup/SetupAmericano.jsx` (component, request-response)

This is a modification-only file. All patterns are extracted directly from the file itself and from its closest behavioral sibling, `PlayAmericano.jsx`.

---

#### Pattern 1 — Existing useState block (insertion point for new state)

**Analog:** `src/components/setup/SetupAmericano.jsx` lines 35–54

```jsx
const [localName,     setLocalName]     = useState(t.config.name      || "");
const [localDesc,     setLocalDesc]     = useState(t.config.description || "");
const [localLocation, setLocalLocation] = useState(t.config.location  || "");
const [localDatetime, setLocalDatetime] = useState(t.config.datetime  || "");
const [newName,       setNewName]       = useState("");
const [newLvl,        setNewLvl]        = useState(0);
const [newP1,         setNewP1]         = useState("");
const [newP2,         setNewP2]         = useState("");
const [showAdvanced,  setShowAdvanced]  = useState(false);
const [copied,        setCopied]        = useState(false);
const [rallyCustom,   setRallyCustom]   = useState("");
const [gamesCustom,   setGamesCustom]   = useState("");
const [roundsCustom,  setRoundsCustom]  = useState("");
const [minutesCustom, setMinutesCustom] = useState("");
const [saved,         setSaved]         = useState(false);
const [editingIdx,    setEditingIdx]    = useState(null);
const [editName,      setEditName]      = useState("");
const [editLvl,       setEditLvl]       = useState(0);
const [editP1,        setEditP1]        = useState("");
const [editP2,        setEditP2]        = useState("");
```

**Where to insert new state:** Append after line 54, following the same alignment/naming convention:

```jsx
const [warningDismissed,       setWarningDismissed]       = useState(false);
const [localPrecomputedRounds, setLocalPrecomputedRounds] = useState(null);
const [localRoundWarnings,     setLocalRoundWarnings]     = useState([]);
```

---

#### Pattern 2 — Derived boolean constants block (insertion point for allUnrated + canReshuffle)

**Analog:** `src/components/setup/SetupAmericano.jsx` lines 69–85

```jsx
const units = isPairs ? 2 : 4;
const act   = t.config.courts * units;
const tot   = isPairs ? (t.pairInputs?.length ?? 0) : (t.playerInputs?.length ?? 0);
const sit   = Math.max(0, tot - act);
const need  = Math.max(0, act - tot);

const statusBg  = need > 0 ? "bg-red-400/10 border-red-400/20"    : sit > 0 ? "bg-yellow-400/10 border-yellow-400/20"    : "bg-green-400/10 border-green-400/20";
const statusTxt = need > 0 ? "text-red-400"                       : sit > 0 ? "text-yellow-400"                          : "text-green-400";
const statusMsg = `${tot} ${isPairs ? "parejas" : "jugadores"} · ${t.config.courts} pistas · ${Math.min(tot, act)} juegan` +
  (sit > 0 ? ` · ⏳ ${sit} descansan` : need > 0 ? ` · ⚠️ faltan ${need}` : " · ✓ listo");

const ok = isPairs
  ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
  : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0);

const scoring   = t.config.scoringSystem || "timed";
const useLevels = !!t.config.useLevels;
```

**Where to insert derived conditions for SETUP-01 and SETUP-02:** Append immediately after line 85, following the same `const` pattern:

```jsx
const allUnrated = useLevels && !isPairs &&
  (t.playerInputs || []).length > 0 &&
  (t.playerInputs || []).every(p => (p.level || 0) === 0);
const showUnratedWarning = allUnrated && !warningDismissed;

const canReshuffle = !isPairs &&
  (t.config.matchmaking || "americano") === "americano" &&
  t.status !== "playing" &&
  ok;
```

Note: `canReshuffle` uses `ok` (already defined on line 80) as the threshold — no separate `localPrecomputedRounds !== null` gate, because the button triggers the first calculation too (per Open Question 1 recommendation in RESEARCH.md).

---

#### Pattern 3 — Debounce handler pattern (model for handleReshuffle)

**Analog:** `src/components/setup/SetupAmericano.jsx` lines 87–100

```jsx
function handleName(val) {
  setLocalName(val);
  clearTimeout(debName.current);
  debName.current = setTimeout(() => persist({ ...t, config: { ...t.config, name: val } }), 600);
}
```

**handleReshuffle** follows the same synchronous handler shape but without debounce (immediate calculation, no persist):

```jsx
function handleReshuffle() {
  if (isPairs) return;
  const entities = (t.playerInputs || []).map((p, i) => ({
    id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0
  }));
  const result = precomputeAllRounds(entities, t.config);
  setLocalPrecomputedRounds(result.rounds);
  setLocalRoundWarnings(result.warnings);
}
```

No try/catch needed — `handleReshuffle` is synchronous and does not call Firebase.

---

#### Pattern 4 — onStart() modification (use localPrecomputedRounds if available)

**Analog:** `src/components/setup/SetupAmericano.jsx` lines 156–185 (full onStart)

```jsx
async function onStart() {
  let entities;
  if (isPairs) {
    entities = t.pairInputs.map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
  } else {
    entities = t.playerInputs.map((p, i) => ({ id: i, name: p.name.trim(), level: p.level, pts: 0, gf: 0, gc: 0 }));
  }
  const { courts, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode);
  let precomputedRounds = null;
  let roundWarnings = [];
  if ((t.config.matchmaking || "americano") === "americano") {
    const result = precomputeAllRounds(entities, t.config);   // ← replace this block
    precomputedRounds = result.rounds;
    roundWarnings = result.warnings;
  }
  await persist({ ...t, ... });
  onExitEdit?.();
}
```

**Surgical replacement** of lines 166–170 only:

```jsx
  if ((t.config.matchmaking || "americano") === "americano") {
    if (localPrecomputedRounds !== null) {
      precomputedRounds = localPrecomputedRounds;
      roundWarnings = localRoundWarnings;
    } else {
      const result = precomputeAllRounds(entities, t.config);
      precomputedRounds = result.rounds;
      roundWarnings = result.warnings;
    }
  }
```

The `await persist(...)` call at lines 171–183 requires no changes.

---

#### Pattern 5 — WarningsBanner (expand/collapse) in PlayAmericano — model for Setup dismiss banner

**Analog:** `src/components/play/PlayAmericano.jsx` lines 853–879

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

**Adaptation for SETUP-01:** Simpler — one-time dismiss, not expand/collapse. Color token shifts from `amber` to `yellow` to distinguish "unrated players" from "relaxed constraints". Insert inline (not as a sub-component) immediately before the `{isAdmin && <button onClick={onStart} ...>}` block at line 780:

```jsx
{isAdmin && showUnratedWarning && (
  <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-yellow-400">⚠️ Ningún jugador tiene nivel asignado</div>
        <div className="text-xs text-yellow-300/70 mt-1">
          El emparejamiento por niveles no tendrá efecto. Puedes asignar niveles arriba o continuar sin ellos.
        </div>
      </div>
      <button
        onClick={() => setWarningDismissed(true)}
        className="text-yellow-500/60 hover:text-yellow-400 text-xs font-bold shrink-0 cursor-pointer transition-colors"
      >
        Continuar
      </button>
    </div>
  </div>
)}
```

---

#### Pattern 6 — isAdmin-gated secondary button (model for re-shuffle button)

**Analog:** `src/components/setup/SetupAmericano.jsx` lines 616–620 (inline delete button)

```jsx
{isAdmin && (
  <button
    onClick={() => { ... }}
    className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none shrink-0"
  >✕</button>
)}
```

**Analog 2:** `src/components/setup/SetupAmericano.jsx` lines 651–657 (add-pair button, secondary style)

```jsx
<button
  onClick={addPair}
  className="w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors"
  style={{ background: newP1.trim() && newP2.trim() ? COLOR : "#374151", color: "#fff" }}
>
  + Agregar pareja
</button>
```

**Re-shuffle button** (insert between status bar and `{isAdmin && <button onClick={onStart}>}` block, i.e., around line 779). Uses Tailwind only — no inline style except where the existing "Iniciar Torneo" button already uses inline style for dynamic color. The re-shuffle button uses a static secondary style:

```jsx
{isAdmin && canReshuffle && (
  <button
    onClick={handleReshuffle}
    className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm border border-gray-700 bg-[#1f2937] text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors cursor-pointer"
  >
    {localPrecomputedRounds !== null ? "✓ Emparejamiento listo — Re-sortear" : "🔀 Generar emparejamiento"}
  </button>
)}
```

---

#### Pattern 7 — Iniciar Torneo button (unchanged anchor — reference only)

**Source:** `src/components/setup/SetupAmericano.jsx` lines 779–794

```jsx
{isAdmin && (
  <button
    onClick={onStart}
    disabled={!ok}
    className="w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors"
    style={{
      background: ok ? COLOR : "#374151",
      color:      ok ? "#fff" : "#64748b",
      cursor:     ok ? "pointer" : "not-allowed",
      opacity:    ok ? 1 : 0.5,
    }}
  >
    🎾 Iniciar Torneo
  </button>
)}
```

This block is NOT modified. SETUP-01 banner and SETUP-02 re-shuffle button are inserted immediately **before** this block. The `ok` condition and inline dynamic color style are intentional legacy — do not migrate them to Tailwind in this phase.

---

## Shared Patterns

### isAdmin guard
**Source:** `src/components/setup/SetupAmericano.jsx` — multiple lines (e.g., 616, 628, 780)
**Apply to:** All new JSX blocks (SETUP-01 banner, SETUP-02 re-shuffle button)

```jsx
{isAdmin && (
  /* element visible only to tournament organizer */
)}
```

### Tailwind-only styling (no inline style)
**Source:** CLAUDE.md section 7 — "Sin estilos inline excepto colores dinámicos de formatos"
**Apply to:** Both new elements. The warning banner and re-shuffle button must use only Tailwind utility classes. The existing "Iniciar Torneo" button's inline style is legacy — do not replicate this pattern in new elements.

### No persist in handlers that are local-only
**Source:** CLAUDE.md section 8 and RESEARCH.md anti-patterns
**Apply to:** `handleReshuffle()` — must NOT call `persist()`. Local state only.

```jsx
// Correct: local state update only
function handleReshuffle() {
  const result = precomputeAllRounds(entities, t.config);
  setLocalPrecomputedRounds(result.rounds);
  setLocalRoundWarnings(result.warnings);
}

// Wrong: would bypass the "Iniciar" confirmation step
function handleReshuffle() {
  const result = precomputeAllRounds(entities, t.config);
  persist({ ...t, precomputedRounds: result.rounds }); // ← never do this
}
```

---

## No Analog Found

No files in this phase lack a codebase analog. Both patterns (dismissible banner, local state for precomputed rounds) have direct references in the existing codebase.

---

## Metadata

**Analog search scope:** `src/components/setup/`, `src/components/play/`
**Files scanned:** `SetupAmericano.jsx` (799 lines), `PlayAmericano.jsx` (930+ lines, targeted reads)
**Pattern extraction date:** 2026-06-03
