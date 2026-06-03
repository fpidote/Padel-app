# Codebase Concerns

**Analysis Date:** 2026-06-03

## Tech Debt

**useTournament.js — Mixed Responsibilities:**
- Issue: Hook mixes three concerns: auth state, Firestore listener, and persist logic
- Files: `src/hooks/useTournament.js`
- Impact: Hard to test, difficult to extend with new data sources, mutation logic tightly coupled
- Fix approach: Divide into separate hooks (useAuth, useFirestoreListener, usePersist) or use a custom state reducer

**Component Size & Complexity:**
- Issue: Large components handle multiple concerns (rendering, local state, persistence, business logic)
- Files: `src/components/play/PlayAmericano.jsx` (844 lines), `src/components/setup/SetupPairs.jsx` (822 lines), `src/components/setup/SetupAmericano.jsx` (794 lines), `src/components/play/PlayMundialito.jsx` (781 lines)
- Impact: Difficult to test, high cognitive load, increased bug surface area, hard to reuse logic
- Fix approach: Extract business logic into pure functions, separate UI into smaller components (CardComponent, FormComponent, etc.), use composition

**B() Utility Function — Deprecated & Inconsistent:**
- Issue: Many Play/Setup components still use `B()` function (legacy) instead of Tailwind classes
- Files: `src/components/play/PlayPozo.jsx`, `src/components/play/PlayRelampago.jsx`, `src/logic/constants.js`
- Impact: Mixed styling approach, harder to maintain, inconsistent with design guidelines in CLAUDE.md
- Fix approach: Progressively migrate to Tailwind CSS utility classes, deprecate B() function entirely

**Missing Error Recovery for Firebase Operations:**
- Issue: No automatic retry or user-friendly recovery for transient Firebase errors
- Files: `src/hooks/useTournament.js`, `src/components/play/PlayPozo.jsx`, `src/Home.jsx`, `src/Panel.jsx`
- Impact: Network blips or temporary outages cause silent failures or confusing error messages
- Fix approach: Add retry logic with exponential backoff, implement offline-first queue, show clear network status to user

## Known Bugs

**Pozo Mode — Court Level Promotion Bug (T-PROMO-1 to T-PROMO-6 failing):**
- Symptoms: Winner does not consistently have higher courtLevel than loser in same match; promotion/demotion between courts is incorrect
- Files: `src/logic/pozo.js` (lines 28-66), `src/logic/pozo.test.js` (lines 130-246)
- Trigger: Run `npm test` — tests T-PROMO-1 through T-PROMO-6 are marked as failing/pending
- Workaround: None — Pozo mode is partially broken for multi-court promotion logic
- Root cause: `applyPozoRoundResults()` formula `courts + 1 - court.courtNum` for winner and `courts - 1 - court.courtNum` for loser does not maintain invariant that winner.courtLevel > loser.courtLevel
- Fix path: Rewrite courtLevel assignment to guarantee winner always beats loser, respect court hierarchy (cancha 1 = highest, etc.)

**Panel.jsx — Unprotected JSON.parse:**
- Symptoms: If a tournament document has corrupted `data` field (invalid JSON), the entire Panel view crashes
- Files: `src/Panel.jsx` (line 41)
- Trigger: Create a tournament manually in Firestore with invalid JSON in `data` field
- Workaround: Manually fix the document in Firestore
- Root cause: `JSON.parse(d.data().data)` has no try/catch, unlike `useTournament.js` (line 39)
- Fix path: Wrap in try/catch, skip corrupted tournaments or show error state

## Security Considerations

**Firestore Rules — Spectator Read Access Too Broad:**
- Risk: Any unauthenticated user can read the full tournament document (including all config, scores, team compositions) if they know the code
- Files: `firestore.rules.test.js` (lines 58-63)
- Current mitigation: Relies on code obscurity (6-char alphanumeric), no formal access control
- Recommendations: 
  - Implement per-user session tokens if privacy is required
  - Document that tournaments are publicly readable by design (shareable via WhatsApp)
  - Add admin-only fields (if any future sensitive data) and protect in rules

**ownerUid Persistence — Merge Behavior Critical:**
- Risk: If developer accidentally removes `{ merge: true }` from any `setDoc()` call, `ownerUid` gets deleted, tournament becomes orphaned
- Files: `src/hooks/useTournament.js` (line 71)
- Current mitigation: Explicit inline comment + CLAUDE.md guidance
- Recommendations:
  - Create helper function `persistTournament(code, data)` to enforce merge behavior
  - Add linter rule to catch `setDoc(doc(db, "torneos"...` without `{ merge: true }`
  - Document in firestore.rules that `ownerUid` must never be null

**Auth State — Admin Check Relies on Client-Side Match:**
- Risk: `isAdmin = auth.currentUser.uid === t.ownerUid` is correct, but if `t` is stale, could allow brief windows of abuse
- Files: `src/hooks/useTournament.js` (line 14)
- Current mitigation: Firestore rules enforce `ownerUid` check on update (line 157-164 of firestore.rules.test.js)
- Recommendations:
  - Ensure Firestore rules are always enforced in production (not just tests)
  - Add audit logging for all tournament mutations
  - Consider server-side validation for sensitive operations (finish tournament, delete)

## Performance Bottlenecks

**Americano Precomputation — All 12 Rounds Generated Upfront:**
- Problem: `precomputeAllRounds()` generates every round before any are played
- Files: `src/logic/americano.js` (lines 4-34)
- Cause: Historical design; works fine for 12 rounds but adds latency on tournament start
- Improvement path: Lazy-load rounds — compute only when `onNext()` is called, or batch-compute on-demand

**Merkle History Tracking in Americano Individual Mode:**
- Problem: `partnerHistory` object tracks every pair combination ever seen; scales O(n²) with active players
- Files: `src/components/play/PlayAmericano.jsx` (line 80, 83)
- Cause: Prevents re-pairing too soon, but object grows unbounded
- Improvement path: Implement sliding window (keep only last N rounds) or use counter per pair (last-played-round-number)

**getDocs() in PlayPozo.jsx — No Pagination:**
- Problem: `loadStats()` fetches all matches without limit
- Files: `src/components/play/PlayPozo.jsx` (lines 37-46)
- Cause: Assumes small match counts; will fail if tournament has 100+ matches
- Improvement path: Add limit, implement pagination/infinite scroll, or aggregate stats server-side

**Re-rendering PlayAmericano/SetupPairs — No Memoization:**
- Problem: Components re-render on every prop change, even if data didn't change
- Files: `src/components/play/PlayAmericano.jsx`, `src/components/setup/SetupPairs.jsx`
- Cause: No `React.memo()`, no memoized callbacks, no `useMemo()` for derived state
- Improvement path: Wrap component in `React.memo()`, memoize expensive computations, use `useCallback()` for persist handlers

## Fragile Areas

**Pozo Mode Shuffling & Court Assignment:**
- Files: `src/logic/pozo.js` (lines 68-101), `src/components/play/PlayPozo.jsx`
- Why fragile: Relies on exact matching of `courtLevel` ranges to assign players to courts; if courtLevel is corrupted, entire rotation breaks
- Safe modification: Write comprehensive tests for edge cases (7 players, 1 court; 4 players, 2 courts, etc.); validate courtLevel invariant before building round
- Test coverage: `src/logic/pozo.test.js` covers basic cases but is incomplete (T-PROMO tests failing)

**Americano Partner Separation & Sitting Out Selection:**
- Files: `src/logic/americano.js` (lines 119-158), `src/components/play/PlayAmericano.jsx` (lines 75-130)
- Why fragile: Uses two separate tracking objects (`partnerHistory`, `sitOutHistory`) that must stay in sync; if one is missed in a persist, state diverges
- Safe modification: Consolidate tracking into a single object or use immutable state snapshot for each round
- Test coverage: `src/logic/americano.test.js` covers basic building but not sit-out fairness over many rounds

**Firestore Document Schema — No Version Migration:**
- Files: `src/firebase.js`, `src/hooks/useTournament.js`
- Why fragile: If schema changes (e.g., add new `config` field), old tournaments still have old structure; code assumes new structure
- Safe modification: Add schema versioning (include `schemaVersion` in tournament doc), implement upgrade path
- Test coverage: No tests for schema evolution

## Scaling Limits

**Firestore Collection Growth:**
- Current capacity: Untested, but Firebase allows millions of documents per collection
- Limit: Query performance degrades if organizing by date without proper index; no pagination in Panel
- Scaling path: 
  - Implement subcollections by month (e.g., `torneos/{YYYY-MM}/...`)
  - Add firestore index on `ownerUid + createdAt` for efficient queries
  - Paginate Panel query to load 10-20 tournaments at a time

**Real-Time Listener Concurrency:**
- Current capacity: Single listener per browser tab
- Limit: If user opens multiple tournament tabs, each maintains separate listener — wastes bandwidth
- Scaling path: Implement shared listener (e.g., BroadcastChannel API) or move to singleton pattern

**In-Memory State Size:**
- Current capacity: Fine for <100 players, <12 rounds
- Limit: `t` object grows with round history; if tournament runs 50+ rounds, JSON serialization becomes slow
- Scaling path: Archive old rounds to subcollection, keep only current + next round in main doc

## Dependencies at Risk

**Firebase Auth — No Offline Fallback:**
- Risk: If Google Auth is down, cannot create tournaments (auth popup fails)
- Impact: Users blocked from starting new tournaments
- Migration plan: Add email/password fallback auth, or implement offline-first queue for tournament creation

**Firestore — No Local Persistence:**
- Risk: Offline browser tab cannot read/edit tournament, loses work if network drops
- Impact: Spectators see outdated standings, admins lose unsaved edits
- Migration plan: Enable Firestore local persistence (`enableIndexedDbPersistence()`), implement optimistic updates with rollback

## Missing Critical Features

**Tournament Completion & Archive:**
- Problem: No `status: "finished"` workflow; tournaments exist forever and clutter Panel view
- Blocks: Cannot export results, cannot run end-of-tournament analytics, Cannot properly deprecate old tournaments
- Recommendations: Implement finish flow (mark status, archive to subcollection), add export-to-CSV, show archive view in Panel

**Error Toast Component:**
- Problem: Using `alert()` for errors (line 76 in useTournament.js, line 62 in Home.jsx); blocks UI and looks unprofessional
- Blocks: Cannot show multiple errors, cannot auto-dismiss, cannot batch errors
- Recommendations: Build Toast component, use context/queue for managing notifications

**Offline Mode & Sync Queue:**
- Problem: If network fails mid-update, no queue of pending changes; user doesn't know if changes saved
- Blocks: Using tournaments in poor connectivity (common in sports venues)
- Recommendations: Implement local queue with Firebase SDK's pending writes, show sync status UI

## Test Coverage Gaps

**useTournament.js Hook:**
- What's not tested: Listener setup/cleanup, version collision detection, error handling from Firebase, optimistic updates with rollback
- Files: `src/hooks/useTournament.js`
- Risk: Race conditions (double-click persist), corrupted state from stale listener, auth state not syncing
- Priority: High — this is the central state management layer

**Play Components (PlayAmericano, PlayRelampago, PlayMundialito, PlayPozo):**
- What's not tested: onNext flow, score entry validation, error handling for persist failures, edge cases (tie scores, empty rounds, single player)
- Files: `src/components/play/*.jsx`
- Risk: Incorrect state transitions, silent failures, broken round progression
- Priority: High — these drive core tournament functionality

**Setup Components (SetupAmericano, SetupPairs):**
- What's not tested: Debounced persist, player addition/removal, start flow validation, error states
- Files: `src/components/setup/*.jsx`
- Risk: Duplicate players, lost player data, tournament starts with invalid config
- Priority: Medium — less critical than Play, but UX-breaking

**Firestore Rules:**
- What's not tested: Subcollection access (matches), batch updates, transaction isolation
- Files: `firestore.rules.test.js`
- Risk: Data corruption, unauthorized reads/writes to matches subcollection
- Priority: High — security-critical

**Integration Tests:**
- What's not tested: Full user flow (create → config → start → play → finish), multi-user scenarios, offline/online transitions
- Files: None exist
- Risk: End-to-end workflows broken without catching in unit tests
- Priority: Medium — time-consuming to set up, but catches integration bugs

---

*Concerns audit: 2026-06-03*
