# Visual Unification + Desktop Containment + Pista Rey Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the court card visual standard across all tournament formats using PlayAmericano as source of truth, add desktop containment, and fix the court-result indicator logic in El Pozo.

**Architecture:** Three independent changes across four files. No new components, no new logic — pure visual migration and one bug fix.

**Tech Stack:** React 18, Tailwind CSS v4, JavaScript ES2022.

---

## 1. Visual Unification (Standard: `CourtsAmericano`)

### Source of truth — Tailwind class tokens

Extracted from `src/components/play/PlayAmericano.jsx` (`CourtsAmericano` sub-component):

| Element | Classes |
|---|---|
| Card wrapper | `bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3` |
| Card header | `flex justify-between items-center px-4 py-2.5 border-b border-gray-700` |
| Header label | `text-xs font-bold text-gray-500 tracking-widest` |
| Header right actions | `flex items-center gap-2` |
| Body grid | `grid px-4 py-4` + inline `gridTemplateColumns: "1fr auto 1fr", gap: "10px"` |
| Team A column | `flex flex-col items-end self-center` |
| Team B column | `flex flex-col items-start self-center` |
| Player name | `text-sm font-bold text-gray-50` |
| Score center | `flex items-center gap-1.5 self-center` |
| Input (unsaved) | `w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none` |
| Score box — winner | `w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black bg-green-500/10 border border-green-500/40 text-green-400` |
| Score box — loser | `w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black bg-gray-800 border border-gray-600 text-gray-400` |
| Footer hint | `text-xs text-gray-600 text-center pb-2 -mt-1` |
| Save button (structural) | `w-full py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-colors` |
| Edit button | `text-xs font-semibold text-gray-500 hover:text-sky-400 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg cursor-pointer` |

**Save button color:** each format keeps its own accent color for the save button background:
- Pozo: `bg-[#d97706]`
- Relámpago/Mundialito (MatchCard): dynamic via `accentColor` prop → inline style `background: accentColor` (acceptable exception per CLAUDE.md: "estilos inline excepto colores dinámicos de formatos")

### Files affected

#### `src/components/play/PlayPozo.jsx`
- The outer card wrapper already uses correct Tailwind classes.
- **Migrate the body section** from inline styles (`display: "grid"`, `iStyle()`) to the Tailwind grid pattern above.
- Replace `iStyle()` helper function with the Tailwind input class string.
- Preserve Pozo-specific header content (courtNum, 👑 Rey badge, ↑ Ganador sube, ✅ Guardado, ✏️ Editar).

#### `src/components/shared/MatchCard.jsx`
- **Full visual migration** from inline styles to Tailwind.
- Remove `borderLeft: 4px solid accentColor` — the tournament type is already communicated by `THeader` above.
- Replace `iStyle` object with Tailwind input classes.
- Replace `B()` calls with Tailwind structural classes + `style={{ background: accentColor }}` for save button.
- The sets input logic, `getLiveSetResults()`, winner display, and cancel/save button behavior are **not changed**.
- The header bracket label (`⚡ Cuadro Principal`, `🥈 Revancha`, `⚽ Fase de Grupos`) moves to a `text-xs font-bold text-gray-500 tracking-widest` span — same style as court labels.

---

## 2. Desktop Containment

### File: `src/TournamentPage.jsx`

Wrap the active play component block in a centered max-width container:

```jsx
// Before (current)
<>
  {t.type === "americano" && <PlayAmericano ... />}
  {t.type === "relampago" && <PlayRelampago ... />}
  {t.type === "mundialito" && <PlayMundialito ... />}
  {t.type === "pozo" && <PlayPozo ... />}
</>

// After
<div className="min-h-screen bg-[#0f172a]">
  <div className="max-w-2xl mx-auto w-full">
    {t.type === "americano" && <PlayAmericano ... />}
    {t.type === "relampago" && <PlayRelampago ... />}
    {t.type === "mundialito" && <PlayMundialito ... />}
    {t.type === "pozo" && <PlayPozo ... />}
  </div>
</div>
```

**`max-w-2xl` (672px):** all play components are single-column mobile-first designs. At 672px they have comfortable lateral breathing room without stretching cards to unusable widths on 1440px+ screens. On mobile (< 672px) behavior is identical to today.

**`bg-[#0f172a]`:** ensures the dark background fills the screen even when content is shorter than viewport height.

The `Suspense` fallback and setup components (`SetupAmericano`, `SetupPairs`) are **not wrapped** — they have their own `max-w-lg mx-auto` internally.

---

## 3. Pista Rey — Result Indicator Fix

### File: `src/components/play/PlayPozo.jsx`

**Variables** (derived inside the court map):
```js
const isTop    = court.courtNum === 1;
const isBottom = court.courtNum === t.config.courts;
const hasSittingOut = (t.sittingOut?.length ?? 0) > 0;
```

**Helper** (defined once, inside `CourtsPozo` or inline in the map):
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
  return       { text: "↓ BAJA",      cls: "text-red-400"    };
}
```

**Usage** (after `court.saved` check, for each team):
```jsx
{court.saved && (() => {
  const won = parseInt(court.scoreA) > parseInt(court.scoreB);
  const { text, cls } = resultBadge(won, isTop, isBottom, hasSittingOut);
  return <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>;
})()}
```

For Pareja B: `won = parseInt(court.scoreB) > parseInt(court.scoreA)`.

**No change to round-building logic:** `buildPozoRound` / `shufflePlayers` already sort by `courtLevel` descending. The loser of the bottom court receives the lowest `courtLevel` and naturally stays at the bottom next round. If a waiting player exists with a higher `courtLevel`, they displace the loser — the "↓ SALE" behavior is already correct algorithmically.

---

## 4. Files Changed Summary

| File | Change |
|---|---|
| `src/components/play/PlayPozo.jsx` | Body grid → Tailwind + `resultBadge` helper |
| `src/components/shared/MatchCard.jsx` | Full inline→Tailwind visual migration |
| `src/TournamentPage.jsx` | `max-w-2xl mx-auto` wrapper for play components |

`src/components/play/PlayAmericano.jsx` — **not changed** (it is the source of truth).

---

## 5. Out of Scope

- Extracting a shared `CourtCard` component (YAGNI — the three cards have different enough internal structure)
- Changes to `buildPozoRound`, `applyPozoRoundResults`, `shufflePlayers` (round logic is already correct)
- Any change to setup components (`SetupPairs`, `SetupAmericano`)
- TypeScript migration
