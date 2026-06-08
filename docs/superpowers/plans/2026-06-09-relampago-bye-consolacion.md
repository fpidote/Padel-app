# Relámpago — Fix Byes y Cuadro de Consolación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar BYEs del cuadro de consolación y mostrar tarjeta "Exento" para parejas sin rival en primera ronda.

**Architecture:** Refactorizar `buildBracket` para clasificar partidos reales vs bye, construir consolación con tamaño correcto, añadir flags `pairAByeInR1`/`pairBByeInR1` en W_R2, y actualizar `advanceBracket` + `rippleByes` para enrutar losers correctamente. En el frontend, `BracketMatchCard` detecta el caso bye y renderiza una tarjeta compacta "Exento".

**Tech Stack:** JavaScript ES2022, Vitest (tests), React 18 (componente)

---

## Archivos

| Archivo | Acción |
|---|---|
| `src/logic/relampago.js` | Modificar — `buildBracket`, `advanceBracket`, `rippleByes` |
| `src/logic/relampago.test.js` | Crear — tests T-REL-01 a T-REL-07 |
| `src/components/play/PlayRelampago.jsx` | Modificar — `BracketMatchCard` tarjeta Exento |

---

## Task 1: Tests de baseline (deben pasar HOY — sin byes)

Verificar que el comportamiento actual con 4 y 8 parejas no se rompe con los cambios futuros.

**Files:**
- Create: `src/logic/relampago.test.js`

- [ ] **Step 1: Crear el archivo de test con casos sin byes**

```js
// src/logic/relampago.test.js
import { describe, it, expect } from "vitest";
import { buildBracket, advanceBracket } from "./relampago.js";

function makePairs(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    p1: `P${i}A`,
    p2: `P${i}B`,
  }));
}

describe("buildBracket — sin byes (potencia de 2)", () => {
  it("T-REL-06: 4 parejas — consolación R1 tiene 2 partidos reales, 0 BYEs", () => {
    const bracket = buildBracket(makePairs(4));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    expect(consR1).toHaveLength(1);
    const allPairs = consR1.flatMap((m) => [m.pairA, m.pairB]);
    expect(allPairs.every((p) => p === null || p.id !== "bye")).toBe(true);
  });

  it("T-REL-07: 8 parejas — W_R1 tiene 4 partidos reales, consolación R1 tiene 2 partidos", () => {
    const bracket = buildBracket(makePairs(8));
    const wR1 = bracket.filter((m) => m.bracket === "winners" && m.round === 1);
    expect(wR1).toHaveLength(4);
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    expect(consR1).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Ejecutar — deben pasar (baseline)**

```bash
npx vitest run src/logic/relampago.test.js --reporter=verbose
```

Esperado: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/logic/relampago.test.js
git commit -m "test: baseline T-REL-06/07 relampago sin byes"
```

---

## Task 2: Tests que deben FALLAR con el código actual (consolación con byes)

Escribir los tests que capturan los bugs actuales. Deben fallar ahora, pasar después del fix.

**Files:**
- Modify: `src/logic/relampago.test.js`

- [ ] **Step 1: Añadir tests T-REL-01 a T-REL-05 al archivo**

Añadir al final del archivo (antes del último `}`):

```js
describe("buildBracket — con byes (no potencia de 2)", () => {
  it("T-REL-01: 6 parejas — consolación R1 tiene 2 equipos reales, 0 BYEs en slots", () => {
    const bracket = buildBracket(makePairs(6));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    // Con el fix: solo 1 match en consR1 con 2 slots null (se llenan al avanzar)
    // Bug actual: 2 matches, uno con BYE vs BYE
    const byeSlots = consR1.flatMap((m) => [m.pairA, m.pairB]).filter((p) => p?.id === "bye");
    expect(byeSlots).toHaveLength(0);
  });

  it("T-REL-02: 6 parejas — consolación R2 tiene 1 match reservado para bye-loser de W_R2", () => {
    const bracket = buildBracket(makePairs(6));
    const consR2 = bracket.filter((m) => m.bracket === "consolation" && m.round === 2);
    expect(consR2).toHaveLength(1);
  });

  it("T-REL-03: 7 parejas — consolación R1 tiene slots para 3 equipos reales, no BYEs", () => {
    const bracket = buildBracket(makePairs(7));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    // 3 losers reales → ceil(3/2) = 2 matches en consolación R1
    expect(consR1).toHaveLength(2);
    const byeSlots = consR1.flatMap((m) => [m.pairA, m.pairB]).filter((p) => p?.id === "bye");
    expect(byeSlots).toHaveLength(0);
  });
});

describe("advanceBracket — bye-loser de W_R2 va a consolación", () => {
  function buildAndAdvanceW2ByeMatch(n) {
    const pairs = makePairs(n);
    let bracket = buildBracket(pairs);
    // Guardar todos los W_R1 que tengan pairA y pairB definidos (auto-resueltos por rippleByes)
    // Encontrar el partido W_R2 donde ambos son bye-avanzados
    const w2ByeMatch = bracket.find(
      (m) => m.bracket === "winners" && m.round === 2 && m.pairAByeInR1 && m.pairBByeInR1
    );
    return { bracket, w2ByeMatch };
  }

  it("T-REL-04: 6 parejas — loser de W_R2 bye-match llega a consolación R2", () => {
    const { bracket, w2ByeMatch } = buildAndAdvanceW2ByeMatch(6);
    expect(w2ByeMatch).toBeTruthy();
    // Guardar el partido: pairA gana (scoreA=6, scoreB=3)
    const updated = advanceBracket(bracket, w2ByeMatch.id, 6, 3);
    const loser = w2ByeMatch.pairB; // pairB pierde
    const consR2 = updated.filter((m) => m.bracket === "consolation" && m.round === 2);
    const loserInConsol = consR2.some(
      (m) => m.pairA?.id === loser.id || m.pairB?.id === loser.id
    );
    expect(loserInConsol).toBe(true);
  });

  it("T-REL-05: 6 parejas — winner de W_R2 bye-match NO va a consolación", () => {
    const { bracket, w2ByeMatch } = buildAndAdvanceW2ByeMatch(6);
    expect(w2ByeMatch).toBeTruthy();
    const updated = advanceBracket(bracket, w2ByeMatch.id, 6, 3);
    const winner = w2ByeMatch.pairA; // pairA gana
    const consolMatches = updated.filter((m) => m.bracket === "consolation");
    const winnerInConsol = consolMatches.some(
      (m) => m.pairA?.id === winner.id || m.pairB?.id === winner.id
    );
    expect(winnerInConsol).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar — T-REL-01 a T-REL-05 deben FALLAR**

```bash
npx vitest run src/logic/relampago.test.js --reporter=verbose
```

Esperado: T-REL-06 y T-REL-07 PASS, T-REL-01 a T-REL-05 FAIL.

- [ ] **Step 3: Commit**

```bash
git add src/logic/relampago.test.js
git commit -m "test: añadir T-REL-01..05 relampago byes — deben fallar antes del fix"
```

---

## Task 3: Fix `buildBracket` — clasificación de partidos y consolación correcta

El cambio más grande. Reemplazar toda la función `buildBracket` en `relampago.js`.

**Files:**
- Modify: `src/logic/relampago.js`

- [ ] **Step 1: Reemplazar `buildBracket` completa**

Reemplazar el bloque desde `export function buildBracket(pairs) {` hasta el primer `}` de cierre (línea 126 del archivo actual), con:

```js
export function buildBracket(pairs) {
  const n = pairs.length;
  let size = 1;
  while (size < n) size *= 2;

  const BYE = { id: "bye", p1: "BYE", p2: "BYE" };
  const distributed = Array(size).fill(null).map((_, i) => (i < n ? pairs[i] : BYE));
  const interleaved = [];
  let lo = 0, hi = size - 1;
  while (lo <= hi) {
    interleaved.push(distributed[lo++]);
    if (lo <= hi) interleaved.push(distributed[hi--]);
  }
  const seeds = interleaved;
  const matches = [];

  // Clasificar partidos W_R1: reales vs bye
  const byeMatchIndices = new Set();
  const realMatchList = []; // índices de partidos reales (en orden)
  for (let i = 0; i < size / 2; i++) {
    if (seeds[i * 2].id === "bye" || seeds[i * 2 + 1].id === "bye") {
      byeMatchIndices.add(i);
    } else {
      realMatchList.push(i);
    }
  }
  const real_r1_count = realMatchList.length;

  // Calcular estructura de consolación
  const consol_r1_match_count = Math.floor(real_r1_count / 2);
  const has_odd_r1 = real_r1_count % 2 === 1;

  // W_R2 que son garantizados bye-loser (ambos lados bye-avanzados)
  const guaranteed_bye_r2 = [];
  // W_R2 con solo un lado bye-avanzado (loser condicional)
  const conditional_bye_r2 = [];
  for (let i = 0; i < Math.floor(size / 4); i++) {
    const feedA = 2 * i;     // índice W_R1 que alimenta slot A de W_R2[i]
    const feedB = 2 * i + 1; // índice W_R1 que alimenta slot B de W_R2[i]
    const aIsBye = byeMatchIndices.has(feedA);
    const bIsBye = byeMatchIndices.has(feedB);
    if (aIsBye && bIsBye) guaranteed_bye_r2.push(i);
    else if (aIsBye || bIsBye) conditional_bye_r2.push({ matchIdx: i, byeSlot: aIsBye ? "A" : "B" });
  }

  // Mapa: índice W_R1 real → { consolMatchId, consolSlot }
  const loserRouting = {};
  realMatchList.forEach((matchIdx, k) => {
    const consolMatchId = `c_r1_m${Math.floor(k / 2)}`;
    const consolSlot = k % 2 === 0 ? "A" : "B";
    loserRouting[matchIdx] = { consolMatchId, consolSlot };
  });

  // Si hay impar de R1 reales y hay condicionales: el último condicional ocupa el slot B del match impar
  let conditionalRoutedToR1 = null;
  if (has_odd_r1 && conditional_bye_r2.length > 0) {
    const cond = conditional_bye_r2[0];
    const lastR1MatchId = `c_r1_m${Math.floor(real_r1_count / 2)}`;
    conditionalRoutedToR1 = { w2MatchIdx: cond.matchIdx, consolMatchId: lastR1MatchId, consolSlot: "B" };
  }

  // Total de matches de consolación R1 = consol_r1_match_count + (1 si hay impar o condicional)
  const total_consol_r1 = consol_r1_match_count + (has_odd_r1 ? 1 : 0);

  // 1. Winners R1
  for (let i = 0; i < size / 2; i++) {
    const routing = loserRouting[i];
    matches.push({
      id: `w_r1_m${i}`,
      bracket: "winners",
      round: 1,
      matchIndex: i,
      pairA: seeds[i * 2],
      pairB: seeds[i * 2 + 1],
      scoreA: "",
      scoreB: "",
      saved: false,
      winner: null,
      loser: null,
      nextMatchId: size > 2 ? `w_r2_m${Math.floor(i / 2)}` : null,
      nextMatchSlot: i % 2 === 0 ? "A" : "B",
      loserMatchId: routing ? routing.consolMatchId : null,
      loserMatchSlot: routing ? routing.consolSlot : null,
    });
  }

  // 2. Winners Subsequent Rounds
  let prevRoundSize = size / 2;
  let roundNum = 2;
  while (prevRoundSize > 1) {
    const newSize = prevRoundSize / 2;
    for (let i = 0; i < newSize; i++) {
      const feedA = 2 * i;
      const feedB = 2 * i + 1;
      const pairAByeInR1 = roundNum === 2 ? byeMatchIndices.has(feedA) : false;
      const pairBByeInR1 = roundNum === 2 ? byeMatchIndices.has(feedB) : false;

      // Determinar si este W_R2 match tiene loserMatchId (para bye-losers)
      let loserMatchId = null;
      let loserMatchSlot = null;
      if (roundNum === 2) {
        const isGuaranteed = guaranteed_bye_r2.includes(i);
        const isConditional = conditionalRoutedToR1 && conditionalRoutedToR1.w2MatchIdx === i;
        if (isGuaranteed) {
          // bye-loser garantizado → consolación R2
          const consR2Idx = guaranteed_bye_r2.indexOf(i);
          loserMatchId = `c_r2_g${consR2Idx}`;
          loserMatchSlot = "B";
        } else if (isConditional) {
          loserMatchId = conditionalRoutedToR1.consolMatchId;
          loserMatchSlot = conditionalRoutedToR1.consolSlot;
        }
      }

      matches.push({
        id: `w_r${roundNum}_m${i}`,
        bracket: "winners",
        round: roundNum,
        matchIndex: i,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: newSize > 1 ? `w_r${roundNum + 1}_m${Math.floor(i / 2)}` : null,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId,
        loserMatchSlot,
        pairAByeInR1,
        pairBByeInR1,
      });
    }
    prevRoundSize = newSize;
    roundNum++;
  }

  // 3. Consolation Bracket
  if (total_consol_r1 > 0) {
    // Consolation R1
    for (let i = 0; i < total_consol_r1; i++) {
      const isLastAndOdd = has_odd_r1 && i === total_consol_r1 - 1;
      const nextConsId = total_consol_r1 > 1 || guaranteed_bye_r2.length > 0
        ? `c_r2_m${Math.floor(i / 2)}`
        : null;
      matches.push({
        id: `c_r1_m${i}`,
        bracket: "consolation",
        round: 1,
        matchIndex: i,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: nextConsId,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId: null,
      });
    }

    // Consolation R2 — matches regulares (winners de R1 se enfrentan entre sí)
    const consol_r2_regular = Math.floor(total_consol_r1 / 2);

    // Consolation R2 — matches extra para guaranteed bye-losers de W_R2
    // Estos matches reciben: slot A del winner de consolación R1, slot B del bye-loser
    for (let gi = 0; gi < guaranteed_bye_r2.length; gi++) {
      // El winner de c_r1_m(gi*2) va al slot A de c_r2_g(gi)
      // El bye-loser de W_R2 va al slot B de c_r2_g(gi)
      const sourceR1MatchId = `c_r1_m${gi * 2}`;
      // Actualizar nextMatchId del source R1 match
      const sourceR1 = matches.find((m) => m.id === sourceR1MatchId);
      if (sourceR1) {
        sourceR1.nextMatchId = `c_r2_g${gi}`;
        sourceR1.nextMatchSlot = "A";
      }
      matches.push({
        id: `c_r2_g${gi}`,
        bracket: "consolation",
        round: 2,
        matchIndex: consol_r2_regular + gi,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: null,
        nextMatchSlot: null,
        loserMatchId: null,
      });
    }

    // Consolation R2 regular (si hay más de 1 match en R1)
    if (consol_r2_regular > 0) {
      for (let i = 0; i < consol_r2_regular; i++) {
        // Solo si no fue sobreescrito por un guaranteed bye (arriba)
        if (!matches.find((m) => m.id === `c_r2_m${i}`)) {
          matches.push({
            id: `c_r2_m${i}`,
            bracket: "consolation",
            round: 2,
            matchIndex: i,
            pairA: null,
            pairB: null,
            scoreA: "",
            scoreB: "",
            saved: false,
            winner: null,
            loser: null,
            nextMatchId: consol_r2_regular > 1 ? `c_r3_m${Math.floor(i / 2)}` : null,
            nextMatchSlot: i % 2 === 0 ? "A" : "B",
            loserMatchId: null,
          });
        }
      }

      // Consolation R3+ (si hay más rondas)
      let cPrev = consol_r2_regular;
      let cRound = 3;
      while (cPrev > 1) {
        const cNew = Math.floor(cPrev / 2);
        for (let i = 0; i < cNew; i++) {
          matches.push({
            id: `c_r${cRound}_m${i}`,
            bracket: "consolation",
            round: cRound,
            matchIndex: i,
            pairA: null,
            pairB: null,
            scoreA: "",
            scoreB: "",
            saved: false,
            winner: null,
            loser: null,
            nextMatchId: cNew > 1 ? `c_r${cRound + 1}_m${Math.floor(i / 2)}` : null,
            nextMatchSlot: i % 2 === 0 ? "A" : "B",
            loserMatchId: null,
          });
        }
        cPrev = cNew;
        cRound++;
      }
    }
  }

  // 4. Ripple Byes
  rippleByes(matches);

  return matches;
}
```

- [ ] **Step 2: Ejecutar tests**

```bash
npx vitest run src/logic/relampago.test.js --reporter=verbose
```

Esperado: T-REL-01, T-REL-02, T-REL-03 PASS. T-REL-04, T-REL-05 pueden aún fallar (advanceBracket no fue modificado todavía). T-REL-06, T-REL-07 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/logic/relampago.js
git commit -m "feat: refactorizar buildBracket para consolacion sin byes"
```

---

## Task 4: Fix `rippleByes` y `advanceBracket`

**Files:**
- Modify: `src/logic/relampago.js`

- [ ] **Step 1: Fix `rippleByes` — no propagar BYE losers a consolación**

Localizar en `rippleByes` (alrededor de línea 196 del archivo original, dentro del bloque `if (changed) {`):

```js
// ANTES (línea ~196):
if (m.loserMatchId && m.loser) {
  const cons = matches.find((nx) => nx.id === m.loserMatchId);
  if (cons) {
    if (!cons.pairA) cons.pairA = m.loser;
    else cons.pairB = m.loser;
  }
}
```

Reemplazar con:

```js
if (m.loserMatchId && m.loser && m.loser.id !== "bye") {
  const cons = matches.find((nx) => nx.id === m.loserMatchId);
  if (cons) {
    if (m.loserMatchSlot === "A") cons.pairA = m.loser;
    else cons.pairB = m.loser;
  }
}
```

- [ ] **Step 2: Fix `advanceBracket` — usar `loserMatchSlot` explícito con guarda `shouldRoute`**

Localizar en `advanceBracket` (alrededor de línea 148):

```js
// ANTES:
if (match.loserMatchId && match.loser) {
  const cons = updated.find((m) => m.id === match.loserMatchId);
  if (cons) {
    if (!cons.pairA) cons.pairA = match.loser;
    else cons.pairB = match.loser;
  }
}
```

Reemplazar con:

```js
if (match.loserMatchId && match.loser && match.loser.id !== "bye") {
  // Para W_R2 con bye-tracking: solo enrutar si el loser tuvo bye en R1.
  // Para W_R1 real (sin flags) y W_R2 guaranteed (ambos son bye): siempre enrutar.
  const loserIsA = a < b; // a < b → pairA perdió
  const loserHadBye = loserIsA ? (match.pairAByeInR1 ?? false) : (match.pairBByeInR1 ?? false);
  const hasByeTracking = match.pairAByeInR1 != null || match.pairBByeInR1 != null;
  const shouldRoute = !hasByeTracking || loserHadBye;
  if (shouldRoute) {
    const cons = updated.find((m) => m.id === match.loserMatchId);
    if (cons) {
      if (match.loserMatchSlot === "A") cons.pairA = match.loser;
      else cons.pairB = match.loser;
    }
  }
}
```

> Lógica de `shouldRoute`:
> - **W_R1 real** (sin `pairAByeInR1`/`pairBByeInR1`): `hasByeTracking = false` → siempre rutea. ✓  
> - **W_R2 guaranteed** (ambos `true`): `loserHadBye` siempre `true` → siempre rutea. ✓  
> - **W_R2 conditional** (uno `true`): solo rutea si el que perdió tenía bye. ✓  
> - **W_R2 sin bye** (`loserMatchId` es `null`): bloque entero se salta. ✓

- [ ] **Step 3: Ejecutar todos los tests**

```bash
npx vitest run src/logic/relampago.test.js --reporter=verbose
```

Esperado: T-REL-01 a T-REL-07 todos PASS.

- [ ] **Step 4: Ejecutar suite completa**

```bash
npm run test
```

Esperado: todos los tests existentes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/relampago.js
git commit -m "fix: rippleByes y advanceBracket no propagan BYEs a consolacion"
```

---

## Task 5: Tarjeta "Exento" en `BracketMatchCard`

**Files:**
- Modify: `src/components/play/PlayRelampago.jsx`

- [ ] **Step 1: Añadir rama de render para tarjeta Exento**

En `BracketMatchCard`, localizar el `return (` (línea ~41). El componente actual renderiza siempre el mismo layout. Añadir una rama antes del `return` principal:

```jsx
// Añadir ANTES del return principal (después de la declaración de wonB, línea ~28):
const realPairName = isByeA
  ? (match.pairB ? `${match.pairB.p1} / ${match.pairB.p2}` : "TBD")
  : (match.pairA ? `${match.pairA.p1} / ${match.pairA.p2}` : "TBD");

if (isBye) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 10,
        borderLeft: `3px solid ${accentColor}`,
        padding: "10px 14px",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
        {realPairName}
      </div>
      <div style={{ fontSize: 11, color: "#64748b" }}>
        Exento — pasa directo
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build para verificar sin errores**

```bash
npm run build
```

Esperado: build limpio, sin warnings de JSX.

- [ ] **Step 3: Ejecutar suite completa**

```bash
npm run test
```

Esperado: todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/play/PlayRelampago.jsx
git commit -m "feat: tarjeta Exento para partidos con bye en relampago"
```

---

## Task 6: Deploy y verificación

- [ ] **Step 1: Build de producción**

```bash
npm run build
```

Esperado: build limpio.

- [ ] **Step 2: Deploy a Firebase**

```bash
"/Users/ximeyfede/Desktop/Padel app/node_modules/.bin/firebase" deploy --only hosting
```

Esperado: deploy exitoso, URL `https://app-padel-torneo.web.app`.

- [ ] **Step 3: Commit final si hay cambios pendientes**

```bash
git status
```

Si hay cambios sin commitear:

```bash
git add -A
git commit -m "chore: deploy relampago bye consolacion fix"
```
