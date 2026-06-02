# El Pozo — Mixer + Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender El Pozo con Modo Mixer (parejas temporales por ronda), subcolección `matches/` en Firestore para historial, y `calculateStats` lazy por jugador.

**Architecture:** Las funciones de lógica pura (`calculateStats`, `shufflePlayers`, `distributePairLevelToPlayers`, `isProposedRoundValid`) se implementan con TDD antes de tocar UI. `applyPozoRoundResults` no se modifica — el Mixer usa el patrón adaptador con temp pairs del mismo shape que las fixed pairs. Las escrituras a la subcolección ocurren en `onNextRound` de `PlayPozo.jsx` después de que el organizador confirma.

**Tech Stack:** Vitest (tests), Firebase Firestore v12 (`addDoc`, `getDocs`, `collection`, `Timestamp`), React 18, JavaScript ES2022.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/logic/initTournament.js` | Modificar | Agregar `pozoMode: "fixed"` al config de pozo |
| `src/logic/stats.js` | Crear | Exporta `calculateStats(matches) → StatsMap` |
| `src/logic/stats.test.js` | Crear | Tests de `calculateStats` |
| `src/logic/pozo.js` | Modificar | Agregar `shufflePlayers`, `distributePairLevelToPlayers`, `isProposedRoundValid` |
| `src/logic/pozo.test.js` | Modificar | Agregar tests para las 3 funciones nuevas |
| `src/components/play/PlayPozo.jsx` | Modificar | Subcollection write en `onNextRound`, stats tab lazy, mixer round flow |
| `src/components/setup/SetupPairs.jsx` | Modificar | Player inputs individuales cuando `pozoMode === "mixer"` |

---

## Task 0: Crear rama de implementación

- [ ] **Step 1: Crear y cambiar a la rama de feature**

```bash
git checkout main && git pull && git checkout -b feat/pozo-mixer-stats
```

---

## Task 1: Flag `pozoMode` en `initTournament`

**Files:**
- Modify: `src/logic/initTournament.js`

- [ ] **Step 1: Agregar `pozoMode: "fixed"` al config de pozo**

En `src/logic/initTournament.js`, dentro de `inits.pozo`, reemplazar:

```js
pozo: {
  ...base,
  pairInputs: [],
```

por:

```js
pozo: {
  ...base,
  config: { ...base.config, pozoMode: "fixed" },
  pairInputs: [],
```

- [ ] **Step 2: Verificar build limpio**

```bash
npm run build 2>&1 | tail -5
```
Esperado: `✓ built in` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/logic/initTournament.js
git commit -m "feat: agregar flag pozoMode al config inicial de El Pozo"
```

---

## Task 2: `calculateStats` — función pura de estadísticas

**Files:**
- Create: `src/logic/stats.js`
- Create: `src/logic/stats.test.js`

- [ ] **Step 1: Escribir el test (RED)**

Crear `src/logic/stats.test.js`:

```js
import { describe, test, expect } from "vitest";
import { calculateStats } from "./stats.js";

// Helper: construye un match document mínimo válido
const match = (teamAIds, teamBIds, scoreA, scoreB, mode = "fixed") => ({
  roundNum: 1,
  courtNum: 1,
  mode,
  teamA: { playerIds: teamAIds, pairId: null, courtLevelBefore: 0, courtLevelAfter: 0 },
  teamB: { playerIds: teamBIds, pairId: null, courtLevelBefore: 0, courtLevelAfter: 0 },
  result: {
    scoreA,
    scoreB,
    winningSide: scoreA > scoreB ? "A" : "B",
  },
});

describe("calculateStats", () => {
  test("array vacío devuelve objeto vacío", () => {
    expect(calculateStats([])).toEqual({});
  });

  test("ganador acumula gamesWon=1 y perdedor gamesLost=1", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].gamesWon).toBe(1);
    expect(stats["p1"].gamesLost).toBe(0);
    expect(stats["p3"].gamesWon).toBe(0);
    expect(stats["p3"].gamesLost).toBe(1);
  });

  test("pointsFor y pointsAgainst correctos para ambos lados", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].pointsFor).toBe(6);
    expect(stats["p1"].pointsAgainst).toBe(3);
    expect(stats["p3"].pointsFor).toBe(3);
    expect(stats["p3"].pointsAgainst).toBe(6);
  });

  test("pointsDiff es pointsFor - pointsAgainst", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].pointsDiff).toBe(3);
    expect(stats["p3"].pointsDiff).toBe(-3);
  });

  test("winRate es 1.0 tras ganar todos los matches", () => {
    const matches = [
      match(["p1", "p2"], ["p3", "p4"], 6, 3),
      match(["p1", "p2"], ["p5", "p6"], 6, 4),
    ];
    const stats = calculateStats(matches);
    expect(stats["p1"].winRate).toBe(1);
    expect(stats["p1"].matchesPlayed).toBe(2);
  });

  test("winRate es 0.5 con 1 victoria y 1 derrota", () => {
    const matches = [
      match(["p1", "p2"], ["p3", "p4"], 6, 3),
      match(["p3", "p4"], ["p1", "p2"], 6, 4),
    ];
    const stats = calculateStats(matches);
    expect(stats["p1"].gamesWon).toBe(1);
    expect(stats["p1"].gamesLost).toBe(1);
    expect(stats["p1"].matchesPlayed).toBe(2);
    expect(stats["p1"].winRate).toBe(0.5);
  });

  test("ambos jugadores del equipo ganador reciben las mismas stats", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].gamesWon).toBe(stats["p2"].gamesWon);
    expect(stats["p1"].pointsFor).toBe(stats["p2"].pointsFor);
  });

  test("funciona con mode mixer — misma lógica, distintos playerIds", () => {
    const stats = calculateStats([match(["alice", "bob"], ["carol", "dave"], 6, 2, "mixer")]);
    expect(stats["alice"].gamesWon).toBe(1);
    expect(stats["carol"].gamesLost).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar tests para confirmar RED**

```bash
npm test -- stats.test.js 2>&1 | tail -8
```
Esperado: `FAIL` — `calculateStats is not a function`.

- [ ] **Step 3: Implementar `calculateStats`**

Crear `src/logic/stats.js`:

```js
export function calculateStats(matches) {
  const stats = {};

  const ensure = (id) => {
    if (!stats[id]) {
      stats[id] = {
        matchesPlayed: 0,
        gamesWon:      0,
        gamesLost:     0,
        pointsFor:     0,
        pointsAgainst: 0,
        pointsDiff:    0,
        winRate:       0,
      };
    }
    return stats[id];
  };

  for (const m of matches) {
    const { teamA, teamB, result } = m;
    const { scoreA, scoreB, winningSide } = result;
    const winTeam  = winningSide === "A" ? teamA : teamB;
    const loseTeam = winningSide === "A" ? teamB : teamA;
    const winScore  = winningSide === "A" ? scoreA : scoreB;
    const loseScore = winningSide === "A" ? scoreB : scoreA;

    for (const id of winTeam.playerIds) {
      const s = ensure(id);
      s.matchesPlayed++;
      s.gamesWon++;
      s.pointsFor     += winScore;
      s.pointsAgainst += loseScore;
    }

    for (const id of loseTeam.playerIds) {
      const s = ensure(id);
      s.matchesPlayed++;
      s.gamesLost++;
      s.pointsFor     += loseScore;
      s.pointsAgainst += winScore;
    }
  }

  for (const s of Object.values(stats)) {
    s.pointsDiff = s.pointsFor - s.pointsAgainst;
    s.winRate    = s.matchesPlayed > 0 ? s.gamesWon / s.matchesPlayed : 0;
  }

  return stats;
}
```

- [ ] **Step 4: Ejecutar tests para confirmar GREEN**

```bash
npm test -- stats.test.js 2>&1 | tail -8
```
Esperado: `Tests  7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/logic/stats.js src/logic/stats.test.js
git commit -m "feat: agregar calculateStats con tests (PZO-09)"
```

---

## Task 3: `isProposedRoundValid` en `pozo.js`

**Files:**
- Modify: `src/logic/pozo.js`
- Modify: `src/logic/pozo.test.js`

- [ ] **Step 1: Actualizar el import en la primera línea de `src/logic/pozo.test.js`**

```js
import { buildPozoRound, applyPozoRoundResults, isProposedRoundValid } from "./pozo.js";
```

- [ ] **Step 2: Agregar los tests al final de `src/logic/pozo.test.js`**

```js
// ── Helpers ───────────────────────────────────────────────────
const mkProposedRound = (courts, unassigned = []) => ({ courts, unassigned });
const mkProposedCourt = (num, aIds, bIds) => ({
  courtNum: num,
  teamA: { playerIds: aIds },
  teamB: { playerIds: bIds },
});

// ═══════════════════════════════════════════════════════════════
// isProposedRoundValid
// ═══════════════════════════════════════════════════════════════
describe("isProposedRoundValid", () => {
  test("válido: 1 cancha completa y unassigned vacío", () => {
    const round = mkProposedRound([mkProposedCourt(1, ["p1","p2"], ["p3","p4"])]);
    expect(isProposedRoundValid(round)).toBe(true);
  });

  test("inválido: hay jugadores en unassigned", () => {
    const round = mkProposedRound([mkProposedCourt(1, ["p1","p2"], ["p3","p4"])], ["p5"]);
    expect(isProposedRoundValid(round)).toBe(false);
  });

  test("inválido: cancha con menos de 4 jugadores", () => {
    const round = mkProposedRound([mkProposedCourt(1, ["p1","p2"], ["p3"])]);
    expect(isProposedRoundValid(round)).toBe(false);
  });

  test("inválido: jugador duplicado dentro de la misma cancha", () => {
    const round = mkProposedRound([mkProposedCourt(1, ["p1","p1"], ["p3","p4"])]);
    expect(isProposedRoundValid(round)).toBe(false);
  });

  test("inválido: jugador en dos canchas distintas", () => {
    const round = mkProposedRound([
      mkProposedCourt(1, ["p1","p2"], ["p3","p4"]),
      mkProposedCourt(2, ["p1","p5"], ["p6","p7"]),
    ]);
    expect(isProposedRoundValid(round)).toBe(false);
  });

  test("válido: 2 canchas completas sin repetidos", () => {
    const round = mkProposedRound([
      mkProposedCourt(1, ["p1","p2"], ["p3","p4"]),
      mkProposedCourt(2, ["p5","p6"], ["p7","p8"]),
    ]);
    expect(isProposedRoundValid(round)).toBe(true);
  });
});
```

- [ ] **Step 3: Ejecutar tests para confirmar RED**

```bash
npm test -- pozo.test.js 2>&1 | tail -8
```
Esperado: `FAIL` — `isProposedRoundValid is not a function`.

- [ ] **Step 4: Implementar `isProposedRoundValid`**

Agregar al final de `src/logic/pozo.js`:

```js
export function isProposedRoundValid(proposedRound) {
  if (proposedRound.unassigned.length > 0) return false;
  const seen = new Set();
  for (const court of proposedRound.courts) {
    const ids = [...court.teamA.playerIds, ...court.teamB.playerIds];
    if (ids.length !== 4) return false;
    for (const id of ids) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  return true;
}
```

- [ ] **Step 5: Ejecutar tests para confirmar GREEN**

```bash
npm test -- pozo.test.js 2>&1 | tail -8
```
Esperado: todos los tests de `pozo.test.js` pasan (los 17 anteriores + 6 nuevos = 23).

- [ ] **Step 6: Commit**

```bash
git add src/logic/pozo.js src/logic/pozo.test.js
git commit -m "feat: agregar isProposedRoundValid con tests"
```

---

## Task 4: `shufflePlayers` en `pozo.js`

**Files:**
- Modify: `src/logic/pozo.js`
- Modify: `src/logic/pozo.test.js`

- [ ] **Step 1: Actualizar el import en la primera línea de `src/logic/pozo.test.js`**

```js
import { buildPozoRound, applyPozoRoundResults, isProposedRoundValid, shufflePlayers } from "./pozo.js";
```

- [ ] **Step 2: Agregar los tests al final de `src/logic/pozo.test.js`**

```js
// ── Helper ────────────────────────────────────────────────────
const playerM = (id, pts = 0, courtLevel = 0) => ({
  id, name: `P${id}`, pts, gf: 0, gc: 0, courtLevel,
});

// ═══════════════════════════════════════════════════════════════
// shufflePlayers
// ═══════════════════════════════════════════════════════════════
describe("shufflePlayers", () => {
  test("genera 1 cancha con 4 jugadores exactos", () => {
    const players = [playerM("A",0,3), playerM("B",0,2), playerM("C",0,1), playerM("D",0,0)];
    const result = shufflePlayers(players, 1);
    expect(result.courts).toHaveLength(1);
    expect(result.unassigned).toHaveLength(0);
  });

  test("teamA recibe los 2 jugadores de mayor courtLevel del grupo", () => {
    const players = [playerM("A",0,3), playerM("B",0,2), playerM("C",0,1), playerM("D",0,0)];
    const result = shufflePlayers(players, 1);
    expect(result.courts[0].teamA.playerIds).toEqual(["A", "B"]);
    expect(result.courts[0].teamB.playerIds).toEqual(["C", "D"]);
  });

  test("con 5 jugadores y 1 cancha, el de menor courtLevel queda en unassigned", () => {
    const players = [playerM("A",0,4), playerM("B",0,3), playerM("C",0,2), playerM("D",0,1), playerM("E",0,0)];
    const result = shufflePlayers(players, 1);
    expect(result.courts).toHaveLength(1);
    expect(result.unassigned).toEqual(["E"]);
  });

  test("con 8 jugadores y 2 canchas, llena ambas canchas sin unassigned", () => {
    const players = Array.from({ length: 8 }, (_, i) => playerM(String(i), 0, 7 - i));
    const result = shufflePlayers(players, 2);
    expect(result.courts).toHaveLength(2);
    expect(result.unassigned).toHaveLength(0);
  });

  test("la cancha 1 contiene los jugadores de mayor courtLevel", () => {
    // sorted desc: "0"(cl=7), "1"(cl=6), "2"(cl=5), "3"(cl=4) → cancha 1
    const players = Array.from({ length: 8 }, (_, i) => playerM(String(i), 0, 7 - i));
    const result = shufflePlayers(players, 2);
    const c1Ids = [...result.courts[0].teamA.playerIds, ...result.courts[0].teamB.playerIds];
    expect(c1Ids).toContain("0");
    expect(c1Ids).toContain("1");
  });

  test("con menos de 4 jugadores no genera canchas", () => {
    const players = [playerM("A"), playerM("B"), playerM("C")];
    const result = shufflePlayers(players, 1);
    expect(result.courts).toHaveLength(0);
    expect(result.unassigned).toHaveLength(3);
  });

  test("el output tiene la forma correcta de ProposedRound", () => {
    const players = [playerM("A",0,3), playerM("B",0,2), playerM("C",0,1), playerM("D",0,0)];
    const result = shufflePlayers(players, 1);
    expect(result.courts[0]).toMatchObject({
      courtNum: 1,
      teamA: { playerIds: expect.any(Array) },
      teamB: { playerIds: expect.any(Array) },
    });
  });
});
```

- [ ] **Step 3: Ejecutar tests para confirmar RED**

```bash
npm test -- pozo.test.js 2>&1 | tail -8
```
Esperado: `FAIL` — `shufflePlayers is not a function`.

- [ ] **Step 4: Implementar `shufflePlayers`**

Agregar al final de `src/logic/pozo.js`:

```js
export function shufflePlayers(players, numCourts) {
  const sorted = [...players].sort(
    (a, b) => b.pts - a.pts || b.courtLevel - a.courtLevel,
  );
  const activeCourts = Math.min(numCourts, Math.floor(sorted.length / 4));
  const active       = sorted.slice(0, activeCourts * 4);
  const unassigned   = sorted.slice(activeCourts * 4).map((p) => p.id);

  const courts = [];
  for (let c = 0; c < activeCourts; c++) {
    const group = active.slice(c * 4, c * 4 + 4);
    courts.push({
      courtNum: c + 1,
      teamA: { playerIds: [group[0].id, group[1].id] },
      teamB: { playerIds: [group[2].id, group[3].id] },
    });
  }

  return { courts, unassigned };
}
```

- [ ] **Step 5: Ejecutar tests para confirmar GREEN**

```bash
npm test -- pozo.test.js 2>&1 | tail -8
```
Esperado: todos los tests pasan (23 anteriores + 7 nuevos = 30).

- [ ] **Step 6: Commit**

```bash
git add src/logic/pozo.js src/logic/pozo.test.js
git commit -m "feat: agregar shufflePlayers con tests (Mixer mode)"
```

---

## Task 5: `distributePairLevelToPlayers` en `pozo.js`

**Files:**
- Modify: `src/logic/pozo.js`
- Modify: `src/logic/pozo.test.js`

Esta función recibe las temp pairs actualizadas por `applyPozoRoundResults` y la ronda confirmada, y distribuye `courtLevel`, `pts`, `gf`, `gc` a los jugadores individuales.

Las temp pairs deben tener un campo `_playerIds: [string, string]` con los IDs de los dos jugadores que la forman (ver construcción en Task 9).

- [ ] **Step 1: Actualizar el import en la primera línea de `src/logic/pozo.test.js`**

```js
import {
  buildPozoRound, applyPozoRoundResults,
  isProposedRoundValid, shufflePlayers,
  distributePairLevelToPlayers,
} from "./pozo.js";
```

- [ ] **Step 2: Agregar los tests al final de `src/logic/pozo.test.js`**

```js
// ── Helper ────────────────────────────────────────────────────
const playerD = (id, pts = 0, cl = 0, gf = 0, gc = 0) => ({
  id, name: `P${id}`, pts, gf, gc, courtLevel: cl,
});

// Construye una temp pair con el campo _playerIds requerido
const tempPair = (pAId, pBId, cl, pts = 0, gf = 0, gc = 0) => ({
  id: `tmp_${pAId}_${pBId}`,
  _playerIds: [pAId, pBId],
  p1: pAId, p2: pBId,
  pts, gf, gc, courtLevel: cl,
});

// Construye una entrada de ronda guardada (formato currentPozoRound)
const savedCourt = (num, pairA, pairB, scoreA, scoreB) => ({
  courtNum: num,
  pairA,
  pairB,
  scoreA: String(scoreA),
  scoreB: String(scoreB),
  saved: true,
});

// ═══════════════════════════════════════════════════════════════
// distributePairLevelToPlayers
// ═══════════════════════════════════════════════════════════════
describe("distributePairLevelToPlayers", () => {
  test("ambos jugadores del equipo ganador reciben el courtLevel del temp pair ganador", () => {
    const players = [playerD("p1",0,0), playerD("p2",0,0), playerD("p3",0,0), playerD("p4",0,0)];
    const tpWinner = tempPair("p1","p2", 3, 1, 6, 3); // ya procesado por applyPozoRoundResults
    const tpLoser  = tempPair("p3","p4", 1, 0, 3, 6);
    const round    = [savedCourt(1, tpWinner, tpLoser, 6, 3)];

    const updated = distributePairLevelToPlayers([tpWinner, tpLoser], players, round);

    expect(updated.find((p) => p.id === "p1").courtLevel).toBe(3);
    expect(updated.find((p) => p.id === "p2").courtLevel).toBe(3);
    expect(updated.find((p) => p.id === "p3").courtLevel).toBe(1);
    expect(updated.find((p) => p.id === "p4").courtLevel).toBe(1);
  });

  test("el equipo ganador recibe +1 punto por jugador", () => {
    const players = [playerD("p1"), playerD("p2"), playerD("p3"), playerD("p4")];
    const tpWinner = tempPair("p1","p2", 3, 1, 6, 3);
    const tpLoser  = tempPair("p3","p4", 1, 0, 3, 6);
    const round    = [savedCourt(1, tpWinner, tpLoser, 6, 3)];

    const updated = distributePairLevelToPlayers([tpWinner, tpLoser], players, round);

    expect(updated.find((p) => p.id === "p1").pts).toBe(1);
    expect(updated.find((p) => p.id === "p2").pts).toBe(1);
    expect(updated.find((p) => p.id === "p3").pts).toBe(0);
    expect(updated.find((p) => p.id === "p4").pts).toBe(0);
  });

  test("gf y gc se acumulan sobre valores existentes", () => {
    const players = [playerD("p1",1,0,3,2), playerD("p2",1,0,3,2), playerD("p3",0,0,2,3), playerD("p4",0,0,2,3)];
    const tpWinner = tempPair("p1","p2", 3, 2, 9, 5); // pts/gf/gc ya acumulados por applyPozoRoundResults
    const tpLoser  = tempPair("p3","p4", 1, 0, 5, 9);
    const round    = [savedCourt(1, tpWinner, tpLoser, 6, 3)];

    const updated = distributePairLevelToPlayers([tpWinner, tpLoser], players, round);

    // p1 tenía pts=1, gana esta → pts=2; gf: era 3, ganó 6 → 9; gc: era 2, perdió 3 → 5
    expect(updated.find((p) => p.id === "p1").pts).toBe(2);
    expect(updated.find((p) => p.id === "p1").gf).toBe(9);
    expect(updated.find((p) => p.id === "p1").gc).toBe(5);
  });

  test("no muta el array original de jugadores", () => {
    const players = [playerD("p1"), playerD("p2"), playerD("p3"), playerD("p4")];
    const snap = players.map((p) => ({ ...p }));
    const tpWinner = tempPair("p1","p2", 3, 1, 6, 3);
    const tpLoser  = tempPair("p3","p4", 1, 0, 3, 6);
    const round    = [savedCourt(1, tpWinner, tpLoser, 6, 3)];

    distributePairLevelToPlayers([tpWinner, tpLoser], players, round);

    expect(players).toEqual(snap);
  });

  test("jugadores que no jugaron (unassigned) conservan sus stats intactas", () => {
    const players = [
      playerD("p1"), playerD("p2"), playerD("p3"), playerD("p4"),
      playerD("p5", 2, 1), // no jugó esta ronda
    ];
    const tpWinner = tempPair("p1","p2", 3, 1, 6, 3);
    const tpLoser  = tempPair("p3","p4", 1, 0, 3, 6);
    const round    = [savedCourt(1, tpWinner, tpLoser, 6, 3)];

    const updated = distributePairLevelToPlayers([tpWinner, tpLoser], players, round);

    const p5 = updated.find((p) => p.id === "p5");
    expect(p5.pts).toBe(2);
    expect(p5.courtLevel).toBe(1);
  });
});
```

- [ ] **Step 3: Ejecutar tests para confirmar RED**

```bash
npm test -- pozo.test.js 2>&1 | tail -8
```
Esperado: `FAIL` — `distributePairLevelToPlayers is not a function`.

- [ ] **Step 4: Implementar `distributePairLevelToPlayers`**

Agregar al final de `src/logic/pozo.js`:

```js
// updatedTempPairs: resultado de applyPozoRoundResults sobre temp pairs.
// Cada temp pair debe tener _playerIds: [string, string].
// currentRound: array de canchas en formato { pairA, pairB, scoreA, scoreB }.
export function distributePairLevelToPlayers(updatedTempPairs, players, currentRound) {
  const updated = players.map((p) => ({ ...p }));

  for (const court of currentRound) {
    const a = parseInt(court.scoreA);
    const b = parseInt(court.scoreB);
    const winnerTempId = a > b ? court.pairA.id : court.pairB.id;
    const loserTempId  = a > b ? court.pairB.id : court.pairA.id;
    const winScore  = Math.max(a, b);
    const loseScore = Math.min(a, b);

    const winner = updatedTempPairs.find((p) => p.id === winnerTempId);
    const loser  = updatedTempPairs.find((p) => p.id === loserTempId);

    if (winner) {
      for (const playerId of winner._playerIds) {
        const idx = updated.findIndex((p) => p.id === playerId);
        if (idx < 0) continue;
        updated[idx] = {
          ...updated[idx],
          pts:        updated[idx].pts + 1,
          gf:         updated[idx].gf + winScore,
          gc:         updated[idx].gc + loseScore,
          courtLevel: winner.courtLevel,
        };
      }
    }

    if (loser) {
      for (const playerId of loser._playerIds) {
        const idx = updated.findIndex((p) => p.id === playerId);
        if (idx < 0) continue;
        updated[idx] = {
          ...updated[idx],
          gf:         updated[idx].gf + loseScore,
          gc:         updated[idx].gc + winScore,
          courtLevel: loser.courtLevel,
        };
      }
    }
  }

  return updated;
}
```

- [ ] **Step 5: Ejecutar la suite completa para confirmar GREEN**

```bash
npm test 2>&1 | tail -8
```
Esperado: todos los tests pasan (stats.test.js + pozo.test.js).

- [ ] **Step 6: Commit**

```bash
git add src/logic/pozo.js src/logic/pozo.test.js
git commit -m "feat: agregar distributePairLevelToPlayers con tests (Mixer mode)"
```

---

## Task 6: Escribir matches a la subcolección al confirmar ronda (modo fixed)

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

Agrega las escrituras a `torneos/{code}/matches/` en el `onNextRound` existente. El parámetro `code` ya llega como prop.

- [ ] **Step 1: Agregar imports de Firestore en `PlayPozo.jsx`**

Al inicio de `src/components/play/PlayPozo.jsx`, agregar a los imports existentes:

```js
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
```

- [ ] **Step 2: Reemplazar `onNextRound` con la versión que escribe a la subcolección**

Localizar la función `onNextRound` (línea ~87) y reemplazarla completa:

```js
async function onNextRound() {
  if (!t.currentPozoRound.every((c) => c.saved)) return;

  const updatedPairs = applyPozoRoundResults(t.pairs, t.currentPozoRound, t.config.courts);
  const newRound     = buildPozoRound(updatedPairs, t.config.courts);

  // Escribir historial de matches a la subcolección
  const matchesRef = collection(db, "torneos", code, "matches");
  await Promise.all(
    t.currentPozoRound.map((court) => {
      const a    = parseInt(court.scoreA);
      const b    = parseInt(court.scoreB);
      const side = a > b ? "A" : "B";

      const pairABefore  = t.pairs.find((p) => p.id === court.pairA.id);
      const pairBBefore  = t.pairs.find((p) => p.id === court.pairB.id);
      const pairAAfter   = updatedPairs.find((p) => p.id === court.pairA.id);
      const pairBAfter   = updatedPairs.find((p) => p.id === court.pairB.id);

      return addDoc(matchesRef, {
        roundNum:    t.roundNum,
        courtNum:    court.courtNum,
        confirmedAt: Timestamp.now(),
        mode:        "fixed",
        teamA: {
          playerIds:        [pairABefore.p1, pairABefore.p2],
          pairId:           String(pairABefore.id),
          courtLevelBefore: pairABefore.courtLevel,
          courtLevelAfter:  pairAAfter.courtLevel,
        },
        teamB: {
          playerIds:        [pairBBefore.p1, pairBBefore.p2],
          pairId:           String(pairBBefore.id),
          courtLevelBefore: pairBBefore.courtLevel,
          courtLevelAfter:  pairBAfter.courtLevel,
        },
        result: {
          scoreA:      a,
          scoreB:      b,
          winningSide: side,
        },
      });
    }),
  );

  const savedRounds = [
    ...(t.pozoRounds || []),
    { num: t.roundNum, courts: t.currentPozoRound },
  ];
  setLs({});
  await persist({
    ...t,
    pairs:            updatedPairs,
    currentPozoRound: newRound,
    pozoRounds:       savedRounds,
    roundNum:         t.roundNum + 1,
    timerRunning:     false,
    timerElapsed:     0,
    timerStartedAt:   null,
  });
}
```

- [ ] **Step 3: Verificar build limpio**

```bash
npm run build 2>&1 | tail -5
```
Esperado: `✓ built in` sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/play/PlayPozo.jsx
git commit -m "feat: persistir matches en subcolección Firestore al confirmar ronda (fixed)"
```

---

## Task 7: Tab Stats con carga lazy desde la subcolección

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

- [ ] **Step 1: Agregar import de `calculateStats` y `getDocs`**

En `PlayPozo.jsx`, agregar a los imports existentes:

```js
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { calculateStats } from "../../logic/stats";
```

(Reemplaza el import anterior de `firebase/firestore` que solo tenía `collection, addDoc, Timestamp`.)

- [ ] **Step 2: Agregar estado y función de carga lazy**

Dentro del componente `PlayPozo`, después de los `useState` existentes (línea ~12), agregar:

```js
const [matches, setMatches] = useState(null); // null = no cargado aún

async function loadStats() {
  if (matches !== null) return;
  try {
    const snap = await getDocs(collection(db, "torneos", code, "matches"));
    setMatches(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Error al cargar historial de matches:", err);
    setMatches([]);
  }
}
```

- [ ] **Step 3: Disparar carga al cambiar a la pestaña stats**

Localizar el `useEffect` de timer (línea ~13) y agregar después un nuevo efecto:

```js
useEffect(() => {
  if (tab === "stats") loadStats();
}, [tab]);
```

- [ ] **Step 4: Agregar la pestaña "stats" al componente `Tabs`**

Localizar el array de tabs (línea ~157) y agregar la entrada de stats:

```js
tabs={[
  ["courts",    "⚔️ Pistas"],
  ["standings", "🏆 Clasificación"],
  ["history",   "📜 Historial"],
  ["stats",     "📊 Stats"],
  ["rules",     "📖 Reglas"],
]}
```

- [ ] **Step 5: Agregar el bloque de render para la pestaña stats**

Localizar el bloque `{tab === "rules" && ...}` y agregar antes:

```js
{tab === "stats" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {matches === null && (
      <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
        Cargando stats...
      </div>
    )}
    {matches !== null && matches.length === 0 && (
      <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
        Aún no hay matches completados.
      </div>
    )}
    {matches !== null && matches.length > 0 &&
      Object.entries(calculateStats(matches))
        .sort(([, a], [, b]) => b.winRate - a.winRate || b.gamesWon - a.gamesWon)
        .map(([id, s]) => (
          <div
            key={id}
            style={{
              background:   "#1e293b",
              borderRadius: 12,
              padding:      16,
            }}
          >
            <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              {id}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#94a3b8" }}>
              <span>🏆 {s.gamesWon}V / {s.gamesLost}D</span>
              <span>⚡ {(s.winRate * 100).toFixed(0)}%</span>
              <span>🎯 {s.pointsDiff > 0 ? "+" : ""}{s.pointsDiff}</span>
              <span>🎾 {s.matchesPlayed} partidos</span>
            </div>
          </div>
        ))
    }
  </div>
)}
```

- [ ] **Step 6: Verificar build limpio**

```bash
npm run build 2>&1 | tail -5
```
Esperado: `✓ built in` sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/play/PlayPozo.jsx
git commit -m "feat: tab Stats con carga lazy desde subcolección matches (PZO-09)"
```

---

## Task 8: SetupPairs — inputs individuales para Modo Mixer

**Files:**
- Modify: `src/components/setup/SetupPairs.jsx`

Cuando `t.config.pozoMode === "mixer"`, el formulario de setup muestra inputs de jugadores individuales en lugar de parejas. Los jugadores se guardan en `t.playerInputs[]` en lugar de `t.pairInputs[]`.

- [ ] **Step 1: Agregar toggle de modo en el bloque de config de SetupPairs**

En `SetupPairs.jsx`, localizar el bloque de `SectionHeader` que muestra "Parejas" (aproximadamente donde se listan las pairInputs). Agregar antes del listado de parejas el selector de modo — solo visible para torneos de tipo `pozo`:

```js
{t.type === "pozo" && (
  <div style={{ marginBottom: 16 }}>
    <SectionHeader>Modo de juego</SectionHeader>
    <div style={{ display: "flex", gap: 8 }}>
      {[
        { id: "fixed", label: "Parejas fijas" },
        { id: "mixer", label: "Mixer (individual)" },
      ].map(({ id, label }) => (
        <button
          key={id}
          onClick={() =>
            persist({
              ...t,
              config:       { ...t.config, pozoMode: id },
              pairInputs:   [],
              playerInputs: [],
            })
          }
          style={{
            padding:      "6px 14px",
            borderRadius: 8,
            border:       `2px solid ${t.config.pozoMode === id ? color : "#334155"}`,
            background:   t.config.pozoMode === id ? `${color}22` : "transparent",
            color:        t.config.pozoMode === id ? color : "#64748b",
            fontWeight:   700,
            cursor:       "pointer",
            fontSize:     13,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Agregar estado local para el input de jugador individual**

Dentro del componente, después de `const [newP2, setNewP2] = useState("")`:

```js
const [newPlayer, setNewPlayer] = useState("");
```

- [ ] **Step 3: Agregar la función para agregar jugadores individuales**

Después de `function addPair()`:

```js
function addPlayer() {
  if (!newPlayer.trim()) return;
  persist({
    ...t,
    playerInputs: [
      ...(t.playerInputs || []),
      { id: (t.playerInputs || []).length, name: newPlayer.trim() },
    ],
  });
  setNewPlayer("");
}
```

- [ ] **Step 4: Reemplazar el bloque de "Agregar pareja" con condicional por modo**

Localizar el bloque donde se renderizan los inputs de `newP1`/`newP2` y envolver con condicional:

```js
{/* Input de pareja fija — solo fixed mode */}
{(t.config.pozoMode !== "mixer") && (
  <>
    {/* ...bloque existente de inputs newP1/newP2 y botón Agregar Pareja... */}
  </>
)}

{/* Input de jugador individual — solo mixer mode */}
{t.config.pozoMode === "mixer" && (
  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
    <input
      className="flex-1 bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]"
      placeholder="Nombre del jugador"
      value={newPlayer}
      onChange={(e) => setNewPlayer(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
    />
    <button
      onClick={addPlayer}
      disabled={!newPlayer.trim()}
      className="px-4 py-3 rounded-xl font-bold text-sm"
      style={{
        background: newPlayer.trim() ? color : "#334155",
        color:      newPlayer.trim() ? "#fff" : "#64748b",
        cursor:     newPlayer.trim() ? "pointer" : "not-allowed",
      }}
    >
      + Agregar
    </button>
  </div>
)}
```

- [ ] **Step 5: Mostrar lista de jugadores individuales en mixer mode**

Después del bloque de input de jugador, agregar la lista:

```js
{t.config.pozoMode === "mixer" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
    {(t.playerInputs || []).map((player, idx) => (
      <div
        key={player.id}
        style={{
          display:        "flex",
          alignItems:     "center",
          background:     "#0f172a",
          border:         "1px solid #334155",
          borderRadius:   10,
          padding:        "10px 14px",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "#f1f5f9", fontSize: 14 }}>
          {idx + 1}. {player.name}
        </span>
        <button
          onClick={() =>
            persist({
              ...t,
              playerInputs: t.playerInputs.filter((_, i) => i !== idx),
            })
          }
          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 6: Actualizar `onStart` para modo mixer**

Localizar `async function onStart()` y agregar el caso mixer:

```js
} else if (t.type === "pozo") {
  if (t.config.pozoMode === "mixer") {
    // Mixer: inicializar players[] con courtLevel por índice (mayor índice = mejor)
    const playersToStart = (t.playerInputs || []).map((p, i) => ({
      ...p,
      courtLevel: i,
      pts: 0, gf: 0, gc: 0,
    }));
    const proposed = shufflePlayers(playersToStart, t.config.courts);
    await persist({
      ...t,
      config:           finalConfig,
      players:          playersToStart,
      proposedRound:    proposed,
      currentPozoRound: null,
      pozoRounds:       [],
      roundNum:         1,
      phase:            "playing",
      status:           "playing",
      timerRunning:     false,
      timerElapsed:     0,
      timerStartedAt:   null,
    });
  } else {
    // Fixed (código existente)
    const sorted       = shuffle(pairsToStart);
    const courtAssign  = buildPozoRound(sorted.map((p, i) => ({ ...p, courtLevel: i })), t.config.courts);
    await persist({
      ...t,
      config:           finalConfig,
      pairs:            sorted.map((p, i) => ({ ...p, courtLevel: i })),
      currentPozoRound: courtAssign,
      pozoRounds:       [],
      roundNum:         1,
      phase:            "playing",
      status:           "playing",
      timerRunning:     false,
      timerElapsed:     0,
      timerStartedAt:   null,
    });
  }
}
```

Agregar el import necesario al inicio de `SetupPairs.jsx`:

```js
import { buildPozoRound, shufflePlayers } from "../../logic/pozo";
```

- [ ] **Step 7: Verificar build limpio**

```bash
npm run build 2>&1 | tail -5
```
Esperado: `✓ built in` sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/components/setup/SetupPairs.jsx
git commit -m "feat: inputs de jugadores individuales en SetupPairs para Modo Mixer"
```

---

## Task 9: PlayPozo — flujo de ronda Mixer con `proposedRound`

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

Este task integra el flujo completo de Mixer en `PlayPozo`: muestra `proposedRound` para que el organizador edite, y al confirmar construye temp pairs, aplica resultados y escribe a Firebase.

- [ ] **Step 1: Agregar imports de las nuevas funciones de pozo**

En `PlayPozo.jsx`, actualizar el import de `pozo`:

```js
import {
  buildPozoRound,
  applyPozoRoundResults,
  shufflePlayers,
  distributePairLevelToPlayers,
  isProposedRoundValid,
} from "../../logic/pozo";
```

- [ ] **Step 2: Agregar estado local para `proposedRound` en el componente**

Dentro del componente, después del `useState` de `matches`:

```js
const [proposedRound, setProposedRound] = useState(null);
```

- [ ] **Step 3: Inicializar `proposedRound` desde el estado del torneo al montar**

Agregar un efecto que sincroniza `proposedRound` local con `t.proposedRound` cuando el torneo está en modo mixer y aún no hay `currentPozoRound`:

```js
useEffect(() => {
  if (t.config?.pozoMode === "mixer" && t.proposedRound && !t.currentPozoRound) {
    setProposedRound(t.proposedRound);
  }
}, [t.proposedRound, t.currentPozoRound, t.config?.pozoMode]);
```

- [ ] **Step 4: Función helper para construir temp pairs desde `proposedRound`**

Agregar dentro del componente (antes de los handlers existentes):

```js
function buildTempPairs(proposed) {
  const playerMap = Object.fromEntries((t.players || []).map((p) => [p.id, p]));
  return proposed.courts.flatMap((court) => {
    const [pA1, pA2] = court.teamA.playerIds.map((id) => playerMap[id]);
    const [pB1, pB2] = court.teamB.playerIds.map((id) => playerMap[id]);
    return [
      {
        id:          `tmp_${pA1.id}_${pA2.id}`,
        _playerIds:  [pA1.id, pA2.id],
        p1:          pA1.name,
        p2:          pA2.name,
        pts:         Math.round((pA1.pts + pA2.pts) / 2),
        gf:          0,
        gc:          0,
        courtLevel:  Math.round((pA1.courtLevel + pA2.courtLevel) / 2),
      },
      {
        id:          `tmp_${pB1.id}_${pB2.id}`,
        _playerIds:  [pB1.id, pB2.id],
        p1:          pB1.name,
        p2:          pB2.name,
        pts:         Math.round((pB1.pts + pB2.pts) / 2),
        gf:          0,
        gc:          0,
        courtLevel:  Math.round((pB1.courtLevel + pB2.courtLevel) / 2),
      },
    ];
  });
}
```

- [ ] **Step 5: Función `onConfirmMixerRound` — convierte `proposedRound` en `currentPozoRound`**

Agregar el handler para confirmar el emparejamiento del mixer:

```js
async function onConfirmMixerRound() {
  if (!isProposedRoundValid(proposedRound)) return;
  const tempPairs = buildTempPairs(proposedRound);
  // Construir currentPozoRound con temp pairs como pairA/pairB
  const currentRound = proposedRound.courts.map((court, idx) => ({
    courtNum:  court.courtNum,
    pairA:     tempPairs[idx * 2],
    pairB:     tempPairs[idx * 2 + 1],
    scoreA:    "",
    scoreB:    "",
    saved:     false,
  }));
  setProposedRound(null);
  await persist({
    ...t,
    currentPozoRound: currentRound,
    proposedRound:    null,
  });
}
```

- [ ] **Step 6: Función `onNextRoundMixer` — aplica resultados y genera siguiente `proposedRound`**

Agregar junto a `onNextRound`:

```js
async function onNextRoundMixer() {
  if (!t.currentPozoRound.every((c) => c.saved)) return;

  // pairA / pairB ya son temp pairs (construidas en onConfirmMixerRound, con _playerIds)
  const tempPairs      = t.currentPozoRound.flatMap((c) => [c.pairA, c.pairB]);
  const updatedTemps   = applyPozoRoundResults(tempPairs, t.currentPozoRound, t.config.courts);
  const updatedPlayers = distributePairLevelToPlayers(updatedTemps, t.players, t.currentPozoRound);
  const nextProposed = shufflePlayers(updatedPlayers, t.config.courts);

  // Escribir matches a la subcolección
  const matchesRef = collection(db, "torneos", code, "matches");
  await Promise.all(
    t.currentPozoRound.map((court) => {
      const a    = parseInt(court.scoreA);
      const b    = parseInt(court.scoreB);
      const side = a > b ? "A" : "B";
      // court.pairA / court.pairB ya son temp pairs con courtLevel original (before)
      const tpA  = court.pairA;
      const tpB  = court.pairB;
      const utA  = updatedTemps.find((p) => p.id === court.pairA.id);
      const utB  = updatedTemps.find((p) => p.id === court.pairB.id);

      return addDoc(matchesRef, {
        roundNum:    t.roundNum,
        courtNum:    court.courtNum,
        confirmedAt: Timestamp.now(),
        mode:        "mixer",
        teamA: {
          playerIds:        tpA._playerIds,
          pairId:           null,
          courtLevelBefore: tpA.courtLevel,
          courtLevelAfter:  utA.courtLevel,
        },
        teamB: {
          playerIds:        tpB._playerIds,
          pairId:           null,
          courtLevelBefore: tpB.courtLevel,
          courtLevelAfter:  utB.courtLevel,
        },
        result: { scoreA: a, scoreB: b, winningSide: side },
      });
    }),
  );

  const savedRounds = [
    ...(t.pozoRounds || []),
    { num: t.roundNum, courts: t.currentPozoRound },
  ];
  setLs({});
  setProposedRound(nextProposed);
  await persist({
    ...t,
    players:          updatedPlayers,
    currentPozoRound: null,
    proposedRound:    nextProposed,
    pozoRounds:       savedRounds,
    roundNum:         t.roundNum + 1,
    timerRunning:     false,
    timerElapsed:     0,
    timerStartedAt:   null,
  });
}
```

- [ ] **Step 7: Agregar UI del `proposedRound` en la pestaña "courts"**

En el bloque `{tab === "courts" && ...}`, antes de la lista de pistas existente, agregar el bloque de propuesta de emparejamiento para mixer:

```js
{t.config?.pozoMode === "mixer" && proposedRound && !t.currentPozoRound && (
  <div style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
    <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 12 }}>
      Propuesta de emparejamiento — Ronda {t.roundNum}
    </div>
    {proposedRound.courts.map((court) => (
      <div key={court.courtNum} style={{ marginBottom: 12, borderBottom: "1px solid #334155", paddingBottom: 12 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          Pista {court.courtNum}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#f1f5f9" }}>
          <span>
            {court.teamA.playerIds
              .map((id) => (t.players || []).find((p) => p.id === id)?.name || id)
              .join(" / ")}
          </span>
          <span style={{ color: "#64748b" }}>vs</span>
          <span>
            {court.teamB.playerIds
              .map((id) => (t.players || []).find((p) => p.id === id)?.name || id)
              .join(" / ")}
          </span>
        </div>
      </div>
    ))}
    {proposedRound.unassigned.length > 0 && (
      <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 8 }}>
        ⏳ Descansan:{" "}
        {proposedRound.unassigned
          .map((id) => (t.players || []).find((p) => p.id === id)?.name || id)
          .join(", ")}
      </div>
    )}
    {isAdmin && (
      <button
        onClick={onConfirmMixerRound}
        disabled={!isProposedRoundValid(proposedRound)}
        style={{
          marginTop:    16,
          width:        "100%",
          padding:      14,
          borderRadius: 10,
          fontWeight:   700,
          fontSize:     15,
          background:   isProposedRoundValid(proposedRound) ? "#10b981" : "#334155",
          color:        "#fff",
          border:       "none",
          cursor:       isProposedRoundValid(proposedRound) ? "pointer" : "not-allowed",
        }}
      >
        ✓ Confirmar emparejamiento
      </button>
    )}
  </div>
)}
```

- [ ] **Step 8: Conectar `onNextRoundMixer` al botón "Rotar Pistas"**

Localizar el botón `allSaved && isAdmin` (que llama a `onNextRound`):

```js
{allSaved && isAdmin && (
  <button
    onClick={t.config?.pozoMode === "mixer" ? onNextRoundMixer : onNextRound}
    style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}
  >
    Rotar Pistas - Siguiente Ronda ➔
  </button>
)}
```

- [ ] **Step 9: Verificar build limpio**

```bash
npm run build 2>&1 | tail -5
```
Esperado: `✓ built in` sin errores.

- [ ] **Step 10: Ejecutar suite de tests completa**

```bash
npm test 2>&1 | tail -8
```
Esperado: todos los tests pasan.

- [ ] **Step 11: Commit**

```bash
git add src/components/play/PlayPozo.jsx
git commit -m "feat: flujo completo de ronda Mixer en PlayPozo con proposedRound"
```

---

## Task 10: Push y PR

- [ ] **Step 1: Push de la rama**

```bash
git push -u origin feat/pozo-mixer-stats
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create \
  --title "feat: El Pozo — Modo Mixer + Stats (PZO-09)" \
  --body "$(cat <<'EOF'
## Summary
- Subcolección `matches/` en Firestore con historial autosuficiente de cada ronda
- Modo Mixer: jugadores individuales con parejas temporales balanceadas por courtLevel
- `calculateStats` lazy — carga al abrir la pestaña Stats, sin queries extra al montar
- `applyPozoRoundResults` sin modificaciones (patrón adaptador con temp pairs)

## Nuevas funciones puras
- `shufflePlayers(players, numCourts)` — genera ProposedRound
- `distributePairLevelToPlayers(updatedTempPairs, players, currentRound)` — distribuye courtLevel/pts a jugadores
- `isProposedRoundValid(proposedRound)` — validación antes de confirmar
- `calculateStats(matches)` — StatsMap por jugador

## Test plan
- [ ] `npm test` — todos los tests pasan (stats.test.js + pozo.test.js)
- [ ] `npm run build` — sin errores
- [ ] Crear torneo fixed → jugar 2 rondas → verificar que matches aparecen en Firestore
- [ ] Crear torneo mixer → verificar toggle en setup → jugar 1 ronda → verificar Stats tab
- [ ] Verificar backward compat: torneos existentes sin `pozoMode` funcionan como fixed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
