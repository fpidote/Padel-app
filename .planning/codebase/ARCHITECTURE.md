<!-- refreshed: 2026-06-03 -->
# Architecture

**Analysis Date:** 2026-06-03

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         React Routing Layer                               │
│           (BrowserRouter + React Router DOM - src/App.jsx)               │
├────────────────────┬──────────────────────┬──────────────────────────────┤
│   Home / Create    │   TournamentPage     │   Panel (Admin)              │
│   (src/Home.jsx)   │   (src/TournamentPage│   (src/Panel.jsx)            │
│                    │    .jsx)             │                              │
└────────┬───────────┴──────────┬───────────┴──────────────────┬───────────┘
         │                      │                              │
         │                      ▼                              │
         │          ┌─────────────────────────┐                │
         │          │ useTournament Hook      │                │
         │          │ (src/hooks/useTournament│                │
         │          │ .js)                    │                │
         │          │                         │                │
         │          │ • Auth state listener   │                │
         │          │ • Firestore listener    │                │
         │          │ • Version control       │                │
         │          │ • persist() function    │                │
         │          └────────────┬────────────┘                │
         │                       │                              │
         ▼                       ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Setup Components (Setup Layer)                         │
│    (src/components/setup/SetupAmericano.jsx, SetupPairs.jsx)            │
│                                                                           │
│  • Player/pair input and configuration                                   │
│  • Tournament config (name, location, time, rules)                       │
│  • Pre-compute initial round                                             │
│  • Status validation before starting                                     │
└─────────────────┬──────────────────────────────────────────┬─────────────┘
                  │                                          │
                  │            t.status = "playing"          │
                  ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Play Components (Play Layer)                         │
│     (src/components/play/PlayAmericano.jsx, PlayRelampago, etc.)        │
│                                                                           │
│  • Round management and display                                          │
│  • Score input and validation                                            │
│  • Live standings and brackets                                           │
│  • Advance to next round logic                                           │
└─────────────────┬──────────────────────────────────────────┬─────────────┘
                  │                                          │
                  └──────────────────────┬───────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Logic Layer (Pure Functions)                         │
│  (src/logic/americano.js, relampago.js, mundialito.js, pozo.js)        │
│                                                                           │
│  • Round generation and tournament progression                           │
│  • Matchmaking algorithms                                                │
│  • Bracket advancement                                                   │
│  • Statistics and standings calculation                                  │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Firestore (Data Persistence)                            │
│   Collection: torneos/{code}                                              │
│   Fields: data (JSON), ownerUid, createdAt                               │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | Route dispatcher, loads BrowserRouter | `src/App.jsx` |
| Home | Tournament creation UI, Google Auth, landing page | `src/Home.jsx` |
| TournamentPage | Dispatcher: loads tournament from Firestore and renders correct setup/play component | `src/TournamentPage.jsx` |
| Panel | Admin dashboard: lists user's tournaments, Firestore query on ownerUid | `src/Panel.jsx` |
| SetupAmericano | Americano tournament configuration (players, rounds, levels) | `src/components/setup/SetupAmericano.jsx` |
| SetupPairs | Pairs tournament configuration (relampago, mundialito, pozo) | `src/components/setup/SetupPairs.jsx` |
| PlayAmericano | Americano live play: round display, score input, standings | `src/components/play/PlayAmericano.jsx` |
| PlayRelampago | Double-elimination bracket display and management | `src/components/play/PlayRelampago.jsx` |
| PlayMundialito | Group phase + knockout bracket | `src/components/play/PlayMundialito.jsx` |
| PlayPozo | King of the Hill timer and pista ranking | `src/components/play/PlayPozo.jsx` |
| useTournament | Central state hook: Firebase listener + persist + auth | `src/hooks/useTournament.js` |
| americano | Round precomputation, matchmaking with partner history tracking | `src/logic/americano.js` |
| relampago | Double-elimination bracket generation and advancement | `src/logic/relampago.js` |
| mundialito | Group creation and knockout bracket generation | `src/logic/mundialito.js` |
| pozo | King of the Hill round creation and advancement | `src/logic/pozo.js` |
| stats | Win/loss calculation, standings ranking | `src/logic/stats.js` |

## Pattern Overview

**Overall:** Single-Page Application (SPA) with Firebase as backend. Dispatcher pattern for routing between tournament types. State management via React hooks + Firestore listener. Render props for shared UI components.

**Key Characteristics:**
- **No TypeScript:** JavaScript ES2022
- **No global state library (Redux/Zustand):** `useTournament` hook centralizes state
- **Firestore-first:** Real-time listener drives UI updates
- **Version-controlled mutations:** Optimistic updates with rollback on error
- **Tournament polymorphism:** Four tournament types (Americano, Relámpago, Mundialito, El Pozo) each with own setup and play logic

## Layers

**Routing Layer:**
- Purpose: Entry point and route dispatcher
- Location: `src/App.jsx`, `src/main.jsx`
- Contains: BrowserRouter, Routes, lazy-loaded components
- Depends on: React Router DOM
- Used by: Browser, end user

**Home/Auth Layer:**
- Purpose: Tournament creation and Google Auth
- Location: `src/Home.jsx`
- Contains: Tournament type selection, auth flow, Firestore tournament initialization
- Depends on: Firebase Auth, Firestore, `buildInitialTournament`
- Used by: User before entering tournament

**Admin Panel Layer:**
- Purpose: User's dashboard of tournaments
- Location: `src/Panel.jsx`
- Contains: List tournaments via Firestore query on `ownerUid`, delete operation
- Depends on: `useTournament` (partial), Firestore query
- Used by: Authenticated organizers

**Tournament Dispatcher:**
- Purpose: Load tournament and render correct UI based on status/type
- Location: `src/TournamentPage.jsx`
- Contains: `useTournament` hook call, conditional rendering for setup vs play, lazy loading components
- Depends on: All setup and play components, `useTournament`
- Used by: Route `/torneo/:code`

**Setup Layer:**
- Purpose: Player/pair input, tournament configuration, status validation
- Location: `src/components/setup/SetupAmericano.jsx`, `src/components/setup/SetupPairs.jsx`
- Contains: Input fields with debounce, validation, pre-compute round
- Depends on: `useTournament` (persist), logic modules
- Used by: Tournament before `status = "playing"`

**Play Layer:**
- Purpose: Live tournament display, score input, round advancement
- Location: `src/components/play/PlayAmericano.jsx`, PlayRelampago, PlayMundialito, PlayPozo
- Contains: Round display, score input forms, standings views, modal messages
- Depends on: Logic modules, `useTournament` (persist), shared components
- Used by: Active tournament play

**Shared Components:**
- Purpose: Reusable UI elements across all tournament types
- Location: `src/components/shared/Components.jsx`, History.jsx, MatchCard.jsx, PairStandings.jsx
- Contains: THeader, Tabs, SimpleModal, PairName, History, Stats tables
- Depends on: Constants (colors, styles)
- Used by: All setup and play components

**Logic Layer:**
- Purpose: Pure functions for tournament rules and progression
- Location: `src/logic/americano.js`, relampago.js, mundialito.js, pozo.js, stats.js, utils.js
- Contains: Round/bracket generation, matchmaking, standings calculation, utilities
- Depends on: None (pure functions)
- Used by: Setup and Play components

**State Hook:**
- Purpose: Centralize Firebase listener, auth, and mutation logic
- Location: `src/hooks/useTournament.js`
- Contains: Firestore real-time listener, version control, persist with rollback
- Depends on: Firebase Auth, Firestore
- Used by: TournamentPage, all setup and play components

**Firebase Layer:**
- Purpose: Authentication and data persistence
- Location: `src/firebase.js`
- Contains: Firebase initialization, Firestore export, Auth export, GoogleAuthProvider
- Depends on: Firebase SDK
- Used by: useTournament, Home, Panel

## Data Flow

### Primary Request Path (Playing a Match)

1. **User submits score** in Play component (e.g., `PlayAmericano`) → `onSave()` handler
   - Location: `src/components/play/PlayAmericano.jsx:39-60` (onSave handler)
2. **Validate score** (no draw allowed, both positive) and call `persist()`
   - Location: `src/components/play/PlayAmericano.jsx:47`
3. **Update local state optimistically**, increment `ver`, set `saving=true`
   - Location: `src/hooks/useTournament.js:60-68`
4. **Write to Firestore** with `{ merge: true }` to preserve `ownerUid` and `createdAt`
   - Location: `src/hooks/useTournament.js:69-71`
5. **Firestore listener** (same hook) catches update, increments `verRef` guard, calls `setT()`
   - Location: `src/hooks/useTournament.js:29-46`
6. **React re-renders** Play component with updated tournament state
7. **On next round click**, call logic module (e.g., `buildRoundAmericano`) to compute next courts/standings
   - Location: `src/components/play/PlayAmericano.jsx:75-110` (onNext handler)
8. **Persist new round** with incremented `ver`

### Setup Flow

1. **User enters Setup component** (e.g., `SetupAmericano`)
2. **Local state** holds player inputs (name, level) separately from `t` for debounce
   - Location: `src/components/setup/SetupAmericano.jsx:35-54`
3. **On input change**, update local state immediately + debounce `persist()` call (600ms)
   - Location: `src/components/setup/SetupAmericano.jsx` (each handleChange)
4. **Firestore listener** updates tournament when received
5. **Validation logic** checks if enough players to fill courts
   - Location: `src/components/setup/SetupAmericano.jsx:77-79` (statusMsg computation)
6. **On "Start Tournament"**, call `precomputeAllRounds()` (Americano) or similar
   - Location: `src/components/setup/SetupAmericano.jsx` (onStart handler)
7. **Set `status = "playing"`** and persist
8. **TournamentPage re-renders**, now shows Play component instead of Setup

### Authentication Flow

1. **User clicks "Crear Torneo"** on Home → `handleCreateClick()`
   - Location: `src/Home.jsx:53-65`
2. **Check if `auth.currentUser` exists**
3. **If not, call `signInWithPopup(auth, GoogleAuthProvider)`**
   - Location: `src/Home.jsx:56`
4. **Google auth popup appears**
5. **On success**, create tournament with `auth.currentUser.uid` as `ownerUid`
   - Location: `src/Home.jsx:67-77`
6. **On Panel**, `onAuthStateChanged` listener redirects to home if `user === null`
   - Location: `src/Panel.jsx:24-29`

**State Management:**
- Local component state for form inputs (separate from `t`)
- Firestore doc as source of truth for `t`
- `verRef` guard prevents race conditions from concurrent updates
- Optimistic updates: change UI immediately, rollback on Firestore error

## Key Abstractions

**Tournament (t):**
- Purpose: Complete tournament state object
- Examples: `src/logic/initTournament.js` (all tournament type schemas)
- Pattern: Immutable by convention; persist creates new object with `ver` incremented

**Player/Pair:**
- Purpose: Atomic unit of participation (individual or duo)
- Examples: `{ id: 1, name: "John", level: 2 }` or `{ id: 1, p1: "John", p2: "Jane" }`
- Pattern: Arrays (`players[]` or `pairs[]`) in tournament

**Round (Americano/Pozo):**
- Purpose: Single cycle of matches; courts + sitting out
- Examples: `{ courts: [ { pairA, pairB, scoreA, scoreB, saved }, ... ], sittingOut: [...] }`
- Pattern: Pre-computed array; current round is `t.currentRound`

**Court:**
- Purpose: Single match location
- Examples: `{ pairA, pairB, scoreA: "2", scoreB: "1", saved: true }`
- Pattern: Always two pairs (or BYE in relampago)

**Partner History (partnerHistory):**
- Purpose: Track pair combinations in Americano to avoid repeats
- Examples: `{ "1_2": 3, "1_3": 2 }` (pair 1+2 played 3 times)
- Pattern: Used in `bestSplit()` scoring in matchmaking
- Location: `src/logic/americano.js:45-76`

**Bracket (Relampago/Mundialito):**
- Purpose: Double-elimination or knockout tree
- Pattern: Recursive object tree; each node has `{ id, pairA, pairB, winner, child1, child2 }`
- Location: `src/logic/relampago.js`

## Entry Points

**Landing Page:**
- Location: `src/Home.jsx`
- Triggers: Browser navigates to `/` or root
- Responsibilities: Display tournament types, create new tournament, sign in with Google

**Tournament Join:**
- Location: `src/TournamentPage.jsx`
- Triggers: Browser navigates to `/torneo/{code}`
- Responsibilities: Load tournament from Firestore, check if admin, render setup or play

**Admin Panel:**
- Location: `src/Panel.jsx`
- Triggers: Browser navigates to `/panel`, user must be authenticated
- Responsibilities: List user's tournaments, allow deletion and navigation

**Firebase Initialization:**
- Location: `src/firebase.js`
- Triggers: App startup
- Responsibilities: Initialize Firebase SDK with env vars, export db and auth instances

## Architectural Constraints

- **Single-threaded event loop:** JavaScript runs async operations but single call stack
- **Global singletons:** `db` and `auth` exported from `src/firebase.js` (module-level singletons)
- **Firestore versioning:** `ver` field prevents race conditions but requires careful increment in persist
- **No circular imports:** File structure is flat enough to avoid them
- **Closure over `verRef`:** Anti-pattern risk in `useTournament` if component remounts — currently mitigated by `code` dependency

## Anti-Patterns

### Race Condition via Double-Click

**What happens:** User clicks "Save Score" twice before first request completes. Both calls execute `persist()`, overwriting each other.

**Why it's wrong:** Tournament state can become inconsistent or revert to stale value.

**Do this instead:** Use `saving` flag guard in `persist()` function:
```javascript
async function persist(newT) {
  if (saving) return;  // Early exit if already saving
  setSaving(true);
  // ... persist logic ...
  finally { setSaving(false); }
}
```
Location: `src/hooks/useTournament.js:60-61`

### Version Check Race Condition

**What happens:** Firestore listener receives old version after new one due to network delay. Listener ignores update correctly, but if not, UI reverts to stale state.

**Why it's wrong:** Can undo user's latest change.

**Do this instead:** Always check `data.ver <= verRef.current` before applying update:
```javascript
if (!data || data.ver <= verRef.current) return;
verRef.current = data.ver;
setT(data);
```
Location: `src/hooks/useTournament.js:44-46`

### Persist without merge: true

**What happens:** Calling `setDoc(doc, { data: JSON.stringify(...) })` without `{ merge: true }` overwrites entire document, deleting `ownerUid` and `createdAt`.

**Why it's wrong:** `ownerUid` is queryable field; losing it breaks Panel listing.

**Do this instead:** Always use `{ merge: true }`:
```javascript
await setDoc(doc(db, "torneos", code), {
  data: JSON.stringify(updated),
}, { merge: true });
```
Location: `src/hooks/useTournament.js:69-71`

### Inline Styles Mixed with Tailwind

**What happens:** Some components use inline `style={{}}` for dynamic colors while others use Tailwind classes. Inconsistent styling system.

**Why it's wrong:** Hard to maintain, contradicts Tailwind-first philosophy.

**Do this instead:** Use Tailwind classes; dynamic colors only for tournament format colors (defined in constants). Use CSS custom properties if needed.
Example correct pattern: `src/components/setup/SetupAmericano.jsx` (line 75 uses inline only for conditional bg/border)

---

*Architecture analysis: 2026-06-03*
