# Groupmate History — Diversificar agrupamiento en Americano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las repeticiones de pareja en torneos con jugadores de nivel mixto agregando un historial de compañeros de cancha (`gmh`) que guía la formación de grupos hacia combinaciones nuevas cada ronda.

**Architecture:** Se agrega `gmh = {}` al estado mutable de `precomputeAllRounds`. El paso de formación de grupos reemplaza el único shuffle aleatorio por una búsqueda de 20 candidatos, eligiendo el agrupamiento con menor overlap de `gmh`. Al final de cada ronda, `gmh` se actualiza con los 6 pares de cada cancha. Sin cambios en `scoredSplit`, PENALTY weights, ni interfaces externas.

**Tech Stack:** JavaScript ES2022, Vitest

---

## Archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `src/logic/americano.js` — función `precomputeAllRounds` |
| Modificar | `src/logic/americano.simulation.test.js` — T-SIM-01 |

---

### Task 1: Actualizar T-SIM-01 al escenario real (20 jugadores, nivel mixto)

El test actual usa 8 jugadores / nivel 0 / 3 rondas (escenario pequeño y confiable). Necesitamos el escenario duro que hoy falla — 20 jugadores con nivel mixto — para tener un test que falle antes del fix y pase después.

**Files:**
- Modify: `src/logic/americano.simulation.test.js`

- [ ] **Step 1.1: Reemplazar T-SIM-01 con el escenario de 20 jugadores / nivel mixto**

Buscar el test `T-SIM-01` (comienza con `test("T-SIM-01:`) y reemplazarlo completo:

```js
  // T-SIM-01: escenario real de producción — 20 jugadores con niveles mixtos.
  // Con el fix de groupmate history, el algoritmo debe lograr 0 repeticiones de pareja.
  // C(20,2)=190 pares posibles, solo 50 usados en 5 rondas — matemáticamente holgado.
  test("T-SIM-01: cero repeticiones de pareja — 20 jugadores, nivel mixto, 5 rondas", () => {
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
```

- [ ] **Step 1.2: Ejecutar el test — debe FALLAR (confirma que el test es significativo)**

```bash
npx vitest run src/logic/americano.simulation.test.js --reporter=verbose
```

Salida esperada: `T-SIM-01` falla con mensaje tipo `expected 3 to be 0` (número de pares repetidos). `T-SIM-02` pasa. Si T-SIM-01 pasa en verde sin el fix, algo está mal — no continuar.

- [ ] **Step 1.3: Commit del test actualizado**

```bash
git add src/logic/americano.simulation.test.js
git commit -m "test: actualizar T-SIM-01 a escenario real 20j nivel mixto — debe fallar antes del fix"
```

---

### Task 2: Implementar groupmate history en `precomputeAllRounds`

Tres cambios quirúrgicos en `src/logic/americano.js`, todos dentro de `precomputeAllRounds`.

**Files:**
- Modify: `src/logic/americano.js`

- [ ] **Step 2.1: Agregar `gmh` al estado mutable compartido (línea 147)**

Buscar el bloque de estado (líneas 142–147):

```js
  // Estado mutable compartido entre rondas (objetos planos — D-02)
  const ph = {};            // historial de parejas: { "0_1": 2, ... }
  const oh = {};            // historial de rivales: { "0_1": 3, ... }
  const courtHistory = {};  // historial de canchas: { "3_c0": 1, ... }
  const soh = {};           // historial de descanso: { 5: 1, ... }
  const streak = {};        // rondas consecutivas jugadas sin descanso: { 5: 3, ... }
```

Reemplazar con:

```js
  // Estado mutable compartido entre rondas (objetos planos — D-02)
  const ph = {};            // historial de parejas: { "0_1": 2, ... }
  const oh = {};            // historial de rivales: { "0_1": 3, ... }
  const courtHistory = {};  // historial de canchas: { "3_c0": 1, ... }
  const gmh = {};           // historial de compañeros de cancha: { "0_1": 2, ... }
  const soh = {};           // historial de descanso: { 5: 1, ... }
  const streak = {};        // rondas consecutivas jugadas sin descanso: { 5: 3, ... }
```

- [ ] **Step 2.2: Reemplazar la formación de grupos por la búsqueda de 20 candidatos (líneas 181–199)**

Buscar este bloque dentro del loop `for (let r = 0; ...)`:

```js
    const { active, sittingOut } = selectSittingOut(entities, courts, soh, streak);
    const sorted = levelSortedWithShuffle(active);

    const topHalf = sorted.slice(0, activeCourts * 2);
    const botHalf = sorted.slice(activeCourts * 2);

    const cs = [];
    // Set de restricciones que dispararon relaxación en esta ronda (colapsado por tipo — Open Question 2)
    const constraintsRelaxed = new Set();
    let maxAttemptUsed = 0;

    // Consecutive indexing: clusters 2 M's per group so scoredSplit can pair them
    // as opponents (M+P vs M+P). Then shuffle groups so advanced players aren't
    // always assigned to courts 0,1 — any court can get the M vs M match.
    const groups = [];
    for (let c = 0; c < activeCourts; c++) {
      groups.push([topHalf[c * 2], topHalf[c * 2 + 1], botHalf[c * 2], botHalf[c * 2 + 1]]);
    }
    const shuffledGroups = shuffle(groups);
```

Reemplazar con:

```js
    const { active, sittingOut } = selectSittingOut(entities, courts, soh, streak);

    const cs = [];
    const constraintsRelaxed = new Set();
    let maxAttemptUsed = 0;

    // Probar 20 agrupamientos candidatos y elegir el que minimiza el overlap de gmh
    // (cuántas veces los jugadores de un grupo ya compartieron cancha).
    // Cada candidato usa un shuffle distinto de levelSortedWithShuffle.
    // Cortar antes si encontramos score 0 (ningún jugador repite grupo).
    const GROUPING_CANDIDATES = 20;
    let bestGroups = null;
    let bestGroupScore = Infinity;
    for (let attempt = 0; attempt < GROUPING_CANDIDATES; attempt++) {
      const sorted = levelSortedWithShuffle(active);
      const topH = sorted.slice(0, activeCourts * 2);
      const botH = sorted.slice(activeCourts * 2);
      const candidate = [];
      for (let c = 0; c < activeCourts; c++) {
        candidate.push([topH[c * 2], topH[c * 2 + 1], botH[c * 2], botH[c * 2 + 1]]);
      }
      let score = 0;
      candidate.forEach((group) => {
        for (let i = 0; i < 4; i++)
          for (let j = i + 1; j < 4; j++)
            score += gmh[pk(group[i].id, group[j].id)] || 0;
      });
      if (score < bestGroupScore) {
        bestGroupScore = score;
        bestGroups = candidate;
      }
      if (score === 0) break;
    }
    const shuffledGroups = shuffle(bestGroups);
```

- [ ] **Step 2.3: Agregar actualización de `gmh` al bloque de estado post-ronda (después de línea 262)**

Buscar el bloque que cierra el `cs.forEach` de actualización de estado:

```js
      [...court.pairA, ...court.pairB].forEach((p) => {
        const key = `${p.id}_c${ci}`;
        courtHistory[key] = (courtHistory[key] || 0) + 1;
      });
    });
```

Reemplazar con:

```js
      [...court.pairA, ...court.pairB].forEach((p) => {
        const key = `${p.id}_c${ci}`;
        courtHistory[key] = (courtHistory[key] || 0) + 1;
      });

      const four = [...court.pairA, ...court.pairB];
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
          const k = pk(four[i].id, four[j].id);
          gmh[k] = (gmh[k] || 0) + 1;
        }
    });
```

- [ ] **Step 2.4: Ejecutar el build para verificar que no hay errores de sintaxis**

```bash
npm run build
```

Salida esperada: `✓ built in X.XXs` sin errores.

- [ ] **Step 2.5: Ejecutar todos los tests**

```bash
npm run test
```

Salida esperada: todos los tests pasan, incluyendo T-SIM-01 (ahora en verde). Si T-SIM-01 sigue fallando, revisar el Step 2.2 — probablemente `bestGroups` no está siendo asignado correctamente.

- [ ] **Step 2.6: Commit del fix**

```bash
git add src/logic/americano.js
git commit -m "feat: groupmate history — evitar grupos repetidos en emparejamiento americano"
```

---

## Verificación final

```bash
npx vitest run src/logic/americano.simulation.test.js src/logic/americano.test.js --reporter=verbose
```

Todos los tests deben pasar. T-SIM-01 en verde confirma que 20 jugadores con nivel mixto ahora produce 0 repeticiones de pareja en 5 rondas.
