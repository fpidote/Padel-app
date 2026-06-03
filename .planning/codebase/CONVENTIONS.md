# Coding Conventions

**Analysis Date:** 2026-06-03

## Naming Patterns

**Files:**
- Components: PascalCase with `.jsx` extension — `PlayAmericano.jsx`, `SetupPairs.jsx`, `THeader.jsx`
- Logic/utility modules: camelCase with `.js` extension — `americano.js`, `utils.js`, `constants.js`, `initTournament.js`
- Tests: same name as implementation with `.test.js` suffix — `americano.test.js`, `pozo.test.js`, `stats.test.js`

**Functions:**
- Helper/exported functions: camelCase, descriptive — `buildFirstRoundAmericano()`, `buildRoundAmericano()`, `precomputeAllRounds()`, `applyPozoRoundResults()`, `calculateStats()`
- React components: PascalCase, often exported as default — `export default function PlayAmericano()`
- Internal helpers: camelCase, lowercase — `bestSplit()`, `highLevelClash()`, `matchBalance()`

**Variables:**
- Local state and hooks: camelCase — `[user, setUser]`, `[t, setT]`, `[showModal, setShowModal]`, `[menuOpen, setMenuOpen]`
- Object destructuring: camelCase — `{ code, isAdmin, persist, copyCode }`
- Ref hooks: camelCase with suffix `Ref` — `menuRef`, `modalRef`, `verRef`, `debRef`
- Lookup objects/maps: camelCase — `ph` (partner history), `soh` (sitting out history)

**Types/Constants:**
- Constants: UPPER_SNAKE_CASE or PascalCase for objects — `TOURNAMENT_TYPES`, `TOURNAMENT_RULES`, `LEVELS`, `BENEFITS`
- Enum-like objects: PascalCase keys or camelCase depending on use — `{ americano: "...", relampago: "...", mundialito: "...", pozo: "..." }`
- Singular properties: camelCase — `ownerUid`, `createdAt`, `currentRound`, `partnerHistory`, `courtLevel`

## Code Style

**Formatting:**
- No Prettier config detected — code uses manual formatting
- Indentation: 2 spaces (observed in package.json scripts and source files)
- Line length: variable, no strict limit enforced
- Semicolons: present throughout (not enforced by config, but consistently used)

**Linting:**
- Tool: ESLint (v9.13.0)
- Config: `eslint.config.js` (ES modules flat config)
- Plugins: react, react-hooks, react-refresh
- Key rules from config:
  - `'react-refresh/only-export-components'`: warns if non-component exports exist in component files
  - `'jsx-no-target-blank'`: disabled (allows blank targets)
  - Standard JS recommended rules applied
  - React recommended rules applied
  - React 18.3 setup auto-JSX mode enabled (no manual React import needed)

## Import Organization

**Order:**
1. React core and hooks — `import { useState, useEffect, useRef } from "react"`
2. React Router — `import { useNavigate } from "react-router-dom"`
3. Firebase modules — `import { onSnapshot, doc, setDoc } from "firebase/firestore"`, `import { auth, db, googleProvider } from "../firebase"`
4. Local logic/constants — `import { TOURNAMENT_TYPES } from "./logic/constants"`, `import { buildInitialTournament } from "./logic/initTournament"`
5. Local components/hooks — `import { SimpleModal } from "./components/shared/Components"`, `import { useTournament } from "../hooks/useTournament"`

**Path Aliases:**
- No path aliases detected — imports use relative paths exclusively (e.g., `../firebase`, `../../logic/utils`)

## Error Handling

**Patterns:**
- All async functions wrapped in try/catch blocks
- Errors logged with context via `console.error()` — e.g., `console.error("Error al crear torneo:", err)`
- User-facing errors shown via `alert()` — e.g., `alert("No se pudieron guardar los cambios.")`
- Firebase listener errors exposed as component state: `const [error, setError] = useState(null)` with error callback in `onSnapshot()`
- Specific error codes handled where appropriate — e.g., `if (err.code !== "auth/popup-closed-by-user")` to suppress expected user-canceled auth flows
- Race condition guards via saving state — `if (saving) return` prevents double-clicks during async operations
- Rollback pattern for persist failures — state reverted on Firebase write failures (`verRef.current = prevVer; setT(prevT)`)

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` only in catch blocks with context string — never `console.log()` in production code
- CLAUDE.md explicitly forbids `console.log()` in production
- Example: `console.error("Firebase listener:", err)` in error callbacks

## Comments

**When to Comment:**
- Comments used extensively to mark sections/phases of code with visual separators — `// ── Firebase Realtime Listener ──────────────────────────────`
- Function-level comments minimal — code is self-documenting via descriptive names
- Test IDs (T1, T2, etc.) embedded as comments in test suites to identify specific test cases
- Hallazgo (finding/observation) comments in critical sections — `// Hallazgo 1: rollback completo si setDoc falla`

**JSDoc/TSDoc:**
- Not used — project is JavaScript (not TypeScript) with no JSDoc patterns observed

## Function Design

**Size:**
- Helper functions typically 2-20 lines (e.g., `shuffle()`, `genCode()`, `pk()`)
- Component event handlers 10-50 lines with clear async/await flow
- Complex functions like `bestSplit()` under 40 lines with explanatory variable names
- No max line limit enforced, but functions generally remain focused

**Parameters:**
- Destructured objects for multiple props — `function PlayAmericano({ t, code, isAdmin, persist, copyCode, onEditTournament })`
- Single or few parameters passed as plain args — `buildFirstRoundAmericano(entities, courts, mode)`
- Rest parameters not commonly used — array/object destructuring preferred

**Return Values:**
- Explicit returns with clearly named outputs — `return { courts, sittingOut }`, `return { t, notFound, isAdmin, error, saving, persist, copyCode }`
- No implicit undefined returns — all code paths return or throw

## Module Design

**Exports:**
- Named exports for utility functions — `export function shuffle()`, `export const pk = (...)`
- Default export for React components — `export default function PlayAmericano()`
- Mixed approach: logic files use named exports, component files use default export

**Barrel Files:**
- Barrel files NOT used — each component/module imported directly
- Example: `import { THeader } from "../components/shared/Components"` (not from index)

## Inline Styles vs. Classes

**Inline Styles:**
- Widely used for dynamic styling — `style={{ color: lvl.color + "20" }}`
- Legacy `B()` helper function generates button styles inline — `style={B("#1e293b", { border: "1px solid #334155" })}`
- Color values often dynamically computed — `background: lvl.color + "20"` (adds alpha to hex)
- Component library approach: shared styles defined as objects and spread/modified — e.g., SimpleModal internal styles

**CSS Classes:**
- Tailwind CSS used sparingly in newer code
- No component-scoped CSS classes observed
- Only `@theme` variables and `.bg-hero` class in `index.css`
- Migration to Tailwind in progress per CLAUDE.md

## Testing Patterns (Code Organization)

**Test organization conventions observed in actual test files:**
- Helper functions at top of test file — `const p = (id, level = 0, pts = 0, gf = 0, gc = 0) => ({ ... })`
- Test suites grouped by function being tested — `describe("buildFirstRoundAmericano — pairs", ...)`
- Test cases numbered with T-prefix in comments for traceability — `// T9: schema del output`
- Specific algorithm assertions prefer readable variable names over magic numbers
- No mocks except for `shuffle()` in americano tests (mocked to be deterministic)

## Language Standard

**JavaScript Standard:**
- ES2022 (ecmaVersion: 2020 in ESLint, but "latest" in parserOptions)
- ES modules (`import`/`export` syntax, not CommonJS)
- No TypeScript — project is JavaScript (per CLAUDE.md: "Sin TypeScript")
- Optional chaining and nullish coalescing observed — `p.level ?? 0`, `authUser?.uid`

## Style Decisions (from CLAUDE.md enforced in code)

1. **No TypeScript** — all files are `.js` or `.jsx`
2. **Tailwind for new code** — but older components still use inline styles with `B()` helper
3. **Merge-true pattern** — Firebase persistence always uses `{ merge: true }` to preserve `ownerUid` and `createdAt` fields
4. **No console.log** — only `console.error()` in catch blocks
5. **Spanish comments and strings** — all user-facing text and many comments in Spanish
6. **Reactive state pattern** — `useTournament` hook centralizes all Firebase sync; components don't create their own listeners

---

*Convention analysis: 2026-06-03*
