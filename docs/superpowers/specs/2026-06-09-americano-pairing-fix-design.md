# Fix: Desincronización de rondas precalculadas en torneo Americano

**Fecha:** 2026-06-09  
**Estado:** Aprobado

---

## Problema

El algoritmo de emparejamiento del Americano individual tiene dos generadores de rondas que no se coordinan:

1. `buildFirstRoundAmericano()` — genera la ronda 1 de forma independiente, con su propio shuffle y sin historial previo.
2. `precomputeAllRounds()` — precalcula todas las rondas (índices 0..N) con historial compartido de parejas, rivales y canchas.

Al iniciar el torneo (`onStart`), `currentRound` se fija con `buildFirstRoundAmericano()`, y `roundNum` arranca en 1. Cuando el organizador avanza a la siguiente ronda, `PlayAmericano` busca `precomputedRounds[t.roundNum]` = `precomputedRounds[1]`, **saltándose el índice 0**.

Consecuencia: `precomputedRounds[1]` fue calculado asumiendo que `precomputedRounds[0]` fue la ronda 1 real. Como la ronda 1 real fue diferente, el historial de parejas y rivales en el precómputo es incorrecto desde la ronda 2. Las penalidades de repetición no tienen efecto real, y parejas/rivales se repiten.

---

## Diseño de la solución (Opción A — fix mínimo)

### Cambio único: `SetupAmericano.jsx` → `onStart()`

**Antes:**
```js
const { courts, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode);
let precomputedRounds = null;
if (!isPairs && matchmaking === "americano") {
  precomputedRounds = localPrecomputedRounds ?? precomputeAllRounds(entities, t.config).rounds;
}
await persist({ currentRound: courts, sittingOut, roundNum: 1, precomputedRounds, ... });
```

**Después:**
```js
let currentRound, sittingOut;
let precomputedRounds = null;
let roundWarnings = [];

if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
  // Obtener el precómputo completo
  if (localPrecomputedRounds !== null) {
    precomputedRounds = localPrecomputedRounds;
    roundWarnings = localRoundWarnings;
  } else {
    const result = precomputeAllRounds(entities, t.config);
    precomputedRounds = result.rounds;
    roundWarnings = result.warnings;
  }
  // Usar precomputedRounds[0] como ronda 1 (historial consistente)
  const firstRound = precomputedRounds[0];
  currentRound = firstRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
  sittingOut = firstRound.sittingOut;
} else {
  // Modo pairs: no hay precómputo, buildFirstRoundAmericano sigue siendo el fallback
  ({ courts: currentRound, sittingOut } = buildFirstRoundAmericano(entities, t.config.courts, t.config.mode));
}

await persist({ currentRound, sittingOut, roundNum: 1, precomputedRounds, roundWarnings, ... });
```

### Por qué funciona

Con `roundNum: 1` y `currentRound = precomputedRounds[0]`:

| Ronda | roundNum al avanzar | precomputedRounds usado |
|-------|---------------------|------------------------|
| 1     | —                   | [0] como currentRound  |
| 2     | 1                   | [1]                    |
| 3     | 2                   | [2]                    |
| 4     | 3                   | [3]                    |
| 5     | 4                   | [4]                    |

El historial interno de `precomputeAllRounds` es consistente en toda la secuencia. Para 20 jugadores y 5 rondas: 190 pares posibles, 25 pares jugados — sin razón matemática para repetir.

### Archivos no tocados

- `americano.js` — sin cambios
- `PlayAmericano.jsx` — sin cambios
- `buildFirstRoundAmericano` — sigue siendo el generador para modo pairs

---

## Test de simulación

Después del fix, ejecutar una simulación de 20 jugadores / 5 rondas / 5 canchas y verificar:

1. **Cero repeticiones de pareja** (`partnerHistory[pk(a,b)] <= 1` para todas las claves al final)
2. **Cero repeticiones de rival** (idem con `opponentHistory`)
3. **Distribución de descanso equitativa** (todos los jugadores descansan el mismo número de rondas o con diferencia de ±1)

El test puede ser un test de Vitest en `americano.test.js` que llame a `precomputeAllRounds` con 20 jugadores y `maxRounds: 5`, luego inspeccione el historial resultante.

---

## Scope

- Solo `SetupAmericano.jsx` → `onStart()`
- No cambia la lógica de precómputo ni las penalidades
- No afecta torneos ya iniciados (el cambio es en el momento de `onStart`)
- Retrocompatible: torneos existentes en Firestore usan su `precomputedRounds` ya guardado
