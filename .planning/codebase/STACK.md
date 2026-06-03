# Technology Stack

**Analysis Date:** 2026-06-03

## Languages

**Primary:**
- JavaScript (ES2022) - Used for all application code, components, and logic

**Secondary:**
- JSX - React component syntax throughout `src/components/` and page components

## Runtime

**Environment:**
- Node.js 20.x (recommended, no explicit version constraint)

**Package Manager:**
- npm 10.x
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- React 18.3.1 - UI component library (`src/components/`, page components)
- React DOM 18.3.1 - DOM rendering (`src/main.jsx`)
- React Router DOM 7.16.0 - Routing (`src/App.jsx`, useNavigate hooks throughout)

**Styling:**
- Tailwind CSS 4.3.0 - Utility-first CSS framework via `@tailwindcss/vite` plugin
- Custom CSS variables via `@theme` in `src/index.css` (color system)

**Testing:**
- Vitest 4.1.8 - Test runner (`vitest run` command)
- Firebase Rules Unit Testing 5.0.1 - Firestore security rules testing

**Build/Dev:**
- Vite 5.4.10 - Bundler and dev server (`src/main.jsx` entry point)
- @vitejs/plugin-react 4.3.3 - React Fast Refresh for Vite
- ESLint 9.13.0 - Code linting (`eslint.config.js`)
- eslint-plugin-react 7.37.2 - React-specific linting rules
- eslint-plugin-react-hooks 5.0.0 - React hooks linting
- eslint-plugin-react-refresh 0.4.14 - React Refresh validation

## Key Dependencies

**Critical:**
- firebase 12.13.0 - Backend infrastructure (Firestore database, Firebase Authentication, Google Auth)
  - Modules used: `firebase/app`, `firebase/firestore`, `firebase/auth`
  - Why it matters: Only backend service; entire data persistence, auth, and real-time sync depends on it

**Infrastructure:**
- firebase-admin 13.10.0 - Admin SDK for rules testing and server-side operations
- globals 15.11.0 - ESLint globals definitions for browser environment
- @types/react 18.3.12 - TypeScript type definitions (installed but not used; project is JavaScript-only)
- @types/react-dom 18.3.1 - TypeScript type definitions (installed but not used; project is JavaScript-only)

## Configuration

**Environment:**
- `.env` file with `VITE_FIREBASE_API_KEY` - Vite public environment variable for Firebase API key
- Firebase project ID: `app-padel-torneo`
- Firebase auth domain: `app-padel-torneo.firebaseapp.com`
- Firestore collection: `torneos/{code}` - tournaments stored as documents with `data`, `ownerUid`, `createdAt` fields

**Build:**
- `vite.config.js` - Bundler configuration with React and Tailwind plugins
  - Manual chunk splitting: `vendor-react` and `vendor-firebase` for optimization
  - Test environment: Node.js (for unit tests)
- `eslint.config.js` - ESLint configuration with React, hooks, and refresh plugins
- `firebase.json` - Firebase hosting and Firestore emulator configuration
- `.firebaserc` - Firebase project alias (`app-padel-torneo` as default)

## Platform Requirements

**Development:**
- Node.js 20.x or compatible
- npm 10.x
- Web browser with ES2022 support

**Production:**
- Firebase Hosting (configured in `firebase.json`)
- Firestore database (Cloud Firestore in Firebase project)
- Firebase Authentication
- Google OAuth 2.0 provider

---

*Stack analysis: 2026-06-03*
