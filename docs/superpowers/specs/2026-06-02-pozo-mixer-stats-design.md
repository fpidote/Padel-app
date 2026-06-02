# El Pozo — Modo Mixer + Sistema de Estadísticas

**Fecha:** 2026-06-02
**Estado:** Aprobado — pendiente implementación
**Scope:** Extensión de El Pozo para soportar parejas temporales (Mixer) e historial de matches en subcolección de Firestore con stats por jugador.

---

## 1. Contexto y motivación

El Pozo actualmente soporta únicamente parejas fijas (`pozoMode: "fixed"`). La mecánica de ascenso/descenso por canchas (`applyPozoRoundResults`) fue validada con una suite de 17 tests. Este spec define la extensión hacia:

- **Modo Mixer**: jugadores individuales forman parejas temporales cada ronda, balanceadas por nivel.
- **Subcolección `matches/`**: historial de matches persistido en Firestore, autosuficiente para reconstruir stats.
- **`calculateStats`**: función pura que procesa el historial y devuelve stats por jugador.

**Restricción crítica:** `applyPozoRoundResults` no se modifica. Toda la nueva lógica de Mixer se adapta a su interfaz existente mediante el patrón adaptador (pareja temporal con el mismo shape que una pareja fija).

---

## 2. Flag de modo

```js
// config dentro del documento principal del torneo
config: {
  // ...campos existentes sin cambio...
  pozoMode: "fixed" | "mixer",  // default: "fixed"
}
```

- **Inmutable** una vez que `status === "playing"`. No puede cambiarse a mitad de torneo.
- Torneos existentes sin este campo se tratan como `"fixed"` — compatibilidad total hacia atrás.
- En `SetupPairs`, cuando `pozoMode === "mixer"`, se usa `playerInputs[]` (individuos) en lugar de `pairInputs[]` (parejas).

---

## 3. Modelo de datos

### 3.1 Match document — subcolección `torneos/{code}/matches/{matchId}`

```js
{
  // Contexto
  roundNum:    number,      // ronda del torneo (1-based)
  courtNum:    number,      // cancha (1 = cancha del rey)
  confirmedAt: Timestamp,   // momento en que el organizador confirmó

  // Modo
  mode: "fixed" | "mixer",

  // Participantes
  teamA: {
    playerIds:        [string, string],  // siempre exactamente 2 IDs
    pairId:           string | null,     // ID de la pareja fija; null en mixer
    courtLevelBefore: number,            // courtLevel antes de esta ronda
    courtLevelAfter:  number,            // courtLevel tras aplicar resultado
  },
  teamB: {
    playerIds:        [string, string],
    pairId:           string | null,
    courtLevelBefore: number,
    courtLevelAfter:  number,
  },

  // Resultado
  result: {
    scoreA:      number,
    scoreB:      number,
    winningSide: "A" | "B",  // denormalizado para queries de stats sin recalcular
  },
}
```

**Decisiones de diseño:**
- `playerIds` siempre tiene exactamente 2 elementos — unifica el acceso en ambos modos.
- `pairId: null` en mixer (campo presente en ambos modos, evita branching en queries).
- `courtLevelBefore/After` hace el historial autosuficiente: `calculateStats` no necesita el doc principal.
- `winningSide` denormalizado evita recalcular en cada iteración de stats.

### 3.2 Modelo de jugador individual (solo Mixer)

Cuando `pozoMode === "mixer"`, el torneo tiene un array `players[]` en el documento principal en lugar de `pairs[]`:

```js
// t.players[] — solo existe cuando pozoMode === "mixer"
{
  id:         string,
  name:       string,
  courtLevel: number,  // tiebreaker descendente — mismo rol que en pairs
  pts:        number,
  gf:         number,
  gc:         number,
}
```

El modelo `pairs[]` para `"fixed"` no cambia en absoluto.

---

## 4. Contratos de funciones

### 4.1 Funciones existentes — sin modificar

```js
// src/logic/pozo.js
buildPozoRound(pairs, courts) → CourtAssignment[]
applyPozoRoundResults(pairs, currentRound, courts) → Pair[]
```

Estas funciones son agnósticas al modo. En Mixer se les pasan temp pairs con el mismo shape que las fixed pairs.

### 4.2 Funciones nuevas en `src/logic/pozo.js`

#### `shufflePlayers`

Genera la propuesta de emparejamiento inicial para una ronda Mixer.

```js
shufflePlayers(players: Player[], numCourts: number) → ProposedRound

// Algoritmo:
// 1. Ordenar jugadores por courtLevel desc
// 2. Tomar los primeros numCourts*4 jugadores (el resto → unassigned)
// 3. Por cada grupo de 4 (una cancha):
//    - Los 2 de mayor courtLevel forman teamA
//    - Los 2 de menor courtLevel forman teamB
// 4. Devolver ProposedRound con courts[] y unassigned[]
```

#### `distributePairLevelToPlayers`

Paso final del flujo Mixer: distribuye todos los resultados calculados por `applyPozoRoundResults` de vuelta a los jugadores individuales.

```js
distributePairLevelToPlayers(
  updatedTempPairs: TempPair[],   // resultado de applyPozoRoundResults
  players: Player[],
  currentRound: CourtAssignment[] // para saber quién ganó cada cancha
) → Player[]

// Para cada pareja temporal, ambos jugadores reciben:
//   - courtLevel  → del courtLevel actualizado de la temp pair
//   - pts         → +1 si la temp pair ganó (igual que en fixed)
//   - gf / gc     → del gf/gc actualizado de la temp pair
//
// Esto mantiene players[].pts como sort key primario en shufflePlayers,
// consistente con el comportamiento de fixed mode.
```

#### `isProposedRoundValid`

Validación antes de habilitar el botón "Confirmar Ronda".

```js
isProposedRoundValid(proposedRound: ProposedRound) → boolean

// → true si:
//   - proposedRound.unassigned.length === 0
//   - cada cancha tiene exactamente 4 playerIds únicos
//   - ningún playerId aparece en más de una cancha
```

### 4.3 Nueva función en `src/logic/stats.js`

#### `calculateStats`

Función pura. Recibe el array de matches cargados lazy desde la subcolección.

```js
calculateStats(matches: Match[]) → StatsMap

// StatsMap
{
  [playerId: string]: {
    matchesPlayed: number,
    gamesWon:      number,
    gamesLost:     number,
    pointsFor:     number,   // suma de scores del lado del jugador
    pointsAgainst: number,
    pointsDiff:    number,   // pointsFor - pointsAgainst
    winRate:       number,   // gamesWon / matchesPlayed (0.0–1.0)
  }
}

// Siempre indexa por playerId usando teamA.playerIds y teamB.playerIds.
// Para fixed mode, el consumidor puede agrupar por pairId si lo necesita
// (disponible en cada match document).
// calculateStats no necesita saber el modo.
```

---

## 5. Estado local de React — `proposedRound`

Este objeto **nunca se persiste en Firebase**. Vive en `useState` del componente hasta que el organizador confirma la ronda.

```js
// Shape del estado local
{
  courts: [
    {
      courtNum: number,
      teamA: { playerIds: [string, string] },
      teamB: { playerIds: [string, string] },
    }
  ],
  unassigned: string[],  // playerIds pendientes de asignación
}
```

**Flujo de vida:**
1. `shufflePlayers(players, numCourts)` → genera `proposedRound` inicial.
2. El organizador edita libremente (drag & drop o intercambio): solo muta estado local.
3. `isProposedRoundValid(proposedRound)` → habilita/deshabilita el botón "Confirmar".
4. Al confirmar: se construyen temp pairs, se ejecuta `applyPozoRoundResults`, se llama a `distributePairLevelToPlayers`, y recién entonces se persiste en Firebase (doc principal + subcollección `matches/`).

---

## 6. Flujo completo por modo

| Paso | `fixed` | `mixer` |
|---|---|---|
| Armar propuesta | `buildPozoRound(pairs, courts)` | `shufflePlayers(players, courts)` |
| Estado provisional | directo a `currentPozoRound` | `proposedRound` (local) |
| Validar | — | `isProposedRoundValid(proposedRound)` |
| Aplicar resultados | `applyPozoRoundResults(pairs, round, courts)` | idem sobre temp pairs (mismo shape) |
| Distribuir courtLevel | — | `distributePairLevelToPlayers(updatedTempPairs, players)` |
| Persistir doc principal | actualizar `pairs[]` | actualizar `players[]` |
| Persistir historial | escribir a `matches/` subcollección | idem |

---

## 7. Construcción de temp pairs para Mixer

Para que `applyPozoRoundResults` funcione sin modificaciones en Mixer, las temp pairs deben tener exactamente el mismo shape que las fixed pairs:

```js
// Temp pair — construida al confirmar la ronda
{
  id:         `tmp_${playerA.id}_${playerB.id}`,  // efímero
  p1:          playerA.name,
  p2:          playerB.name,
  pts:         Math.round((playerA.pts + playerB.pts) / 2),
  gf:          0,
  gc:          0,
  courtLevel:  Math.round((playerA.courtLevel + playerB.courtLevel) / 2),
}
```

El `courtLevel` inicial de la pareja temporal es el **promedio** de los courtLevels individuales.

---

## 8. Persistencia al confirmar (dos escrituras)

Al confirmar una ronda en cualquier modo:

1. **Subcolección** — `setDoc(doc(db, "torneos", code, "matches", matchId), matchDoc)` por cada cancha.
2. **Documento principal** — `setDoc(doc(db, "torneos", code), { data: JSON.stringify(newT) }, { merge: true })` con `pairs[]` o `players[]` actualizados y `currentPozoRound` nuevo.

Ambas escrituras ocurren en el handler `onNextRound` (o su equivalente en Mixer). No se usa batch write por ahora — si una falla, el organizador puede reintentar.

---

## 9. Carga lazy de stats

`calculateStats` se invoca solo cuando el usuario abre la pestaña "Stats":

```js
// En el componente PlayPozo
const [matches, setMatches] = useState(null);

async function loadStats() {
  if (matches !== null) return;  // ya cargado
  const snap = await getDocs(collection(db, "torneos", code, "matches"));
  setMatches(snap.docs.map(d => d.data()));
}

// Al cambiar a tab "stats":
useEffect(() => { if (tab === "stats") loadStats(); }, [tab]);
```

---

## 10. Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/logic/pozo.js` | Agregar `shufflePlayers`, `distributePairLevelToPlayers`, `isProposedRoundValid` |
| `src/logic/stats.js` | Crear — exporta `calculateStats` |
| `src/logic/initTournament.js` | Agregar `pozoMode: "fixed"` al default de Pozo |
| `src/components/setup/SetupPairs.jsx` | Renderizar inputs individuales cuando `pozoMode === "mixer"` |
| `src/components/play/PlayPozo.jsx` | Agregar flujo proposedRound + tab Stats + carga lazy |
| `src/logic/pozo.test.js` | Agregar tests para las 3 funciones nuevas de pozo.js |
| `src/logic/stats.test.js` | Crear — tests para `calculateStats` |

---

## 11. Fuera de scope (este spec)

- UI de drag & drop para reasignar jugadores en `proposedRound` (diseño visual separado)
- Batch writes / transacciones Firestore
- Firestore security rules para la subcolección `matches/`
- Paginación del historial de matches
- `pozoMode` mixto (cambiar de fixed a mixer a mitad de torneo)
