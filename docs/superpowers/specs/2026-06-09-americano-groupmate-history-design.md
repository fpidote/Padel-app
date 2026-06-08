# Fix: Groupmate History — Diversificar formación de grupos en Americano

**Fecha:** 2026-06-09  
**Estado:** Aprobado

---

## Problema

`precomputeAllRounds` forma grupos de 4 jugadores usando `levelSortedWithShuffle` + slice topHalf/botHalf. El shuffle es aleatorio dentro de cada nivel, pero no considera quiénes ya compartieron cancha. Resultado: los mismos 4 jugadores pueden ser agrupados juntos en múltiples rondas.

Con jugadores de nivel mixto (1, 2, 3), el problema se agrava: los 6 avanzados siempre ocupan topHalf[0..5], creando 3 grupos fijos con 2 avanzados cada uno. Cada grupo con 2 avanzados solo tiene 2 splits válidos (sin penalidad AA). Tras 2 rondas con el mismo grupo, el 3er encuentro fuerza una repetición de pareja. Medido: 14/20 trials con al menos una repetición antes del fix.

---

## Diseño

### Cambio único: `precomputeAllRounds` en `americano.js`

#### 1. Nuevo estado: `gmh = {}` (groupmate history)

Mismo patrón que `ph`, `oh`, `courtHistory`. Se inicializa vacío y vive en el estado mutable compartido entre rondas.

```js
const gmh = {};   // groupmate history: { "pk(a,b)": count }
```

**Clave:** `pk(a.id, b.id)` — mismo helper simétrico ya usado en `ph` y `oh`.  
**Valor:** número de veces que `a` y `b` compartieron la misma cancha (como pareja O como rivales).

#### 2. Búsqueda del mejor agrupamiento (reemplaza el único shuffle actual)

En lugar de generar un solo agrupamiento por ronda, generar `GROUPING_CANDIDATES = 20` candidatos (cada uno con un shuffle diferente de `levelSortedWithShuffle`) y elegir el que tenga menor overlap de `gmh`. Si algún candidato tiene score 0 (nadie repite grupo), cortar antes de llegar a 20.

```js
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

El `shuffle(bestGroups)` al final mantiene el comportamiento existente de asignar grupos a canchas en orden aleatorio.

#### 3. Actualizar `gmh` al final de cada ronda

Agregar al bloque de actualización de estado post-ronda:

```js
cs.forEach((court) => {
  const four = [...court.pairA, ...court.pairB];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const k = pk(four[i].id, four[j].id);
      gmh[k] = (gmh[k] || 0) + 1;
    }
});
```

### Complejidad

Por ronda: `20 candidatos × (N/4 grupos × 6 pares)`. Para 20 jugadores: `20 × 5 × 6 = 600 operaciones`. Trivial — `precomputeAllRounds` se ejecuta en setup, no en tiempo real.

---

## Scope

| Archivo | Cambio |
|---------|--------|
| `src/logic/americano.js` | Agregar `gmh`, reemplazar generación de grupos, actualizar `gmh` post-ronda |
| `src/logic/americano.simulation.test.js` | Actualizar T-SIM-01 para 20 jugadores / nivel mixto |

Sin cambios en: `scoredSplit`, `PENALTY`, `RELAX_CONFIGS`, `buildRoundAmericano`, `buildFirstRoundAmericano`, ni ningún componente React.

La interfaz pública de `precomputeAllRounds(entities, config)` no cambia.

---

## Testing

**T-SIM-01 actualizado:** Usar 20 jugadores con nivel mixto `(i % 3) + 1` y verificar 0 repeticiones de pareja en las 5 rondas. Antes del fix este test fallaba en ~70% de los trials. Con el fix debe pasar en 50/50 trials.

**Tests existentes:** Los 82 tests de `americano.test.js` no deben romperse — el cambio es interno a `precomputeAllRounds` sin modificar la interfaz ni los demás paths.
