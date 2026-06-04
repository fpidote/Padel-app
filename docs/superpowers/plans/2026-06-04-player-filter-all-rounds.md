# Player Filter — All-Rounds View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player is selected in the filter dropdown, show all rounds stacked vertically (instead of navigating tabs one by one), with the filtered player's name in bold in every match card.

**Architecture:** Two independent changes — PlayAmericano and PlayPozo. Americano already has the filter; we add conditional rendering. Pozo gets the filter and all-rounds view from scratch. New sub-components live inside their respective files.

**Tech Stack:** React 18, Tailwind CSS v4, JavaScript ES2022. No new dependencies.

---

## File Map

| File | Change |
|---|---|
| `src/components/play/PlayAmericano.jsx` | Modify `HistoryRound` + `FutureRound` (add `highlightId` prop); add `FilteredCurrentRound` and `AllRoundsPlayerView` components; wire conditional render in Courts tab |
| `src/components/play/PlayPozo.jsx` | Add `search` state, `allPozoEntities`, `matchesPozoSearch`; add `PozoAllRoundsView` component; add filter dropdown; wire conditional render in Courts tab |

---

## Task 1: Modify HistoryRound + FutureRound to accept `highlightId`

**Files:**
- Modify: `src/components/play/PlayAmericano.jsx` (HistoryRound at line 684, FutureRound at line 766)

- [ ] **Step 1: Add `highlightId` prop to HistoryRound and update `renderPairName`**

Find the `HistoryRound` function signature (line 684) and its `renderPairName` function. Replace both:

```jsx
function HistoryRound({ round, matchesSearch, isAdmin, useLevels, showLevelsToggle, players, highlightId }) {
  if (!round) return null;
  const showLevel = useLevels && isAdmin && showLevelsToggle;
  const playersDict = useMemo(() => {
    const dict = {};
    players?.forEach(p => { dict[p.id] = p; });
    return dict;
  }, [players]);
  const renderPairName = (pair) => {
    if (Array.isArray(pair)) {
      return pair.map((p, i) => {
        const currentPlayer = playersDict[p.id] || p;
        const lvl = LEVELS[currentPlayer.level || 0];
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        return (
          <span key={p.id} style={isHighlighted ? { fontWeight: 900 } : undefined}>
            {i > 0 && <span style={{ color: "#94a3b8" }}> & </span>}
            {p.name}
            {showLevel && (
              <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px", marginLeft: 4 }}>
                {lvl.short}
              </span>
            )}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return <span style={isHighlighted ? { fontWeight: 900 } : undefined}>{pair?.p1} / {pair?.p2}</span>;
  };
```

- [ ] **Step 2: Add `highlightId` prop to FutureRound and update `renderPair`**

Find the `FutureRound` function signature (line 766) and its `renderPair` function. Replace both:

```jsx
function FutureRound({ round, matchesSearch, isAdmin, useLevels, showLevelsToggle, players, highlightId }) {
  if (!round) return null;
  const showLevel = useLevels && isAdmin && showLevelsToggle;
  const playersDict = useMemo(() => {
    const dict = {};
    players?.forEach(p => { dict[p.id] = p; });
    return dict;
  }, [players]);

  function renderPair(pair) {
    if (!pair) return null;
    if (Array.isArray(pair)) {
      return pair.map((p) => {
        const currentPlayer = playersDict[p.id] || p;
        const lvl = LEVELS[currentPlayer.level || 0];
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        return (
          <span key={p.id} className="flex items-center gap-1 leading-snug">
            <span className={`text-sm ${isHighlighted ? "font-black" : "font-bold"} text-gray-50`}>{p.name}</span>
            {showLevel && currentPlayer.level > 0 && lvl && (
              <span style={{ fontSize: 10, fontWeight: 700, background: lvl.color + "20", color: lvl.color, borderRadius: 4, padding: "1px 4px" }}>
                {lvl.short}
              </span>
            )}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return <span className={`text-sm ${isHighlighted ? "font-black" : "font-bold"} text-gray-50`}>{`${pair.p1} / ${pair.p2}`}</span>;
  }
```

- [ ] **Step 3: Verify the app builds without errors**

```bash
npm run build
```

Expected: build succeeds, no TypeScript/JSX errors.

---

## Task 2: Add `FilteredCurrentRound` and `AllRoundsPlayerView` in PlayAmericano

**Files:**
- Modify: `src/components/play/PlayAmericano.jsx` (add components before `CourtsAmericano` at line 448)

- [ ] **Step 1: Insert `FilteredCurrentRound` component just before `CourtsAmericano`**

Add the following new component immediately before the `function CourtsAmericano(` definition (line 448):

```jsx
function FilteredCurrentRound({ t, isAdmin, ls, setLs, onSave, onEdit, matchesSearch, highlightId }) {
  const courts = (t.currentRound || [])
    .map((court, ci) => ({ court, ci }))
    .filter(({ court }) => matchesSearch(court));

  const isSittingOut = courts.length === 0 && (t.sittingOut || []).some(
    (p) => String(p.id ?? p) === String(highlightId)
  );

  function renderName(pair) {
    if (Array.isArray(pair)) {
      return pair.map((p) => {
        const isHighlighted = highlightId && String(p.id) === String(highlightId);
        return (
          <span key={p.id} className={`text-sm leading-snug block ${isHighlighted ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
            {p.name}
          </span>
        );
      });
    }
    const isHighlighted = highlightId && String(pair?.id) === String(highlightId);
    return (
      <span className={`text-sm leading-snug ${isHighlighted ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
        {pair?.p1} / {pair?.p2}
      </span>
    );
  }

  return (
    <div className="bg-[#1f2937] rounded-2xl border border-sky-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xs font-bold text-sky-400 tracking-widest">RONDA {t.roundNum}</span>
        <span className="text-xs text-sky-400 font-semibold">● EN CURSO</span>
      </div>
      {courts.length === 0 ? (
        <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">
          {isSittingOut ? "⏳ Descansa esta ronda" : "Sin partido asignado"}
        </div>
      ) : (
        courts.map(({ court, ci }) => {
          const scoreA = parseInt(court.scoreA);
          const scoreB = parseInt(court.scoreB);
          const wonA = !isNaN(scoreA) && !isNaN(scoreB) && scoreA > scoreB;
          const wonB = !isNaN(scoreA) && !isNaN(scoreB) && scoreB > scoreA;
          const hasValid =
            ls[`${ci}_A`] !== undefined && ls[`${ci}_B`] !== undefined &&
            ls[`${ci}_A`] !== "" && ls[`${ci}_B`] !== "" &&
            Number(ls[`${ci}_A`]) !== Number(ls[`${ci}_B`]);

          return (
            <div key={ci} className="px-4 py-4">
              <div className="text-xs font-bold text-gray-500 tracking-widest mb-3">PISTA {ci + 1}</div>
              <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
                <div className="flex flex-col items-end self-center">{renderName(court.pairA)}</div>
                <div className="flex items-center gap-1.5 self-center">
                  {court.saved ? (
                    <>
                      <div
                        onClick={() => isAdmin && onEdit(ci)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                      >{court.scoreA}</div>
                      <span className="text-gray-600 font-black text-lg">-</span>
                      <div
                        onClick={() => isAdmin && onEdit(ci)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}
                      >{court.scoreB}</div>
                    </>
                  ) : isAdmin ? (
                    <>
                      <input
                        type="number" min="0"
                        value={ls[`${ci}_A`] ?? ""}
                        onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))}
                        onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                        className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-gray-600 font-black text-lg">-</span>
                      <input
                        type="number" min="0"
                        value={ls[`${ci}_B`] ?? ""}
                        onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))}
                        onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                        className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </>
                  ) : (
                    <span className="text-gray-600 font-black text-lg">–</span>
                  )}
                </div>
                <div className="flex flex-col items-start self-center">{renderName(court.pairB)}</div>
              </div>
              {isAdmin && !court.saved && hasValid && (
                <div className="pt-3">
                  <button
                    onClick={() => onSave(ci)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer transition-colors"
                  >
                    Guardar resultado
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: Insert `AllRoundsPlayerView` component just after `FilteredCurrentRound`**

Add the following immediately after the `FilteredCurrentRound` closing brace, still before `CourtsAmericano`:

```jsx
function AllRoundsPlayerView({ t, isAdmin, ls, setLs, onSave, onEdit, matchesSearch, useLevels, showLevelsToggle, search }) {
  const hasPast = (t.rounds || []).length > 0;
  const hasFuture = t.precomputedRounds && t.precomputedRounds.length > t.roundNum;

  if (!hasPast && !hasFuture && !t.currentRound?.length) {
    return <div className="text-center text-gray-600 py-8 text-sm">Aún no hay rondas</div>;
  }

  return (
    <div className="space-y-3">
      {(t.rounds || []).map((round, i) => (
        <HistoryRound
          key={i}
          round={round}
          matchesSearch={matchesSearch}
          isAdmin={isAdmin}
          useLevels={useLevels}
          showLevelsToggle={showLevelsToggle}
          players={t.players}
          highlightId={search}
        />
      ))}
      <FilteredCurrentRound
        t={t}
        isAdmin={isAdmin}
        ls={ls}
        setLs={setLs}
        onSave={onSave}
        onEdit={onEdit}
        matchesSearch={matchesSearch}
        highlightId={search}
      />
      {t.precomputedRounds && t.precomputedRounds
        .slice(t.roundNum)
        .map((round, i) => (
          <FutureRound
            key={`future-${t.roundNum + i}`}
            round={round}
            matchesSearch={matchesSearch}
            isAdmin={isAdmin}
            useLevels={useLevels}
            showLevelsToggle={showLevelsToggle}
            players={t.players}
            highlightId={search}
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

---

## Task 3: Wire conditional render in PlayAmericano's Courts tab

**Files:**
- Modify: `src/components/play/PlayAmericano.jsx` (Courts tab section, around line 255)

- [ ] **Step 1: Replace the round-tabs + single-round block with a conditional on `search`**

In the Courts tab render (`{tab === "courts" && (...)`), find the section that starts with:
```jsx
{/* ── Tabs de rondas ── */}
{(t.precomputedRounds || t.rounds?.length > 0) && (
```
...and ends with the closing of the `CourtsAmericano` render (closing `)}` after the `viewingRound` conditional).

Replace that entire block (from the `{/* ── Tabs de rondas ── */}` comment to the end of the `viewingRound` ternary) with:

```jsx
{search ? (
  <AllRoundsPlayerView
    t={t}
    isAdmin={isAdmin}
    ls={ls}
    setLs={setLs}
    onSave={onSave}
    onEdit={onEdit}
    matchesSearch={matchesSearch}
    useLevels={!!t.config.useLevels}
    showLevelsToggle={showLevelsToggle}
    search={search}
  />
) : (
  <>
    {/* ── Tabs de rondas ── */}
    {(t.precomputedRounds || t.rounds?.length > 0) && (
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {t.precomputedRounds
          ? t.precomputedRounds.map((_, i) => {
              const rNum = i + 1;
              const isCurrent = rNum === t.roundNum;
              const isFuture = rNum > t.roundNum;
              const isActive = isCurrent ? viewingRound === null : viewingRound === rNum;
              return (
                <button
                  key={i}
                  onClick={() => setViewingRound(isCurrent ? null : rNum)}
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "#0284c7" : isFuture ? "#111827" : "#1f2937",
                    color: isActive ? "#fff" : isFuture ? "#334155" : "#64748b",
                  }}
                >
                  R{rNum}{isCurrent ? " ●" : ""}
                </button>
              );
            })
          : <>
              {t.rounds.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setViewingRound(i + 1)}
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: viewingRound === i + 1 ? "#0284c7" : "#1f2937",
                    color: viewingRound === i + 1 ? "#fff" : "#64748b",
                  }}
                >
                  R{r.num || i + 1}
                </button>
              ))}
              <button
                onClick={() => setViewingRound(null)}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: viewingRound === null ? "#0284c7" : "#1f2937",
                  color: viewingRound === null ? "#fff" : "#94a3b8",
                }}
              >
                R{t.roundNum} ●
              </button>
            </>
        }
      </div>
    )}

    {viewingRound !== null ? (
      (t.precomputedRounds && viewingRound > t.roundNum) ? (
        <FutureRound
          round={t.precomputedRounds[viewingRound - 1]}
          matchesSearch={matchesSearch}
          isAdmin={isAdmin}
          useLevels={!!t.config.useLevels}
          showLevelsToggle={showLevelsToggle}
          players={t.players}
        />
      ) : (
        <HistoryRound
          round={t.rounds[viewingRound - 1]}
          matchesSearch={matchesSearch}
          isAdmin={isAdmin}
          useLevels={!!t.config.useLevels}
          showLevelsToggle={showLevelsToggle}
          players={t.players}
        />
      )
    ) : (
      <CourtsAmericano
        t={t}
        isAdmin={isAdmin}
        ls={ls}
        setLs={setLs}
        allSaved={allSaved}
        onSave={onSave}
        onNext={onNext}
        onEdit={onEdit}
        matchesSearch={matchesSearch}
        persist={persist}
        isFinished={isFinished}
        showLevelsToggle={showLevelsToggle}
      />
    )}
  </>
)}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: build succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/play/PlayAmericano.jsx
git commit -m "feat: mostrar todas las rondas al filtrar por jugador en Americano"
```

---

## Task 4: Add player filter and `PozoAllRoundsView` in PlayPozo

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

- [ ] **Step 1: Add `search` state and computed values**

In `PlayPozo`, after the existing state declarations (after `const [showFinishModal, setShowFinishModal] = useState(false);`, around line 35), add:

```jsx
const [search, setSearch] = useState(null);
```

Then, after the `allSaved` and `isFinished` computations (after line 278), add:

```jsx
const isMixer = t.config?.pozoMode === "mixer";
const allPozoEntities = isMixer
  ? [...(t.players || [])].sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, label: p.name }))
  : [...(t.pairs || [])].sort((a, b) => `${a.p1} ${a.p2}`.localeCompare(`${b.p1} ${b.p2}`))
      .map((p) => ({ id: p.id, label: `${p.p1} / ${p.p2}` }));

function matchesPozoSearch(court) {
  if (!search) return true;
  if (isMixer) {
    return (court.pairA?._playerIds || []).map(String).includes(String(search)) ||
           (court.pairB?._playerIds || []).map(String).includes(String(search));
  }
  return String(court.pairA?.id) === String(search) || String(court.pairB?.id) === String(search);
}
```

- [ ] **Step 2: Add `PozoAllRoundsView` component at the bottom of the file**

Add this new component at the very end of `PlayPozo.jsx`, after the last closing brace:

```jsx
function PozoAllRoundsView({ t, isAdmin, ls, setLs, onSaveCourt, onEditCourt, matchesSearch, highlightId }) {
  const isMixer = t.config?.pozoMode === "mixer";

  function renderPair(pair, highlight) {
    const name = pair ? `${pair.p1} / ${pair.p2}` : "TBD";
    return (
      <span className={`text-sm leading-snug ${highlight ? "font-black text-sky-300" : "font-bold text-gray-50"}`}>
        {name}
      </span>
    );
  }

  function getHighlight(pair) {
    if (!highlightId) return false;
    if (isMixer) return (pair?._playerIds || []).map(String).includes(String(highlightId));
    return String(pair?.id) === String(highlightId);
  }

  function renderHistoricalCourt(court, ci) {
    const a = parseInt(court.scoreA), b = parseInt(court.scoreB);
    const wonA = !isNaN(a) && !isNaN(b) && a > b;
    const wonB = !isNaN(a) && !isNaN(b) && b > a;
    return (
      <div key={ci} className="px-4 py-4 border-t border-gray-800 first:border-0">
        <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
          <div className="flex flex-col items-end self-center">
            {renderPair(court.pairA, getHighlight(court.pairA))}
          </div>
          <div className="flex items-center gap-1.5 self-center">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>{court.scoreA}</div>
            <span className="text-gray-600 font-black text-lg">-</span>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"}`}>{court.scoreB}</div>
          </div>
          <div className="flex flex-col items-start self-center">
            {renderPair(court.pairB, getHighlight(court.pairB))}
          </div>
        </div>
      </div>
    );
  }

  function renderCurrentCourt(court, ci) {
    const sA = ls[`${ci}_A`] ?? (court.scoreA != null ? String(court.scoreA) : "");
    const sB = ls[`${ci}_B`] ?? (court.scoreB != null ? String(court.scoreB) : "");
    const a = parseInt(sA), b = parseInt(sB);
    const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
    const wonA = court.saved && parseInt(court.scoreA) > parseInt(court.scoreB);
    const wonB = court.saved && parseInt(court.scoreB) > parseInt(court.scoreA);
    return (
      <div key={ci} className="px-4 py-4 border-t border-gray-800 first:border-0">
        <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "10px" }}>
          <div className="flex flex-col items-end self-center">
            {renderPair(court.pairA, getHighlight(court.pairA))}
          </div>
          <div className="flex items-center gap-1.5 self-center">
            {court.saved ? (
              <>
                <div onClick={() => isAdmin && onEditCourt(ci)} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonA ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}>{court.scoreA}</div>
                <span className="text-gray-600 font-black text-lg">-</span>
                <div onClick={() => isAdmin && onEditCourt(ci)} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${wonB ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}>{court.scoreB}</div>
              </>
            ) : isAdmin ? (
              <>
                <input type="number" min="0" value={sA} onKeyDown={(e) => ["-","e",".",","].includes(e.key) && e.preventDefault()} onChange={(e) => setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))} className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-gray-600 font-black text-lg">-</span>
                <input type="number" min="0" value={sB} onKeyDown={(e) => ["-","e",".",","].includes(e.key) && e.preventDefault()} onChange={(e) => setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))} className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </>
            ) : (
              <span className="text-gray-600 font-black text-lg">–</span>
            )}
          </div>
          <div className="flex flex-col items-start self-center">
            {renderPair(court.pairB, getHighlight(court.pairB))}
          </div>
        </div>
        {isAdmin && !court.saved && valid && (
          <div className="pt-3">
            <button onClick={() => onSaveCourt(ci)} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#d97706] hover:bg-[#b45309] text-white cursor-pointer transition-colors">
              Guardar resultado
            </button>
          </div>
        )}
      </div>
    );
  }

  const pastRounds = t.pozoRounds || [];
  const hasAnyContent = pastRounds.length > 0 || (t.currentPozoRound?.length > 0);

  if (!hasAnyContent) {
    return <div className="text-center text-gray-600 py-8 text-sm">Aún no hay rondas</div>;
  }

  return (
    <div className="space-y-3">
      {pastRounds.map((round, ri) => {
        const filteredCourts = (round.courts || [])
          .map((court, ci) => ({ court, ci }))
          .filter(({ court }) => matchesSearch(court));
        return (
          <div key={ri} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700">
              <span className="text-xs font-bold text-gray-500 tracking-widest">RONDA {round.num}</span>
              <span className="ml-2 text-xs text-green-400 font-semibold">✓ completada</span>
            </div>
            {filteredCourts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">⏳ Descansó</div>
            ) : (
              filteredCourts.map(({ court, ci }) => renderHistoricalCourt(court, ci))
            )}
          </div>
        );
      })}

      {t.currentPozoRound?.length > 0 && (() => {
        const filteredCourts = (t.currentPozoRound || [])
          .map((court, ci) => ({ court, ci }))
          .filter(({ court }) => matchesSearch(court));
        return (
          <div className="bg-[#1f2937] rounded-2xl border border-sky-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-2">
              <span className="text-xs font-bold text-sky-400 tracking-widest">RONDA {t.roundNum}</span>
              <span className="text-xs text-sky-400 font-semibold">● EN CURSO</span>
            </div>
            {filteredCourts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-amber-400 font-semibold">⏳ Descansa esta ronda</div>
            ) : (
              filteredCourts.map(({ court, ci }) => renderCurrentCourt(court, ci))
            )}
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 3: Add filter dropdown and wire conditional render in PlayPozo Courts tab**

In the Courts tab render (`{tab === "courts" && (`), replace:
```jsx
{tab === "courts" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Timer */}
```

With:
```jsx
{tab === "courts" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* ── Filtro por jugador ── */}
    <div className="w-full sm:max-w-xs">
      <label className="text-xs text-gray-500 font-semibold block mb-1.5">🔍 Filtrar por jugador</label>
      <select
        value={search ?? ""}
        onChange={(e) => setSearch(e.target.value === "" ? null : e.target.value)}
        className="w-full bg-[#1f2937] border border-gray-700 rounded-xl text-gray-50 px-4 py-2.5 text-sm outline-none"
      >
        <option value="">{isMixer ? "👥 Todos los jugadores" : "👥 Todas las parejas"}</option>
        {allPozoEntities.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </div>

    {search ? (
      <PozoAllRoundsView
        t={t}
        isAdmin={isAdmin}
        ls={ls}
        setLs={setLs}
        onSaveCourt={onSaveCourt}
        onEditCourt={onEditCourt}
        matchesSearch={matchesPozoSearch}
        highlightId={search}
      />
    ) : (
      <>
        {/* Timer */}
```

Then close the `search ? ... :` ternary by wrapping the existing timer + courts + buttons block in a fragment `<>...</>` and closing `)}` after the last button/spectator-message block.

Find the last line of the existing courts content — the `{!isAdmin && !allSaved && (` block — and after its closing `)}`, add:
```jsx
      </>
    )}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/PlayPozo.jsx
git commit -m "feat: agregar filtro por jugador con vista todas las rondas en El Pozo"
```

---

## Manual Verification Checklist

After both tasks are committed:

- [ ] Americano — select a player → round tabs disappear, all rounds shown stacked
- [ ] Americano — filtered player's name is bold/highlighted in every card
- [ ] Americano — current round card shows score inputs for admin, read-only for guest
- [ ] Americano — deselect filter → round tabs return, normal view restored
- [ ] Americano — player who sat out a round shows "Descansa esta ronda" for that round
- [ ] Americano — future precomputed rounds (if any) appear below current round
- [ ] El Pozo (fixed mode) — filter dropdown lists pairs; selecting one shows all rounds
- [ ] El Pozo (mixer mode) — filter dropdown lists players; selecting one shows all rounds
- [ ] El Pozo — current round card admin-editable, guest read-only
- [ ] El Pozo — deselect filter → timer + normal courts view restored
- [ ] Build is clean: `npm run build` with no errors
