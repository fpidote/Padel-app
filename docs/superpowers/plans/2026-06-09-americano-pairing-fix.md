# Fix: Desincronización rondas precalculadas — Americano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la desincronización entre la ronda 1 (generada por `buildFirstRoundAmericano`) y el resto de las rondas precalculadas, de forma que todas las rondas compartan el mismo historial de parejas y el algoritmo de penalidades funcione correctamente.

**Architecture:** Un solo cambio en `SetupAmericano.jsx` → `onStart()`: usar `precomputedRounds[0]` como `currentRound` inicial en lugar de llamar a `buildFirstRoundAmericano` por separado. El test de simulación va en un archivo nuevo sin mock de `shuffle` para probar el algoritmo real.

**Tech Stack:** React 18, Vitest, JavaScript puro

---

## Archivos

| Acción  | Archivo |
|---------|---------|
| Modificar | `src/components/setup/SetupAmericano.jsx` — función `onStart()` |
| Crear | `src/logic/americano.simulation.test.js` — test de simulación sin mock de shuffle |

---

### Task 1: Test de simulación — verificar que el algoritmo produce 0 repeticiones de pareja

**Files:**
- Create: `src/logic/americano.simulation.test.js`

- [ ] **Step 1.1: Crear el archivo de test de simulación**

```js
// src/logic/americano.simulation.test.js
// Test sin mock de shuffle — ejercita el algoritmo real con datos de producción
import { describe, test, expect } from "vitest";
import { precomputeAllRounds } from "./americano.js";
import { pk } from "./utils.js";

describe("Simulación — 20 jugadores, 5 rondas, 5 canchas", () => {
  test("T-SIM-01: cero repeticiones de pareja en toda la secuencia", () => {
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `J${i}`,
      level: (i % 3) + 1, // mix de niveles 1, 2, 3
      pts: 0,
      gf: 0,
      gc: 0,
    }));

    const { rounds } = precomputeAllRounds(players, {
      courts: 5,
      mode: "individual",
      maxRounds: 5,
    });

    expect(rounds).toHaveLength(5);

    const partnerCounts = {};
    rounds.forEach((round) => {
      round.courts.forEach((court) => {
        const kA = pk(court.pairA[0].id, court.pairA[1].id);
        const kB = pk(court.pairB[0].id, court.pairB[1].id);
        partnerCounts[kA] = (partnerCounts[kA] || 0) + 1;
        partnerCounts[kB] = (partnerCounts[kB] || 0) + 1;
      });
    });

    const repeatedPairs = Object.entries(partnerCounts).filter(([, v]) => v > 1);
    expect(repeatedPairs).toHaveLength(0);
  });

  test("T-SIM-02: cada jugador juega exactamente 5 rondas (sin descanso con 20 jugadores y 5 canchas)", () => {
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `J${i}`,
      level: (i % 3) + 1,
      pts: 0,
      gf: 0,
      gc: 0,
    }));

    const { rounds } = precomputeAllRounds(players, {
      courts: 5,
      mode: "individual",
      maxRounds: 5,
    });

    const roundsPlayed = {};
    rounds.forEach((round) => {
      round.courts.forEach((court) => {
        [...court.pairA, ...court.pairB].forEach((p) => {
          roundsPlayed[p.id] = (roundsPlayed[p.id] || 0) + 1;
        });
      });
    });

    // Con 20 jugadores y 5 canchas: 20/4 = 5 canchas exactas, nadie descansa
    players.forEach((p) => {
      expect(roundsPlayed[p.id]).toBe(5);
    });
  });
});
```

- [ ] **Step 1.2: Ejecutar el test — debe pasar (valida que el algoritmo es correcto)**

```bash
npx vitest run src/logic/americano.simulation.test.js --reporter=verbose
```

Salida esperada: **2 tests PASS**. Si alguno falla, hay un bug en el algoritmo mismo (no en el fix que vamos a hacer) — investigar antes de continuar.

- [ ] **Step 1.3: Commit del test de simulación**

```bash
git add src/logic/americano.simulation.test.js
git commit -m "test: simulación 20 jugadores 5 rondas — verificar cero repeticiones de pareja"
```

---

### Task 2: Fix en `SetupAmericano.jsx` — usar `precomputedRounds[0]` como ronda 1

**Files:**
- Modify: `src/components/setup/SetupAmericano.jsx` líneas 186–224 (función `onStart`)

- [ ] **Step 2.1: Reemplazar `onStart` en `SetupAmericano.jsx`**

Buscar el bloque actual:

```js
    const { courts, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode);
    let precomputedRounds = null;
    let roundWarnings = [];
    if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
      if (localPrecomputedRounds !== null) {
        precomputedRounds = localPrecomputedRounds;
        roundWarnings = localRoundWarnings;
      } else {
        const result = precomputeAllRounds(entities, t.config);
        precomputedRounds = result.rounds;
        roundWarnings = result.warnings;
      }
    }
    await persist({
      ...t,
      [isPairs ? "pairs" : "players"]: entities,
      currentRound: courts,
      sittingOut,
```

Reemplazar con:

```js
    let currentRound, sittingOut;
    let precomputedRounds = null;
    let roundWarnings = [];
    if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
      if (localPrecomputedRounds !== null) {
        precomputedRounds = localPrecomputedRounds;
        roundWarnings = localRoundWarnings;
      } else {
        const result = precomputeAllRounds(entities, t.config);
        precomputedRounds = result.rounds;
        roundWarnings = result.warnings;
      }
      const firstRound = precomputedRounds[0];
      currentRound = firstRound.courts.map((c) => ({ ...c, scoreA: "", scoreB: "", saved: false }));
      sittingOut = firstRound.sittingOut;
    } else {
      ({ courts: currentRound, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode));
    }
    await persist({
      ...t,
      [isPairs ? "pairs" : "players"]: entities,
      currentRound,
      sittingOut,
```

- [ ] **Step 2.2: Verificar que el build compila sin errores**

```bash
npm run build
```

Salida esperada: build exitoso sin errores ni warnings de `currentRound`/`sittingOut` usadas sin inicializar.

- [ ] **Step 2.3: Ejecutar todos los tests para detectar regresiones**

```bash
npm run test
```

Salida esperada: todos los tests pasan (incluyendo los de `americano.test.js` y los nuevos de `americano.simulation.test.js`).

- [ ] **Step 2.4: Commit del fix**

```bash
git add src/components/setup/SetupAmericano.jsx
git commit -m "fix: usar precomputedRounds[0] como ronda 1 para historial consistente en americano"
```

---

## Verificación final

Después de los dos commits, correr ambos test suites juntos:

```bash
npx vitest run src/logic/americano.test.js src/logic/americano.simulation.test.js --reporter=verbose
```

Todos los tests deben pasar. El fix es completo.
