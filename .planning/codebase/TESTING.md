# Testing Patterns

**Analysis Date:** 2026-06-03

## Test Framework

**Runner:**
- Vitest 4.1.8
- Config: `vite.config.js`
  - Test environment: `"node"` (no DOM, server-side logic focused)
  - Include pattern: `src/**/*.test.js`

**Assertion Library:**
- Vitest built-in expect API (Jest-compatible syntax)

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:rules       # Run Firestore rules tests (requires Firebase emulator)
```

Test execution output goes to stdout with pass/fail summary.

## Test File Organization

**Location:**
- Co-located with implementation in same directory
- Test files live alongside source in `src/logic/` for logic modules

**Naming:**
- Pattern: `[moduleName].test.js`
- Examples: `americano.test.js`, `pozo.test.js`, `stats.test.js`, `firestore.rules.test.js`

**Structure:**
```
src/logic/
├── americano.js         # Implementation
├── americano.test.js    # Tests for americano
├── pozo.js              # Implementation
├── pozo.test.js         # Tests for pozo
└── ...
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, test, expect, vi } from "vitest";
import { buildFirstRoundAmericano } from "./americano.js";

// ── Helpers ──────────────────────────────────────────────────
const p = (id, level = 0, pts = 0, gf = 0, gc = 0) => ({
  id,
  name: `P${id}`,
  level,
  pts,
  gf,
  gc,
});

// ═══════════════════════════════════════════════════════════════
// Function Name — What It Tests
// ═══════════════════════════════════════════════════════════════
describe("buildFirstRoundAmericano — pairs", () => {
  // T9: descriptive test purpose
  test("T9: each court has pairA, pairB, scoreA empty, scoreB empty and saved=false", () => {
    const pairs = [par("p1"), par("p2")];
    const result = buildFirstRoundAmericano(pairs, 1, "pairs");

    expect(result.courts).toHaveLength(1);
    const court = result.courts[0];
    expect(court).toHaveProperty("pairA");
    expect(court).toHaveProperty("pairB");
    expect(court.scoreA).toBe("");
    expect(court.scoreB).toBe("");
    expect(court.saved).toBe(false);
  });
});
```

**Patterns:**

1. **Helper factories at top** — Test data builders to avoid repetition
   - `const p = (id, level = 0, pts = 0, gf = 0, gc = 0) => ({ ... })`
   - `const pair = (id, pts = 0, courtLevel = 0, gf = 0, gc = 0) => ({ ... })`
   - `const court = (courtNum, pairA, pairB, scoreA, scoreB) => ({ ... })`

2. **Describe blocks grouped by function and aspect**
   - `describe("buildFirstRoundAmericano — pairs", ...)`
   - `describe("buildRoundAmericano — sitting out", ...)`
   - `describe("applyPozoRoundResults — promoción y descenso", ...)`

3. **Test IDs for traceability** — Test cases prefixed with `T<number>` in comments and test names
   - `// T9: schema del output`
   - `test("T9: cada cancha tiene pairA, pairB...", () => { ... })`

4. **Arrange-Act-Assert (AAA) pattern**
   ```javascript
   test("T7: with 2 pairs and 1 court, no pair sits out", () => {
     // Arrange
     const pairs = [par("p1"), par("p2")];
     
     // Act
     const { courts, sittingOut } = buildFirstRoundAmericano(pairs, 1, "pairs");

     // Assert
     expect(courts).toHaveLength(1);
     expect(sittingOut).toHaveLength(0);
   });
   ```

## Mocking

**Framework:** Vitest `vi` utilities

**Patterns:**
```javascript
// Mock entire module
vi.mock("./utils.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shuffle: (arr) => [...arr] };
});

// Reason: shuffle() is non-deterministic — mock to return array unchanged
// This ensures deterministic test results
```

**What to Mock:**
- Non-deterministic functions (`shuffle()` mocked to return unshuffled array)
- External modules with side effects (Firebase operations mocked via `@firebase/rules-unit-testing`)

**What NOT to Mock:**
- Core algorithm functions (test real behavior)
- Data transformation logic (test actual output)
- Utility functions like `pk()` (test with real implementation)

## Fixtures and Factories

**Test Data:**
```javascript
// Player/Pair factory
const p = (id, level = 0, pts = 0, gf = 0, gc = 0) => ({
  id,
  name: `P${id}`,
  level,
  pts,
  gf,
  gc,
});

// Court/Match factory
const court = (courtNum, pairA, pairB, scoreA, scoreB) => ({
  courtNum,
  pairA,
  pairB,
  scoreA: String(scoreA),
  scoreB: String(scoreB),
  saved: true,
});

// Usage in test
const players = [p("A", 4), p("B", 3), p("C", 2), p("D", 1)];
const result = buildFirstRoundAmericano(players, 1, "individual");
```

**Location:**
- Defined locally at top of each test file
- No shared test fixtures across files (each file self-contained)
- Factory names chosen for clarity: `p()` for players, `pair()` for pairs, `playerM()` for mundialito players

## Coverage

**Requirements:**
- None enforced — no coverage thresholds in `vite.config.js`
- Coverage optional, not part of CI pipeline

**View Coverage:**
```bash
# Not configured — would need vitest --coverage flag
# Current setup has no coverage reporter configured
```

## Test Types

**Unit Tests:**
- **Scope**: Pure logic functions (americano round building, pozo promotions, stats calculation)
- **Approach**: Test single functions in isolation with various inputs and edge cases
- **Example**: `buildFirstRoundAmericano()` with 2 pairs, 3 pairs, 5 pairs, etc.
- **File locations**: `src/logic/*.test.js`
  - `src/logic/americano.test.js` — 410 lines, 30+ test cases
  - `src/logic/pozo.test.js` — 497 lines, 35+ test cases
  - `src/logic/stats.test.js` — 77 lines, 7 test cases

**Integration Tests:**
- **Scope**: Firestore security rules and multi-step flows
- **Approach**: Test rules against simulated auth contexts and document structures
- **Framework**: `@firebase/rules-unit-testing`
- **File location**: `firestore.rules.test.js` (root directory)
- **Setup pattern**:
  ```javascript
  let testEnv;
  
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "app-padel-torneo",
      firestore: {
        rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });
  ```

**E2E Tests:**
- Not used — project has no end-to-end test suite
- Manual testing for UI/browser interactions

## Common Patterns

**Async Testing:**
- Not needed in current tests (logic functions are synchronous)
- If required, would use async/await with test function: `test("name", async () => { ... })`

**Error Testing:**
```javascript
// Test that function doesn't throw with edge cases
test("T5: jugadores sin campo level no lanzan error y producen output válido", () => {
  const players = [
    { id: "A", name: "PA" },
    { id: "B", name: "PB" },
    { id: "C", name: "PC" },
    { id: "D", name: "PD" },
  ];
  expect(() => buildFirstRoundAmericano(players, 1, "individual")).not.toThrow();
  const { courts } = buildFirstRoundAmericano(players, 1, "individual");
  expect(courts).toHaveLength(1);
});

// Test specific output on invalid input
test("T-PROMO-1: el ganador tiene mayor courtLevel que el perdedor", () => {
  const pairs = [pair("A", 0, 3), pair("B", 0, 2)];
  const round = [court(1, pairs[0], pairs[1], 6, 4)];
  const updated = applyPozoRoundResults(pairs, round, 1);

  const winner = updated.find((p) => p.id === "A");
  const loser = updated.find((p) => p.id === "B");
  expect(winner.courtLevel).toBeGreaterThan(loser.courtLevel);
});
```

## Edge Cases and Coverage

**Tested extensively in americano.test.js:**
- Different numbers of players (2, 3, 4, 5, 6, 8 players)
- Different numbers of courts (1, 2, 5 courts)
- Players with missing `level` field
- Sitting out logic (who sits, who gets priority based on history)
- Partner pairing history (avoiding repetition, balancing levels)
- Advanced player separation (level ≥ 3) and team balance
- Mode variants: `individual` vs `pairs`

**Tested extensively in pozo.test.js:**
- Court assignment by level ranking
- Points and goal accumulation
- Promotion/demotion between courts (invariants verified)
- Waiting players (odd total pairs)
- Manual round proposals and validation
- Player distribution across multiple courts

**Tested in stats.test.js:**
- Empty match arrays
- Single match results
- Multiple matches (accumulation)
- Win rate calculations
- Both players on winning team get same stats

## Test Data Patterns

**String IDs vs Numeric IDs:**
- Numeric IDs preferred for deterministic `pk()` function — `pk(1, 2)` vs `pk("A", "B")`
- String IDs supported but less common — `pk("alice", "bob")` works

**Test structure for algorithm validation:**
- Comments show expected outcomes and reasoning
- Example from T27:
  ```javascript
  // Players: A(lv4,pts3) B(lv3,pts2) C(lv2,pts1) D(lv1,pts0)
  // Options:
  //   [A+B] vs [C+D]: clash(lv4,lv3)=15 + balance=|7-3|*2=8 = 23
  //   [A+C] vs [B+D]: clash=0 + balance=|6-4|*2=4 = 4
  //   [A+D] vs [B+C]: clash=0 + balance=|5-5|*2=0 = 0  ← gana
  ```

## Running Tests Locally

```bash
# Install dependencies
npm install

# Run all unit tests
npm run test

# Run with watch mode (requires vitest CLI option — not in current scripts)
# npx vitest --watch

# Run Firestore rules tests (requires Firebase emulator running)
npm run test:rules
# Note: Firestore emulator must be running on localhost:8080
```

## Known Test Gaps

**Not tested:**
- React component behavior (no component tests)
- Firebase listener sync logic (`useTournament.js`)
- Error handling in async operations
- UI interactions (input, navigation, modals)

**Reason:**
- Tests focus on pure logic functions (highest ROI)
- Component testing would require mocking React Router, Firebase, and React Testing Library
- Manual testing currently covers UI validation

---

*Testing analysis: 2026-06-03*
