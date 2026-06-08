# Relámpago — Fix Byes y Cuadro de Consolación

**Fecha:** 2026-06-09  
**Área:** `src/logic/relampago.js`, `src/components/play/PlayRelampago.jsx`  
**Tipo:** Bug fix + mejora de lógica

---

## Problema

Cuando el número de parejas no es potencia de 2, el torneo Relámpago presenta dos bugs:

1. **Display feo de BYE**: los partidos donde una pareja no tiene rival muestran una tarjeta completa con "BYE" en itálica oscura — mismo layout que un partido real, con scores vacíos.

2. **Consolación contaminada**: `rippleByes` envía el BYE "perdedor" a consolación como si fuera una pareja real. Con 6 parejas, consolación R1 termina con dos slots ocupados por BYEs que pelean entre sí; el ganador (otro BYE fantasma) avanza a la final. Los perdedores reales de R1 compiten contra ese BYE en consolación R2.

---

## Regla de negocio

> Una pareja va a consolación si pierde su **primer partido real** (no un bye).  
> El objetivo es garantizar que todas las parejas jueguen un mínimo de dos partidos.

- Pareja que pierde en W_R1 (partido real) → consolación R1.
- Pareja con bye en R1 que pierde en W_R2 (su primer partido real) → consolación R2.
- Pareja que ganó en W_R1 y pierde en W_R2 → eliminada definitivamente (ya jugó 2 partidos).

---

## Diseño

### 1. Visual — tarjeta "Exento"

**Archivo:** `PlayRelampago.jsx` → `BracketMatchCard`

Cuando exactamente una de las dos parejas es BYE, se renderiza una tarjeta compacta:

```
┌──[accentColor]──────────────────────────────┐
│  Pérez / García                             │
│  ─── Exento — pasa directo ───────────────  │
└─────────────────────────────────────────────┘
```

- Altura ~60px (vs ~110px de tarjeta normal).
- Sin inputs de score, sin botón "Guardar", sin "✏️ editar".
- El partido ya llega `saved: true` por `rippleByes`; se muestra el estado final.
- Nombre de la pareja real: color primario `#f1f5f9`.
- Línea "Exento — pasa directo": color muted `#64748b`, tamaño 11px.
- BYE vs BYE: sigue oculto (sin cambio).

### 2. Lógica — consolación correcta

**Archivo:** `relampago.js`

#### 2.1 Clasificación de partidos W_R1

Después de calcular los seeds, se identifican:

```
byeMatchIndices = conjunto de índices i donde seeds[2i].id === "bye" || seeds[2i+1].id === "bye"
realMatchList   = lista ordenada de índices i donde ninguno es BYE
real_r1_count   = realMatchList.length
```

#### 2.2 Enrutamiento de losers en W_R1

- **Partido real** (índice en `realMatchList` con orden `k`):  
  `loserMatchId = "c_r1_m" + Math.floor(k / 2)`  
  `loserMatchSlot = k % 2 === 0 ? "A" : "B"`
- **Partido bye** (índice en `byeMatchIndices`):  
  `loserMatchId = null` → BYE nunca va a consolación.

#### 2.3 Flags de bye en W_R2

Para cada W_R2 match índice `i`:
```
pairAByeInR1 = byeMatchIndices.has(2 * i)
pairBByeInR1 = byeMatchIndices.has(2 * i + 1)
```

Estos flags se almacenan en el match object. Se usan solo en `advanceBracket`.

#### 2.4 Cálculo del tamaño de consolación

```
consol_r1_match_count  = Math.floor(real_r1_count / 2)
has_odd_r1             = real_r1_count % 2 === 1

// W_R2 con AMBOS bye-avanzados → 1 loser garantizado → entra en consolación R2
guaranteed_bye_r2_list = W_R2 matches donde pairAByeInR1 && pairBByeInR1

// W_R2 con solo UN lado bye-avanzado → loser condicional → entra en consolación R1 (slot libre si existe)
conditional_bye_r2_list = W_R2 matches donde pairAByeInR1 XOR pairBByeInR1
```

#### 2.5 Estructura de consolación

**Consolación R1:**
- `consol_r1_match_count` partidos para los losers reales de W_R1.
- Si `has_odd_r1` Y existe al menos un `conditional_bye_r2`:
  - Se añade 1 match extra en consolación R1 con slot B vacío (null).
  - El W_R2 condicional correspondiente recibe `loserMatchId → c_r1_m(last)` y `loserMatchSlot = "B"`.
  - Si ese W_R2 condicional nunca produce un bye-loser (el bye team ganó), el slot queda null → `rippleByes` auto-avanza al rival.
- Si `has_odd_r1` y NO hay conditional bye-loser:
  - El R1 loser impar recibe `loserMatchId` apuntando a un match de consolación R1 con pairA nulo; el tercer equipo va en pairA, y el slot B es null → auto-bye.

**Consolación R2 (partidos adicionales para guaranteed bye-losers):**
- Por cada match en `guaranteed_bye_r2_list` se añade un match en consolación R2 con slot B reservado.
- Ese W_R2 match recibe `loserMatchId → c_r2_m(x)` y `loserMatchSlot = "B"`.
- El slot A lo recibe el winner del match de consolación R1 correspondiente (via `nextMatchId`).

**Consolación R2+ (rounds subsiguientes):**
- Se construyen igual que hoy pero basados en el nuevo `consol_r1_match_count` (no en `cSize = size/2`).

#### 2.6 Fix en `rippleByes`

En la sección de propagación a consolación:
```js
// ANTES:
if (m.loserMatchId && m.loser) { ... }

// DESPUÉS:
if (m.loserMatchId && m.loser && m.loser.id !== "bye") { ... }
```

Esta línea es la corrección mínima que evita que BYEs contaminen consolación, independientemente del resto de la refactorización.

#### 2.7 Fix en `advanceBracket` — uso de `loserMatchSlot`

`advanceBracket` deja de usar la estrategia "first available slot" para consolación y pasa a usar `loserMatchSlot` explícito (disponible en todos los matches tras el fix de `buildBracket`):

```js
// Para TODOS los matches (W_R1 y W_R2) que tienen loserMatchId:
if (match.loserMatchId && match.loser && match.loser.id !== "bye") {
  const cons = updated.find(m => m.id === match.loserMatchId);
  if (cons) {
    if (match.loserMatchSlot === "A") cons.pairA = match.loser;
    else cons.pairB = match.loser;
  }
}
```

Para W_R2 con `pairAByeInR1` / `pairBByeInR1`, el loser se detecta por posición (no por referencia de objeto):

```js
// loserIsA = true si pairA perdió (a < b)
const loserIsA = a < b;
const loserHadBye = loserIsA ? match.pairAByeInR1 : match.pairBByeInR1;
// Si loserHadBye, match.loserMatchId ya está pre-asignado en buildBracket.
// El bloque de arriba lo enruta automáticamente.
```

Para W_R2 donde `pairAByeInR1` y `pairBByeInR1` son ambos `false` (o no existen → torneos viejos): `loserMatchId` es `null` → no va a consolación, se descarta. Backward compatible.

---

## Compatibilidad con torneos existentes

Los torneos guardados en Firestore tienen la estructura vieja (sin `pairAByeInR1`, con BYEs en consolación). No se migran. El fix aplica solo a torneos nuevos creados después del deploy. Los torneos viejos mantienen el comportamiento actual.

---

## Archivos afectados

| Archivo | Cambios |
|---|---|
| `src/logic/relampago.js` | `buildBracket`: nueva clasificación de partidos, consolación variable. `advanceBracket`: enrutamiento W_R2. `rippleByes`: no propagar BYE losers. |
| `src/components/play/PlayRelampago.jsx` | `BracketMatchCard`: tarjeta Exento para matches con BYE. |

---

## Tests

Se añaden tests en `src/logic/relampago.test.js` (nuevo archivo):

| ID | Escenario | Assertion |
|---|---|---|
| T-REL-01 | `buildBracket` con 6 parejas | consolación R1 tiene exactamente 2 equipos reales; 0 BYEs |
| T-REL-02 | `buildBracket` con 6 parejas | consolación R2 tiene 1 slot reservado para bye-loser de W_R2 |
| T-REL-03 | `buildBracket` con 7 parejas | consolación R1 tiene 3 equipos reales; slot condicional vacío |
| T-REL-04 | `advanceBracket` con 6 parejas, guarda W_R2 bye-match | loser llega a consolación R2 |
| T-REL-05 | `advanceBracket` con 6 parejas, guarda W_R2 bye-match | winner de W_R2 no va a consolación |
| T-REL-06 | `buildBracket` con 4 parejas (sin byes) | sin cambio de comportamiento |
| T-REL-07 | `buildBracket` con 8 parejas (sin byes) | sin cambio de comportamiento |

---

## Casos fuera de alcance

- Migración de torneos existentes con estructura vieja.
- Consolación para losers de W_R3+ (en torneos con ≥16 parejas con múltiples rondas con bye). El cuadro Relámpago en clubes raramente supera 8-10 parejas.
