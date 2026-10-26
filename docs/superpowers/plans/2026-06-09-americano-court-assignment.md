# Americano Court Assignment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la repetición excesiva de canchas en el torneo Americano reemplazando la asignación aleatoria de grupos a pistas con una asignación óptima basada en historial.

**Architecture:** Se añade `optimalCourtsAssignment(groups, courtHistory)` en `americano.js` que prueba todas las permutaciones de grupo→pista (≤5! = 120) y elige la de menor costo según `courtHistory`. Reemplaza `shuffle(bestGroups)` en `precomputeAllRounds`. Se exporta para poder testarla directamente.

**Tech Stack:** JavaScript ES2022, Vitest

---

## Files

- Modify: `src/logic/americano.js`
  - Añadir y exportar `optimalCourtsAssignment`
  - Reemplazar `shuffle(bestGroups)` por `optimalCourtsAssignment(bestGroups, courtHistory)`
- Modify: `src/logic/americano.test.js`
  - Añadir tests para `optimalCourtsAssignment`
  - Añadir test de distribución estadística

---

### Task 1: Test para `optimalCourtsAssignment`

**Files:**
- Modify: `src/logic/americano.test.js`

- [ ] **Step 1: Añadir import de `optimalCourtsAssignment`**

Al principio del archivo, añadir `optimalCourtsAssignment` al import existente:

```js
import {
  buildFirstRoundAmericano,
  buildRoundAmericano,
  precomputeAllRounds,
  optimalCourtsAssignment,
  PENALTY,
  RELAX_THRESHOLDS,
} from "./americano.js";
```

- [ ] **Step 2: Añadir bloque de tests al final del archivo**

```js
// ═══════════════════════════════════════════════════════════════
// optimalCourtsAssignment
// ═══════════════════════════════════════════════════════════════
describe("optimalCourtsAssignment", () => {
  // T-OC1: con historial vacío devuelve los grupos en algún orden válido
  test("T-OC1: con historial vacío devuelve exactamente los mismos grupos", () => {
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const g1 = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];
    const result = optimalCourtsAssignment([g0, g1], {});
    expect(result).toHaveLength(2);
    expect(result).toContain(g0);
    expect(result).toContain(g1);
  });

  // T-OC2: mueve el grupo con historial alto al a la pista menos visitada
  test("T-OC2: asigna el grupo con historial en pista 0 a otra pista", () => {
    // J0, J1 han jugado 3 veces en pista 0 → deben ir a pista 1
    // J4, J5 no tienen historial → van a pista 0
    const courtHistory = { "0_c0": 3, "1_c0": 3 };
    const heavy = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const fresh  = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];

    // shuffle está mockeado como identidad → base = [heavy, fresh] sin cambios
    const result = optimalCourtsAssignment([heavy, fresh], courtHistory);

    // pista 0 (result[0]) debe ser el grupo sin historial en c0
    expect(result[0]).toEqual(fresh);
    // pista 1 (result[1]) debe ser el grupo con historial en c0
    expect(result[1]).toEqual(heavy);
  });

  // T-OC3: 3 grupos, elige la permutación de menor costo total
  test("T-OC3: con 3 pistas elige la asignación de menor costo global", () => {
    // J0 jugó 5 veces en pista 0 → su grupo no debe ir a pista 0
    // J4 jugó 5 veces en pista 1 → su grupo no debe ir a pista 1
    // J8 jugó 5 veces en pista 2 → su grupo no debe ir a pista 2
    const courtHistory = { "0_c0": 5, "4_c1": 5, "8_c2": 5 };
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]; // alto costo en pista 0
    const g1 = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }]; // alto costo en pista 1
    const g2 = [{ id: 8 }, { id: 9 }, { id: 10 }, { id: 11 }]; // alto costo en pista 2

    const result = optimalCourtsAssignment([g0, g1, g2], courtHistory);

    // Ningún grupo debe estar en su pista costosa
    expect(result[0]).not.toEqual(g0); // pista 0 no debe tener g0
    expect(result[1]).not.toEqual(g1); // pista 1 no debe tener g1
    expect(result[2]).not.toEqual(g2); // pista 2 no debe tener g2
  });

  // T-OC4: 1 grupo — devuelve el array tal cual
  test("T-OC4: con un solo grupo lo devuelve sin cambios", () => {
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const result = optimalCourtsAssignment([g0], { "0_c0": 99 });
    expect(result[0]).toEqual(g0);
  });
});

// ═══════════════════════════════════════════════════════════════
// precomputeAllRounds — distribución de canchas
// ═══════════════════════════════════════════════════════════════
describe("precomputeAllRounds — distribución de canchas", () => {
  // T-CD1: ningún jugador repite pista más de 2 veces en 20j/4c/5r
  test("T-CD1: con 20 jugadores, 4 canchas, 5 rondas — max repetición ≤ 2", () => {
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: i, name: `J${i+1}`, level: [1,1,2,2,3][i%5], pts:0, gf:0, gc:0,
    }));
    const { rounds } = precomputeAllRounds(players, { courts: 4, maxRounds: 5 });

    const courtCount = {};
    players.forEach(p => { courtCount[p.id] = {}; });
    rounds.forEach((round) => {
      round.courts.forEach((court, ci) => {
        [...court.pairA, ...court.pairB].forEach(p => {
          courtCount[p.id][ci] = (courtCount[p.id][ci] || 0) + 1;
        });
      });
    });

    let maxRepeat = 0;
    players.forEach(p => {
      Object.values(courtCount[p.id]).forEach(count => {
        if (count > maxRepeat) maxRepeat = count;
      });
    });

    expect(maxRepeat).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Verificar que los tests fallan por el motivo correcto**

```bash
npx vitest run src/logic/americano.test.js --reporter=verbose 2>&1 | grep -A 3 "T-OC\|T-CD"
```

Esperado: `T-OC1..4` fallan con `optimalCourtsAssignment is not a function`, `T-CD1` puede fallar por `maxRepeat > 2`.

---

### Task 2: Implementar `optimalCourtsAssignment` y conectarla

**Files:**
- Modify: `src/logic/americano.js`

- [ ] **Step 1: Añadir la función antes de `precomputeAllRounds`**

Insertar justo antes de la línea `export function precomputeAllRounds(`:

```js
// ── optimalCourtsAssignment ───────────────────────────────────
// Assigns groups to physical courts to minimise total court-repetition cost.
// Tries all n! permutations (n ≤ 5 courts → max 120 iterations).
// Uses shuffle for random tie-breaking when history is empty (round 1).
export function optimalCourtsAssignment(groups, courtHistory) {
  const n = groups.length;
  if (n <= 1) return [...groups];

  const base = shuffle([...groups]);

  function permCost(perm) {
    return perm.reduce((total, groupIdx, courtIdx) =>
      total + base[groupIdx].reduce((s, p) =>
        s + (courtHistory[`${p.id}_c${courtIdx}`] || 0), 0), 0);
  }

  function allPerms(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) =>
      allPerms(arr.filter((_, j) => j !== i)).map(perm => [v, ...perm]));
  }

  const indices = Array.from({ length: n }, (_, i) => i);
  let bestPerm = indices;
  let bestCost = permCost(indices);

  for (const perm of allPerms(indices)) {
    const c = permCost(perm);
    if (c < bestCost) { bestCost = c; bestPerm = perm; }
  }

  return bestPerm.map(i => base[i]);
}
```

- [ ] **Step 2: Reemplazar `shuffle(bestGroups)` en `precomputeAllRounds`**

Buscar la línea (≈215):
```js
    const shuffledGroups = shuffle(bestGroups);
```
Reemplazar por:
```js
    const shuffledGroups = optimalCourtsAssignment(bestGroups, courtHistory);
```

- [ ] **Step 3: Actualizar el loop que usa `shuffledGroups`**

El nombre `shuffledGroups` ya no describe bien su contenido. Cambiar las dos ocurrencias en el loop:
```js
    for (let c = 0; c < activeCourts; c++) {
      const group = shuffledGroups[c];
```
a:
```js
    for (let c = 0; c < activeCourts; c++) {
      const group = shuffledGroups[c]; // assigned by optimalCourtsAssignment
```

No es necesario renombrar la variable — el comportamiento es lo que importa.

- [ ] **Step 4: Ejecutar todos los tests**

```bash
npx vitest run src/logic/americano.test.js --reporter=verbose 2>&1
```

Esperado: todos los tests pasan, incluyendo `T-OC1..4` y `T-CD1`.

- [ ] **Step 5: Build de producción limpio**

```bash
npm run build 2>&1 | tail -10
```

Esperado: sin errores, `dist/` generado.

- [ ] **Step 6: Commit**

```bash
git add src/logic/americano.js src/logic/americano.test.js
git commit -m "fix: asignación óptima de grupos a canchas en americano"
```

---

## Self-Review

**Spec coverage:**
- ✓ Bug 1 (COURT_REPEAT inútil en scoredSplit): no se toca — es un code smell pero no causa regresiones, y su eliminación queda fuera del scope.
- ✓ Bug 2 (asignación aleatoria): corregido con `optimalCourtsAssignment`.
- ✓ Test de distribución verifica la mejora observable (T-CD1).

**Placeholders:** ninguno.

**Consistencia de tipos:** `optimalCourtsAssignment` recibe `groups: Array<Array<{id: number}>>` y `courtHistory: { [string]: number }` — consistente con cómo `precomputeAllRounds` lo llama y cómo los tests lo ejercitan.
