# Americano Balanced Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar `bestSplit` en el Americano para que separe a jugadores avanzados en equipos distintos y equilibre la suma de niveles por equipo, aceptando juntar avanzados solo cuando ya se agotaron las combinaciones "limpias".

**Architecture:** Dos helpers nuevos (`highLevelClash`, `matchBalance`) reemplazan a `levelPenalty` en `bestSplit`. La función de scoring pasa de "minimizar diferencia dentro de la pareja" a "minimizar clash inter-equipo + desequilibrio de equipos". `buildFirstRoundAmericano` pasa a usar `bestSplit(g, {})` en lugar de la fórmula fija 1°+4° vs 2°+3°, aunque el resultado suele ser idéntico. El historial acumulado (`ph × 12`) naturalmente "desbloquea" la opción de clash una vez agotadas las alternativas limpias.

**Tech Stack:** JavaScript ES2022, Vitest.

---

## Files Changed

| File | Change |
|---|---|
| `src/logic/americano.js` | Reemplazar `levelPenalty` + actualizar `bestSplit` + `buildFirstRoundAmericano` |
| `src/logic/americano.test.js` | Actualizar T27 + agregar 3 nuevos tests de comportamiento |

---

## Weights razonados

| Componente | Peso | Razonamiento |
|---|---|---|
| `ph` (historial de pareja) | ×12 | Después de 1 uso: 12. Supera al clash (15) recién en la 2da repetición, dando margen para que el clash domine en el primer "agotamiento" |
| `highLevelClash` por equipo | ×15 | Penaliza 2 avanzados en el mismo equipo. Con ph=0, cualquier opción limpia (score ≤ `balance×2`) gana sobre el clash (15+) |
| `matchBalance` | ×2 | Desempata opciones igual de "limpias" eligiendo la más equilibrada |

**Traza con [A(lv3,pts3), B(lv3,pts2), M(lv2,pts1), N(lv1,pts0)], ph={}:**
- [A+B] vs [M+N]: clash=15 + balance=|6-3|×2=6 → **21**
- [A+M] vs [B+N]: clash=0 + balance=|5-4|×2=2 → **2** ← gana ✅

**Misma traza después de usar A+M, B+N, A+N, B+M (ph=1 cada uno):**
- [A+B] vs [M+N]: 0+0+clash=15+balance=6 → **21**
- [A+M] vs [B+N]: 12+12+0+2 → **26**
- [A+N] vs [B+M]: 12+12+0+2 → **26**
- Gana [A+B] (21 < 26) ← clash aceptado cuando todas las alternativas están usadas ✅

---

## Task 1: Tests primero (TDD) — actualizar T27 + agregar tests de comportamiento nuevo

**Files:**
- Modify: `src/logic/americano.test.js`

**Context:** T27 prueba la lógica VIEJA de `bestSplit` (minimiza diferencia dentro de la pareja → espera A+B vs C+D). Con la nueva lógica, `bestSplit` equilibra equipos (→ A+D vs B+C). El test debe reflejar el nuevo contrato. Además se agregan 3 tests que describen el comportamiento deseado.

- [ ] **Step 1: Actualizar T27 — esperar equilibrio de equipos en lugar de similitud de pareja**

Localizar T27 en el `describe("buildRoundAmericano — historial de parejas (ph)")` (línea ~270). Reemplazar el cuerpo del test por:

```js
// T27: sin historial, bestSplit equilibra la suma de niveles de los equipos
test("T27: sin historial de parejas, empareja equilibrando la suma de niveles de los equipos", () => {
  // Players: A(lv4,pts3) B(lv3,pts2) C(lv2,pts1) D(lv1,pts0)
  // Sort by pts desc: [A,B,C,D]
  // Opciones:
  //   [A+B] vs [C+D]: clash(lv4,lv3)=15 + balance=|7-3|*2=8 = 23
  //   [A+C] vs [B+D]: clash=0 + balance=|6-4|*2=4 = 4
  //   [A+D] vs [B+C]: clash=0 + balance=|5-5|*2=0 = 0  ← gana
  const players = [
    p("A", 4, 3), p("B", 3, 2), p("C", 2, 1), p("D", 1, 0),
  ];
  const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

  const pairIds = [courts[0].pairA, courts[0].pairB].map(
    (pair) => pair.map((x) => x.id).sort().join("+")
  );
  // La opción más equilibrada es A+D vs B+C (suma 5 vs 5)
  expect(pairIds).toContain("A+D");
  expect(pairIds).toContain("B+C");
});
```

- [ ] **Step 2: Verificar que T27 falla con la lógica actual**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npx vitest run src/logic/americano.test.js --reporter=verbose 2>&1 | grep -A3 "T27"
```

Expected: `FAIL` en T27 (actualmente da A+B y C+D, no A+D y B+C).

- [ ] **Step 3: Agregar describe con 3 nuevos tests de comportamiento**

Después del último `describe` en el archivo, agregar:

```js
// ═══════════════════════════════════════════════════════════════
// bestSplit — separación de avanzados y equilibrio de equipos
// ═══════════════════════════════════════════════════════════════
describe("bestSplit — separación de avanzados (level >= 3)", () => {
  // T28: 2 avanzados → equipos distintos
  test("T28: con 2 avanzados y 2 no-avanzados, los avanzados quedan en equipos distintos", () => {
    // Todos pts distintos para que el sort sea [A1,A2,M,N]
    const players = [p(1, 3, 3), p(2, 3, 2), p(3, 2, 1), p(4, 1, 0)];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const pairA = courts[0].pairA.map((x) => x.id);
    const pairB = courts[0].pairB.map((x) => x.id);
    // Jugadores 1 y 2 son avanzados (lv 3) — deben estar en equipos distintos
    expect(
      (pairA.includes(1) && pairB.includes(2)) ||
      (pairA.includes(2) && pairB.includes(1))
    ).toBe(true);
  });

  // T29: posibilidades limpias agotadas → acepta avanzados juntos
  test("T29: cuando todas las combinaciones sin clash ya fueron usadas, acepta avanzados en el mismo equipo", () => {
    const players = [p(1, 3, 3), p(2, 3, 2), p(3, 2, 1), p(4, 1, 0)];
    // ph cubre todas las opciones limpias: 1+3, 2+4, 1+4, 2+3 (usado 1 vez cada una)
    // [1+3] vs [2+4]: 12+12+0+2=26  [1+4] vs [2+3]: 12+12+0+2=26
    // [1+2] vs [3+4]: 0+0+15+6=21  ← gana el clash
    const ph = { "1_3": 1, "2_4": 1, "1_4": 1, "2_3": 1 };
    const { courts } = buildRoundAmericano(players, 1, ph, {}, "individual");

    const pairA = courts[0].pairA.map((x) => x.id);
    const pairB = courts[0].pairB.map((x) => x.id);
    // Ahora 1 y 2 deben estar en el mismo equipo (clash aceptado)
    const hasClash =
      (pairA.includes(1) && pairA.includes(2)) ||
      (pairB.includes(1) && pairB.includes(2));
    expect(hasClash).toBe(true);
  });

  // T30: equilibrio de equipos — suma de niveles lo más pareja posible
  test("T30: sin historial, elige la distribución que equilibra la suma de niveles de los equipos", () => {
    // [1(lv3), 2(lv2), 3(lv2), 4(lv1)] — pts distintos para sort [1,2,3,4]
    // [1+4] vs [2+3]: sumas = 4 vs 4 = balance 0  ← gana
    // [1+3] vs [2+4]: sumas = 5 vs 3 = balance 2
    // [1+2] vs [3+4]: sumas = 5 vs 3 = balance 2
    const players = [p(1, 3, 3), p(2, 2, 2), p(3, 2, 1), p(4, 1, 0)];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const sumTeam = (pair) => pair.reduce((s, pl) => s + (pl.level || 0), 0);
    const diff = Math.abs(
      sumTeam(courts[0].pairA) - sumTeam(courts[0].pairB)
    );
    expect(diff).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 4: Verificar que los 3 tests nuevos fallan**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npx vitest run src/logic/americano.test.js --reporter=verbose 2>&1 | grep -E "T28|T29|T30|FAIL|PASS"
```

Expected: T28, T29, T30 en FAIL (la lógica aún no cambió). T27 también en FAIL.

- [ ] **Step 5: Commit de los tests rojos**

```bash
git add src/logic/americano.test.js
git commit -m "test: agregar tests de separación de avanzados y equilibrio de equipos (T27-T30)"
```

---

## Task 2: Implementación — actualizar `bestSplit` y `buildFirstRoundAmericano`

**Files:**
- Modify: `src/logic/americano.js`

**Context:** Reemplazar `levelPenalty` con dos helpers más precisos, actualizar la función de score en `bestSplit`, y usar `bestSplit(g, {})` en la ronda 1 para consistencia.

- [ ] **Step 1: Reemplazar `levelPenalty` con los dos nuevos helpers**

Localizar `function levelPenalty(pair)` (línea ~36) y reemplazarla con:

```js
function highLevelClash(pair) {
  return pair.every((p) => (p.level || 0) >= 3) ? 1 : 0;
}

function matchBalance(pA, pB) {
  const sumA = pA.reduce((s, p) => s + (p.level || 0), 0);
  const sumB = pB.reduce((s, p) => s + (p.level || 0), 0);
  return Math.abs(sumA - sumB);
}
```

- [ ] **Step 2: Actualizar el scoring en `bestSplit`**

Localizar el bloque `opts.forEach((s) => {` dentro de `bestSplit`. Reemplazar el cuerpo del forEach:

```js
// ANTES:
opts.forEach((s) => {
  const sc = s.reduce(
    (acc, pair) =>
      acc +
      (ph[pk(pair[0].id, pair[1].id)] || 0) * 10 +
      levelPenalty(pair) * 3,
    0,
  );
  if (sc < bs) {
    bs = sc;
    best = s;
  }
});

// DESPUÉS:
opts.forEach(([pA, pB]) => {
  const sc =
    (ph[pk(pA[0].id, pA[1].id)] || 0) * 12 +
    (ph[pk(pB[0].id, pB[1].id)] || 0) * 12 +
    highLevelClash(pA) * 15 +
    highLevelClash(pB) * 15 +
    matchBalance(pA, pB) * 2;
  if (sc < bs) {
    bs = sc;
    best = [pA, pB];
  }
});
```

- [ ] **Step 3: Actualizar `buildFirstRoundAmericano` para usar `bestSplit`**

En `buildFirstRoundAmericano`, localizar el bloque del modo individual (después del `if (isPairs)` y su return). Reemplazar la línea que construye la cancha:

```js
// ANTES:
cs.push({ pairA: [g[0], g[3]], pairB: [g[1], g[2]], scoreA: "", scoreB: "", saved: false });

// DESPUÉS:
const [pA, pB] = bestSplit(g, {});
cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
```

- [ ] **Step 4: Verificar que los 4 tests pasan ahora y que ningún test existente se rompe**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npx vitest run src/logic/americano.test.js --reporter=verbose
```

Expected: **30 passed (30)** — todos los tests pasan, incluyendo T27, T28, T29, T30. Si algún test falla, investigar y corregir antes de continuar.

- [ ] **Step 5: Correr la suite completa**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npx vitest run
```

Expected: **70 passed (70)** — la suite completa pasa sin regresiones.

- [ ] **Step 6: Build limpio**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build 2>&1 | tail -5
```

Expected: `✓ built in ~1.7s`

- [ ] **Step 7: Commit de la implementación**

```bash
git add src/logic/americano.js
git commit -m "feat: rebalancear emparejamiento Americano — separar avanzados y equilibrar equipos"
```

---

## Self-Review

**Spec coverage:**
- ✅ No más de 2 avanzados (lv≥3) por equipo cuando hay alternativa → T28 + `highLevelClash×15`
- ✅ Avanzados en equipos distintos cuando posible → T28
- ✅ Cuando alternativas agotadas, acepta avanzados juntos → T29 + pesos ph×12 vs clash×15
- ✅ Equipos equilibrados por suma de niveles → T30 + `matchBalance×2`
- ✅ Ronda 1 usa misma lógica → `bestSplit(g, {})` en `buildFirstRoundAmericano`
- ✅ Tests existentes sin regresiones → verificado en traza manual (T1,T3,T16,T17,T24,T25 sin cambio)

**Placeholder scan:** Sin TBDs ni placeholders.

**Type consistency:** `highLevelClash(pair)` recibe array de 2 jugadores — mismo shape que `pair` en `bestSplit`. `matchBalance(pA, pB)` recibe los mismos arrays. Consistente con el uso en Task 2 Step 2.
