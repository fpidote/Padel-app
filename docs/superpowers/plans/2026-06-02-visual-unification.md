# Visual Unification + Desktop Containment + Pista Rey Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate court cards across all tournament formats to a unified Tailwind visual standard (source: PlayAmericano), add max-width desktop containment, and fix the result-indicator logic for Pista 1 and the lowest court in El Pozo.

**Architecture:** Three independent tasks touching three files. No new components, no new logic files. PlayAmericano is read-only (source of truth). Task order doesn't matter — no dependencies between tasks.

**Tech Stack:** React 18, Tailwind CSS v4, Vite, JavaScript ES2022, Vitest (build verification only — no new unit tests needed for visual changes).

**Spec:** `docs/superpowers/specs/2026-06-02-visual-unification-design.md`

---

## Files Changed

| File | Change |
|---|---|
| `src/components/play/PlayPozo.jsx` | Body grid inline→Tailwind + `resultBadge` helper + Pista Rey fix |
| `src/components/shared/MatchCard.jsx` | Full inline styles→Tailwind migration |
| `src/TournamentPage.jsx` | `max-w-2xl mx-auto` wrapper around play components |

**NOT changed:** `src/components/play/PlayAmericano.jsx` (source of truth, read-only)

---

## Task 1: PlayPozo.jsx — Visual unification + Pista Rey fix

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

**Context:** PlayPozo's court card body uses inline styles (`display: "grid"`, `iStyle()` function for inputs, plain text for saved scores). The Pista Rey bug is here too: all courts show `↑ SUBE` for winners. The outer card wrapper and header already match Americano's Tailwind pattern — only the body section needs migration.

- [ ] **Step 1: Add `resultBadge` helper function**

Open `src/components/play/PlayPozo.jsx`. Before the `export default function PlayPozo(...)` line, add:

```js
function resultBadge(won, isTop, isBottom, hasSittingOut) {
  if (won) {
    return isTop
      ? { text: "👑 REY",      cls: "text-yellow-400" }
      : { text: "↑ SUBE",     cls: "text-green-400"  };
  }
  if (isBottom) {
    return hasSittingOut
      ? { text: "↓ SALE",     cls: "text-red-400"    }
      : { text: "↓ SE QUEDA", cls: "text-orange-400" };
  }
  return { text: "↓ BAJA", cls: "text-red-400" };
}
```

- [ ] **Step 2: Remove `iStyle` helper**

Inside the component, find and delete the `iStyle` arrow function (currently looks like):
```js
const iStyle = (winning) => ({
  width: 44,
  height: 44,
  ...
});
```
It will be replaced by Tailwind classes in the next step.

- [ ] **Step 3: Add `isBottom` and `hasSittingOut` inside the court map**

Inside `(t.currentPozoRound || []).map((court, ci) => {`, after the existing `isTop` and `valid` lines, add:

```js
const isBottom      = court.courtNum === t.config.courts;
const hasSittingOut = (t.sittingOut?.length ?? 0) > 0;
```

- [ ] **Step 4: Replace the body grid section**

Find the `{/* Body — grid 3 columnas */}` div and replace it entirely with:

```jsx
{/* Body — grid 3 columnas */}
<div className="grid px-4 py-4" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
  {/* Pareja A — derecha */}
  <div className="flex flex-col items-end self-center">
    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pareja A</div>
    <div className="text-sm font-bold text-gray-50 text-right">
      {court.pairA ? `${court.pairA.p1} / ${court.pairA.p2}` : "TBD"}
    </div>
    {court.saved && (() => {
      const { text, cls } = resultBadge(
        parseInt(court.scoreA) > parseInt(court.scoreB),
        isTop, isBottom, hasSittingOut
      );
      return <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>;
    })()}
  </div>

  {/* Score centro */}
  <div className="flex items-center gap-1.5 self-center">
    {court.saved ? (
      <>
        <div
          onClick={() => isAdmin && onEditCourt(ci)}
          title={isAdmin ? "Click para editar" : undefined}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(court.scoreA) > parseInt(court.scoreB) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
        >
          {court.scoreA}
        </div>
        <span className="text-gray-600 font-black text-lg">-</span>
        <div
          onClick={() => isAdmin && onEditCourt(ci)}
          title={isAdmin ? "Click para editar" : undefined}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(court.scoreB) > parseInt(court.scoreA) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
        >
          {court.scoreB}
        </div>
      </>
    ) : isAdmin ? (
      <>
        <input
          type="number" min="0"
          value={sA}
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))}
          className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-gray-600 font-black text-lg">-</span>
        <input
          type="number" min="0"
          value={sB}
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))}
          className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </>
    ) : (
      <span className="text-gray-600 font-black text-lg">–</span>
    )}
  </div>

  {/* Pareja B — izquierda */}
  <div className="flex flex-col items-start self-center">
    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Pareja B</div>
    <div className="text-sm font-bold text-gray-50">
      {court.pairB ? `${court.pairB.p1} / ${court.pairB.p2}` : "TBD"}
    </div>
    {court.saved && (() => {
      const { text, cls } = resultBadge(
        parseInt(court.scoreB) > parseInt(court.scoreA),
        isTop, isBottom, hasSittingOut
      );
      return <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>;
    })()}
  </div>
</div>
```

- [ ] **Step 5: Update the save button**

Find the `{isAdmin && !court.saved && valid && (` block. Replace the button className to use the new Tailwind save button pattern (keep the Pozo amber color):

```jsx
{isAdmin && !court.saved && valid && (
  <div className="px-4 pb-3">
    <button
      onClick={() => onSaveCourt(ci)}
      className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#d97706] hover:bg-[#b45309] text-white cursor-pointer transition-colors"
    >
      Guardar resultado
    </button>
  </div>
)}
```

(This likely already matches — confirm it's unchanged.)

- [ ] **Step 6: Remove the redundant "✓ guardado" footer hint below the body**

Find and delete:
```jsx
{court.saved && isAdmin && (
  <div className="text-xs text-gray-600 text-center pb-2 -mt-1">
    ✓ guardado · toca para editar
  </div>
)}
```
The clickable score boxes now communicate editability; the hint is redundant.

- [ ] **Step 7: Build and run tests**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Expected: `✓ built in ~1.7s`, `70 passed (70)`. Fix any errors before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/components/play/PlayPozo.jsx
git commit -m "refactor: migrar tarjetas Pozo a Tailwind estándar y corregir indicadores de resultado"
```

---

## Task 2: MatchCard.jsx — Visual migration to Tailwind

**Files:**
- Modify: `src/components/shared/MatchCard.jsx`

**Context:** MatchCard is used by Relámpago (`PlayRelampago`) and Mundialito (`PlayMundialito`). It uses 100% inline styles. It handles two display formats: standard games (`scoringFormat !== "sets"`) and sets (`sets3`/`sets5`). Only the visual layer changes — all scoring logic, `getLiveSetResults()`, the sets input visibility condition, and the save/cancel callbacks stay exactly as-is.

- [ ] **Step 1: Replace the card wrapper**

Find the outermost `return (` div:
```jsx
<div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16, borderLeft: `4px solid ${accentColor}` }}>
```

Replace with:
```jsx
<div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3">
```

- [ ] **Step 2: Replace the card header**

Find the header div (starts with `display: "flex", justifyContent: "space-between", marginBottom: 12`). Replace the entire header block with:

```jsx
<div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700">
  <span className="text-xs font-bold text-gray-500 tracking-widest">
    {match.bracket === "winners"
      ? "⚡ CUADRO PRINCIPAL"
      : match.bracket === "consolation"
        ? "🥈 REVANCHA"
        : "⚽ FASE DE GRUPOS"}
    {isSetFormat && ` · 🎾 MEJOR DE ${maxSets}`}
  </span>
  {match.saved && (
    <div className="flex items-center gap-3">
      <span className="text-xs text-green-400 font-semibold">✅ Guardado</span>
      {isAdmin && onEdit && (
        <button
          onClick={() => onEdit(match.id)}
          className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer underline"
          style={{ background: "none", border: "none" }}
        >
          Editar
        </button>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Replace the sets input rows (isSetFormat branch)**

Find the first branch of the top-level ternary (`!match.saved && isSetFormat && isAdmin && match.pairA && match.pairB`). Replace the JSX body of that branch with:

```jsx
<div className="flex flex-col gap-2.5 px-4 pt-2 pb-3">
  {Array.from({ length: maxSets }).map((_, idx) => {
    let tempSetsA = 0;
    let tempSetsB = 0;
    for (let i = 0; i < idx; i++) {
      const pA = parseInt(ls[`${match.id}_set${i}_A`]);
      const pB = parseInt(ls[`${match.id}_set${i}_B`]);
      if (!isNaN(pA) && !isNaN(pB) && pA !== pB) {
        if (pA > pB) tempSetsA++;
        else tempSetsB++;
      }
    }
    if (tempSetsA === setsNeededToWin || tempSetsB === setsNeededToWin) return null;

    return (
      <div key={idx} className="flex items-center justify-between bg-[#0f172a]/20 px-3 py-1.5 rounded-lg">
        <span className="text-xs font-bold text-gray-500 w-11">SET {idx + 1}</span>
        <span className="font-semibold text-gray-400 flex-1 text-right mr-3 text-sm">
          {match.pairA.p1} / {match.pairA.p2}
        </span>
        <input
          type="number" min="0"
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          value={ls[`${match.id}_set${idx}_A`] ?? ""}
          onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_A`]: e.target.value }))}
          className="w-11 h-9 rounded-lg bg-[#0f172a] border-2 border-[#334155] text-center text-base font-black text-gray-50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-gray-500 font-bold mx-2">-</span>
        <input
          type="number" min="0"
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          value={ls[`${match.id}_set${idx}_B`] ?? ""}
          onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_set${idx}_B`]: e.target.value }))}
          className="w-11 h-9 rounded-lg bg-[#0f172a] border-2 border-[#334155] text-center text-base font-black text-gray-50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="font-semibold text-gray-400 flex-1 text-left ml-3 text-sm">
          {match.pairB.p1} / {match.pairB.p2}
        </span>
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Replace the games format body (else branch)**

Find the else branch — currently a `<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>`. Replace the entire else branch JSX with the 3-column Tailwind grid:

```jsx
<div className="grid px-4 py-4" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
  {/* Team A */}
  <div className="flex flex-col items-end self-center">
    <span className="text-sm font-bold text-gray-50 text-right">
      {match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD"}
    </span>
  </div>

  {/* Score centro */}
  <div className="flex items-center gap-1.5 self-center">
    {isAdmin && !match.saved && match.pairA && match.pairB ? (
      <>
        <input
          type="number" min="0"
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          value={sA_games}
          onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_A`]: e.target.value }))}
          className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-gray-600 font-black text-lg">–</span>
        <input
          type="number" min="0"
          onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
          value={sB_games}
          onChange={(e) => setLs((p) => ({ ...p, [`${match.id}_B`]: e.target.value }))}
          className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </>
    ) : isSetFormat && match.saved ? (
      <div className="flex gap-1.5 text-sm font-black text-gray-50">
        {match.sets?.map((set, idx) => (
          <span key={idx} className="bg-[#0f172a] px-2 py-1 rounded">
            {set.a}-{set.b}
          </span>
        ))}
        <span className="text-sky-400 ml-1">({match.scoreA}-{match.scoreB})</span>
      </div>
    ) : match.saved ? (
      <>
        <div
          onClick={() => isAdmin && onEdit && onEdit(match.id)}
          title={isAdmin ? "Click para editar" : undefined}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreA) > parseInt(match.scoreB) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
        >
          {match.scoreA}
        </div>
        <span className="text-gray-600 font-black text-lg">-</span>
        <div
          onClick={() => isAdmin && onEdit && onEdit(match.id)}
          title={isAdmin ? "Click para editar" : undefined}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreB) > parseInt(match.scoreA) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
        >
          {match.scoreB}
        </div>
      </>
    ) : (
      <span className="text-gray-500 font-black text-lg">vs</span>
    )}
  </div>

  {/* Team B */}
  <div className="flex flex-col items-start self-center">
    <span className="text-sm font-bold text-gray-50">
      {match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD"}
    </span>
  </div>
</div>
```

- [ ] **Step 5: Replace the winner indicator and button area**

Find the winner indicator div and the buttons div below the body. Replace both with:

```jsx
{/* Winner indicator */}
{isValidFinal && !match.saved && (
  <div className="text-center px-4 pb-2 text-sm text-green-400 font-bold">
    ✓ Gana{" "}
    {finalScoreA > finalScoreB
      ? `${match.pairA?.p1} / ${match.pairA?.p2}`
      : `${match.pairB?.p1} / ${match.pairB?.p2}`}
    {isSetFormat && ` (${finalScoreA} sets a ${finalScoreB})`}
  </div>
)}

{/* Buttons */}
{isAdmin && !match.saved && match.pairA && match.pairB && (
  <div className="flex gap-2 px-4 pb-4">
    {isEditing && (
      <button
        onClick={() => {
          setLs((p) => {
            const n = { ...p };
            delete n[`${match.id}_A`];
            delete n[`${match.id}_B`];
            for (let i = 0; i < maxSets; i++) {
              delete n[`${match.id}_set${i}_A`];
              delete n[`${match.id}_set${i}_B`];
            }
            return n;
          });
          onSave(match.id, parseInt(match.scoreA), parseInt(match.scoreB), match.sets);
        }}
        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-700 hover:bg-red-600 text-white cursor-pointer transition-colors"
      >
        ✕ Cancelar
      </button>
    )}
    <button
      onClick={() => {
        if (isSetFormat) {
          onSave(match.id, finalScoreA, finalScoreB, live.setList);
        } else {
          onSave(match.id, finalScoreA, finalScoreB);
        }
      }}
      disabled={!isValidFinal}
      className={`${isEditing ? "flex-1" : "w-full"} py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-colors`}
      style={{ background: isValidFinal ? accentColor : "#334155", opacity: isValidFinal ? 1 : 0.5 }}
    >
      Guardar resultado
    </button>
  </div>
)}
```

- [ ] **Step 6: Delete the `iStyle` const and the `renderSavedScore` function**

Both are now replaced by inline JSX in Step 4. Delete:
- The `const iStyle = { ... }` object (around line 102)
- The `const renderSavedScore = () => { ... }` function (lines ~19-60)

Verify the file no longer references `iStyle` or `renderSavedScore`.

- [ ] **Step 7: Build and run tests**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Expected: `✓ built`, `70 passed`. Fix any errors before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/MatchCard.jsx
git commit -m "refactor: migrar MatchCard de inline styles a Tailwind estándar"
```

---

## Task 3: TournamentPage.jsx — Desktop containment

**Files:**
- Modify: `src/TournamentPage.jsx`

**Context:** The play components render without any max-width wrapper. On wide screens (1440px+), content stretches unbounded. The fix is one wrapper div around the play component block only — the Suspense fallback and setup components are not affected.

- [ ] **Step 1: Wrap the play components**

In `src/TournamentPage.jsx`, find the JSX block inside `<Suspense>` that renders the play components. Currently:

```jsx
<Suspense fallback={<div className="p-4 text-center text-[#f1f5f9]">Cargando torneo...</div>}>
  {(t.status === "setup" || editMode) ? (
    t.type === "americano"
      ? <SetupAmericano {...props} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
      : <SetupPairs {...props} typeInfo={typeInfo} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
  ) : (
    <>
      {t.type === "americano" && <PlayAmericano {...props} onEditTournament={onEditTournament} />}
      {t.type === "relampago" && <PlayRelampago {...props} onEditTournament={onEditTournament} />}
      {t.type === "mundialito" && <PlayMundialito {...props} onEditTournament={onEditTournament} />}
      {t.type === "pozo" && <PlayPozo {...props} onEditTournament={onEditTournament} />}
    </>
  )}
</Suspense>
```

Replace only the play block `<> ... </>` with:

```jsx
<Suspense fallback={<div className="p-4 text-center text-[#f1f5f9]">Cargando torneo...</div>}>
  {(t.status === "setup" || editMode) ? (
    t.type === "americano"
      ? <SetupAmericano {...props} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
      : <SetupPairs {...props} typeInfo={typeInfo} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
  ) : (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-2xl mx-auto w-full">
        {t.type === "americano" && <PlayAmericano {...props} onEditTournament={onEditTournament} />}
        {t.type === "relampago" && <PlayRelampago {...props} onEditTournament={onEditTournament} />}
        {t.type === "mundialito" && <PlayMundialito {...props} onEditTournament={onEditTournament} />}
        {t.type === "pozo" && <PlayPozo {...props} onEditTournament={onEditTournament} />}
      </div>
    </div>
  )}
</Suspense>
```

- [ ] **Step 2: Build and run tests**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Expected: `✓ built`, `70 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/TournamentPage.jsx
git commit -m "feat: contenedor max-w-2xl para pantallas desktop en vista de torneo"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Sec 1 PlayPozo body → Task 1 Steps 2–5
- ✅ Sec 1 MatchCard migration → Task 2 Steps 1–6
- ✅ Sec 2 Desktop containment → Task 3
- ✅ Sec 3 Pista Rey bug → Task 1 Steps 1, 3, 4 (`resultBadge`)
- ✅ ↓ BAJA for losers → covered in `resultBadge`
- ✅ ↓ SE QUEDA / ↓ SALE for bottom court → covered in `resultBadge`

**No placeholders:** All steps have concrete code.

**Type consistency:** `resultBadge(won, isTop, isBottom, hasSittingOut)` — same signature used in Step 1 definition and Step 4 calls. `isBottom` defined in Step 3 and used in Step 4.
