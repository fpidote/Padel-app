import { describe, test, expect } from "vitest";
import { buildPozoRound, applyPozoRoundResults } from "./pozo.js";

// ── Helpers ──────────────────────────────────────────────────
const pair = (id, pts = 0, courtLevel = 0, gf = 0, gc = 0) => ({
  id,
  p1: `${id}a`,
  p2: `${id}b`,
  pts,
  gf,
  gc,
  courtLevel,
});

// Crea una ronda guardada con pares y marcadores ya resueltos
const court = (courtNum, pairA, pairB, scoreA, scoreB) => ({
  courtNum,
  pairA,
  pairB,
  scoreA: String(scoreA),
  scoreB: String(scoreB),
  saved: true,
});

// ═══════════════════════════════════════════════════════════════
// buildPozoRound — asignación de parejas a canchas
// ═══════════════════════════════════════════════════════════════
describe("buildPozoRound — asignación inicial", () => {
  test("genera exactamente N canchas con 2N parejas", () => {
    const pairs = Array.from({ length: 6 }, (_, i) => pair(i, 0, i));
    const round = buildPozoRound(pairs, 3);
    expect(round).toHaveLength(3);
  });

  test("la pareja con mayor courtLevel ocupa la cancha 1 (posición pairA)", () => {
    const pairs = [
      pair("A", 0, 10),
      pair("B", 0, 8),
      pair("C", 0, 6),
      pair("D", 0, 4),
    ];
    const round = buildPozoRound(pairs, 2);
    expect(round[0].courtNum).toBe(1);
    expect(round[0].pairA.id).toBe("A");
    expect(round[0].pairB.id).toBe("B");
  });

  test("con 7 parejas y 3 canchas solo 6 juegan (la peor espera fuera)", () => {
    const pairs = Array.from({ length: 7 }, (_, i) => pair(i, 0, i));
    const round = buildPozoRound(pairs, 3);
    const assignedIds = round.flatMap((c) => [c.pairA?.id, c.pairB?.id]).filter(Boolean);
    expect(round).toHaveLength(3);
    expect(assignedIds).toHaveLength(6);
  });

  test("el schema de cada cancha tiene pairA, pairB, scoreA vacío y saved=false", () => {
    const pairs = [pair("X", 0, 1), pair("Y", 0, 0)];
    const [c] = buildPozoRound(pairs, 1);
    expect(c).toMatchObject({
      courtNum: 1,
      scoreA: "",
      scoreB: "",
      saved: false,
    });
    expect(c.pairA).toBeDefined();
    expect(c.pairB).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// applyPozoRoundResults — puntos y goles
// ═══════════════════════════════════════════════════════════════
describe("applyPozoRoundResults — puntos y goles", () => {
  test("el ganador acumula 1 punto y el perdedor no", () => {
    const pairs = [pair("A", 0, 2), pair("B", 0, 1)];
    const round = [court(1, pairs[0], pairs[1], 6, 3)];
    const updated = applyPozoRoundResults(pairs, round, 1);

    expect(updated.find((p) => p.id === "A").pts).toBe(1);
    expect(updated.find((p) => p.id === "B").pts).toBe(0);
  });

  test("el ganador acumula gf=marcador mayor, gc=marcador menor", () => {
    const pairs = [pair("A", 0, 2), pair("B", 0, 1)];
    const round = [court(1, pairs[0], pairs[1], 6, 3)]; // A gana 6-3
    const updated = applyPozoRoundResults(pairs, round, 1);

    const A = updated.find((p) => p.id === "A");
    expect(A.gf).toBe(6);
    expect(A.gc).toBe(3);
  });

  test("el perdedor acumula gf=marcador menor, gc=marcador mayor", () => {
    const pairs = [pair("A", 0, 2), pair("B", 0, 1)];
    const round = [court(1, pairs[0], pairs[1], 6, 3)]; // B pierde 3-6
    const updated = applyPozoRoundResults(pairs, round, 1);

    const B = updated.find((p) => p.id === "B");
    expect(B.gf).toBe(3);
    expect(B.gc).toBe(6);
  });

  test("acumula sobre valores existentes (no reinicia pts/gf/gc)", () => {
    const pairs = [pair("A", 1, 2, 5, 2), pair("B", 0, 1, 2, 5)];
    const round = [court(1, pairs[0], pairs[1], 6, 3)];
    const updated = applyPozoRoundResults(pairs, round, 1);

    const A = updated.find((p) => p.id === "A");
    expect(A.pts).toBe(2); // 1 + 1
    expect(A.gf).toBe(11); // 5 + 6
    expect(A.gc).toBe(5);  // 2 + 3
  });

  test("no muta el array original de parejas", () => {
    const pairs = [pair("A", 0, 2), pair("B", 0, 1)];
    const original = pairs.map((p) => ({ ...p }));
    const round = [court(1, pairs[0], pairs[1], 6, 3)];
    applyPozoRoundResults(pairs, round, 1);

    expect(pairs[0].pts).toBe(original[0].pts);
    expect(pairs[1].pts).toBe(original[1].pts);
  });
});

// ═══════════════════════════════════════════════════════════════
// applyPozoRoundResults — promoción y descenso (BUG principal)
// ═══════════════════════════════════════════════════════════════
describe("applyPozoRoundResults — subir y bajar canchas", () => {
  // BUG actual: el ganador recibe courtLevel MENOR que el perdedor del mismo match.
  // La invariante correcta es: winner.courtLevel > loser.courtLevel siempre.

  test("T-PROMO-1: el ganador tiene mayor courtLevel que el perdedor (mismo match)", () => {
    const pairs = [pair("A", 0, 3), pair("B", 0, 2)];
    const round = [court(1, pairs[0], pairs[1], 6, 4)]; // A gana
    const updated = applyPozoRoundResults(pairs, round, 1);

    const winner = updated.find((p) => p.id === "A");
    const loser = updated.find((p) => p.id === "B");
    expect(winner.courtLevel).toBeGreaterThan(loser.courtLevel);
  });

  test("T-PROMO-2: el ganador de cancha 2 sube a cancha 1 (courtLevel >= loser de cancha 1)", () => {
    // Con 2 canchas: ganador de cancha 2 debe quedar por encima del perdedor de cancha 1
    const pairs = [pair("A", 0, 3), pair("B", 0, 2), pair("C", 0, 1), pair("D", 0, 0)];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4), // A gana cancha 1, B pierde
      court(2, pairs[2], pairs[3], 6, 3), // C gana cancha 2, D pierde
    ];
    const updated = applyPozoRoundResults(pairs, round, 2);

    const winnerC = updated.find((p) => p.id === "C"); // ganó cancha 2 → sube a 1
    const loserB = updated.find((p) => p.id === "B");  // perdió cancha 1 → baja a 2
    expect(winnerC.courtLevel).toBeGreaterThan(loserB.courtLevel);
  });

  test("T-PROMO-3: con 3 canchas el ganador de cancha 3 sube a cancha 2", () => {
    const pairs = [
      pair("A", 0, 5), pair("B", 0, 4), // cancha 1
      pair("C", 0, 3), pair("D", 0, 2), // cancha 2
      pair("E", 0, 1), pair("F", 0, 0), // cancha 3
    ];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4),
      court(2, pairs[2], pairs[3], 6, 3),
      court(3, pairs[4], pairs[5], 6, 2), // E gana
    ];
    const updated = applyPozoRoundResults(pairs, round, 3);

    const winnerE = updated.find((p) => p.id === "E"); // cancha 3 → sube a 2
    const loserD  = updated.find((p) => p.id === "D"); // cancha 2 → baja a 3
    const loserB  = updated.find((p) => p.id === "B"); // cancha 1 → baja a 2
    const winnerC = updated.find((p) => p.id === "C"); // cancha 2 → sube a 1

    // E (subió a 2) y B (bajó a 2) deben estar al mismo nivel para compartir cancha 2
    expect(winnerE.courtLevel).toBe(loserB.courtLevel);
    // C (subió a 1) y D (bajó a 3) están en extremos opuestos
    expect(winnerC.courtLevel).toBeGreaterThan(loserD.courtLevel);
  });

  test("T-PROMO-4: el ganador de la cancha del rey (cancha 1) se queda en el top", () => {
    const pairs = [pair("A", 0, 5), pair("B", 0, 4)];
    const round = [court(1, pairs[0], pairs[1], 6, 3)]; // A gana el rey
    const updated = applyPozoRoundResults(pairs, round, 1);

    const winnerA = updated.find((p) => p.id === "A");
    const loserB  = updated.find((p) => p.id === "B");
    expect(winnerA.courtLevel).toBeGreaterThan(loserB.courtLevel);
  });

  test("T-PROMO-5: la ronda siguiente asigna ganadores a canchas superiores", () => {
    // Flujo completo: aplicar resultados → buildPozoRound → verificar nueva asignación
    const pairs = [
      pair("A", 0, 5), pair("B", 0, 4), // cancha 1
      pair("C", 0, 3), pair("D", 0, 2), // cancha 2
    ];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4), // A gana cancha 1, B pierde
      court(2, pairs[2], pairs[3], 6, 3), // C gana cancha 2, D pierde
    ];
    const updated = applyPozoRoundResults(pairs, round, 2);
    const nextRound = buildPozoRound(updated, 2);

    // Cancha 1 (la mejor) debe tener a los ganadores A y C
    const court1Ids = [nextRound[0].pairA?.id, nextRound[0].pairB?.id];
    expect(court1Ids).toContain("A");
    expect(court1Ids).toContain("C");

    // Cancha 2 debe tener a los perdedores B y D
    const court2Ids = [nextRound[1].pairA?.id, nextRound[1].pairB?.id];
    expect(court2Ids).toContain("B");
    expect(court2Ids).toContain("D");
  });

  test("T-PROMO-6: con 3 canchas la ronda siguiente respeta la pirámide completa", () => {
    const pairs = [
      pair("A", 0, 5), pair("B", 0, 4),
      pair("C", 0, 3), pair("D", 0, 2),
      pair("E", 0, 1), pair("F", 0, 0),
    ];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4), // A gana, B pierde
      court(2, pairs[2], pairs[3], 6, 3), // C gana, D pierde
      court(3, pairs[4], pairs[5], 6, 2), // E gana, F pierde
    ];
    const updated = applyPozoRoundResults(pairs, round, 3);
    const nextRound = buildPozoRound(updated, 3);

    // Cancha 1: los dos ganadores de canchas 1 y 2
    const c1 = [nextRound[0].pairA?.id, nextRound[0].pairB?.id];
    expect(c1).toContain("A");
    expect(c1).toContain("C");

    // Cancha 2: el ganador de cancha 3 y el perdedor de cancha 1
    const c2 = [nextRound[1].pairA?.id, nextRound[1].pairB?.id];
    expect(c2).toContain("E");
    expect(c2).toContain("B");

    // Cancha 3: los dos perdedores de canchas 2 y 3
    const c3 = [nextRound[2].pairA?.id, nextRound[2].pairB?.id];
    expect(c3).toContain("D");
    expect(c3).toContain("F");
  });
});

// ═══════════════════════════════════════════════════════════════
// applyPozoRoundResults — pareja en espera
// ═══════════════════════════════════════════════════════════════
describe("applyPozoRoundResults — pareja en espera", () => {
  test("la pareja que no jugó (espera) no modifica sus stats", () => {
    // 5 parejas, 2 canchas → la última (F) no juega
    const pairs = [
      pair("A", 0, 4), pair("B", 0, 3),
      pair("C", 0, 2), pair("D", 0, 1),
      pair("F", 0, 0), // espera
    ];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4),
      court(2, pairs[2], pairs[3], 6, 3),
    ];
    const updated = applyPozoRoundResults(pairs, round, 2);

    const F = updated.find((p) => p.id === "F");
    expect(F.pts).toBe(0);
    expect(F.gf).toBe(0);
    expect(F.gc).toBe(0);
  });

  test("solo una pareja queda fuera en la ronda siguiente con N*2+1 parejas", () => {
    const pairs = [
      pair("A", 0, 4), pair("B", 0, 3),
      pair("C", 0, 2), pair("D", 0, 1),
      pair("F", 0, 0),
    ];
    const round = [
      court(1, pairs[0], pairs[1], 6, 4),
      court(2, pairs[2], pairs[3], 6, 3),
    ];
    const updated = applyPozoRoundResults(pairs, round, 2);
    const nextRound = buildPozoRound(updated, 2);

    const assigned = nextRound.flatMap((c) => [c.pairA?.id, c.pairB?.id]).filter(Boolean);
    expect(assigned).toHaveLength(4);       // 2 canchas × 2 parejas
    expect(nextRound).toHaveLength(2);      // exactamente 2 canchas
  });
});
