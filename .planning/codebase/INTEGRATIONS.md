# External Integrations

**Analysis Date:** 2026-06-03

## APIs & External Services

**Tournament Management:**
- Firebase Firestore REST API - Real-time tournament state synchronization
  - SDK/Client: `firebase` 12.13.0 module (`firebase/firestore`)
  - Location: `src/firebase.js` (initialization), `src/hooks/useTournament.js` (listener and persist)

**Authentication:**
- Google Identity Platform - OAuth 2.0 sign-in for organizers
  - SDK/Client: `firebase` 12.13.0 module (`firebase/auth`)
  - Provider: `GoogleAuthProvider` from Firebase Auth
  - Location: `src/firebase.js` (provider initialization), `src/Home.jsx` (sign-in logic)

## Data Storage

**Databases:**
- Firebase Cloud Firestore (NoSQL document database)
  - Connection: `firebaseConfig` in `src/firebase.js`
  - Client: Firebase SDK (`firebase/firestore`)
  - Collection: `torneos/{code}` - tournament documents
  - Document structure:
    - `data` (string): JSON-stringified tournament state
    - `ownerUid` (string): organizer's Firebase Auth UID (first-level field for queryability)
    - `createdAt` (Timestamp): server timestamp of creation (first-level field for queryability)
  - Listener: `onSnapshot` in `src/hooks/useTournament.js`
  - Persist: `setDoc` with `{ merge: true }` in `src/hooks/useTournament.js` to preserve `ownerUid` and `createdAt`

**File Storage:**
- Local filesystem only - No external file storage service

**Caching:**
- Browser memory (React state) - Tournament state cached in component state via `useTournament` hook
- Firebase local cache - Built-in Firestore offline caching (no explicit configuration)

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Sign-in method: Google OAuth 2.0 (`GoogleAuthProvider`)
  - Implementation: `signInWithPopup` flow in `src/Home.jsx` (line 56)
  - Current user: `auth.currentUser` from `firebase/auth`
  - UID field: `auth.currentUser.uid` - stored in `ownerUid` field of tournament document
  - Anonymous access: Enabled for tournament spectators/players (can view tournament with `/torneo/{code}` link without login)
  - Admin determination: Pure client-side verification — `isAdmin = auth.currentUser.uid === t.ownerUid` in `src/hooks/useTournament.js`

## Monitoring & Observability

**Error Tracking:**
- Console-based only - `console.error()` for error logging
  - Firebase listener errors: `src/hooks/useTournament.js` line 50
  - Authentication errors: `src/Home.jsx` line 61
  - Persist errors: `src/hooks/useTournament.js` line 75
- Alert dialogs for user-facing errors (not production-grade error handling)

**Logs:**
- Browser console - Development/debugging only
- No centralized logging service (Sentry, DataDog, LogRocket, etc.)
- No analytics or user tracking

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting
  - Build output directory: `dist/` (Vite build target)
  - Public URL: `padeldesk.app`
  - Rewrites: All routes rewritten to `/index.html` for SPA routing

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or equivalent configured
- Manual deployment via Firebase CLI (`firebase deploy`)

## Environment Configuration

**Required env vars:**
- `VITE_FIREBASE_API_KEY` - Firebase public API key (in `.env`)

**Hardcoded Firebase config:**
- `authDomain`: `app-padel-torneo.firebaseapp.com`
- `projectId`: `app-padel-torneo`

**Secrets location:**
- `.env` file (local development only, not committed to git)
- Firebase project credentials managed via Firebase Console

## Webhooks & Callbacks

**Incoming:**
- None - Application is purely client-side

**Outgoing:**
- WhatsApp Web share link - `window.open()` to `https://wa.me/?text=...` in `src/hooks/useTournament.js` (line 90)
  - Purpose: Share tournament link with players via WhatsApp
  - Native Share API fallback: `navigator.share()` for mobile devices

## Real-Time Features

**Firestore Real-Time Listener:**
- `onSnapshot()` in `src/hooks/useTournament.js` (line 29)
  - Listens to `torneos/{code}` document for live updates
  - Synchronizes tournament state across all connected clients
  - Error handler exposes connection errors to state (`error` in component)

**Version Control (Anti-Race-Condition):**
- Tournament state includes `ver` integer field
- Each persist increments `ver` by 1
- Listener ignores updates with `ver <= verRef.current` to prevent infinite loops
- Optimistic update in `useTournament.js` followed by Firebase persistence

---

*Integration audit: 2026-06-03*
