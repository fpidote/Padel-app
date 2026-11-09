import { describe, it, expect } from "vitest";
import { roundsCost, improveRounds, advancedPenaltyApplies, rivalFactor, opponentRepeatCost, OPTIMIZER_WEIGHTS } from "./roundsOptimizer";
import { findRepeats } from "./manualRounds";

const P = (id, level = 0) => ({ id, name: `J${id}`, level });
const court = (a, b, c, d) => ({ pairA: [P(a), P(b)], pairB: [P(c), P(d)] });
const sameRound = () => ({ courts: [court(0, 1, 2, 3), court(4, 5, 6, 7)] });
const idsOf = (round) => round.courts.flatMap((c) => [...c.pairA, ...c.pairB]).map((p) => p.id).sort((x, y) => x - y);
const W = OPTIMIZER_WEIGHTS;

describe("roundsCost", () => {
  it("repetir tres veces al mismo rival cuesta mucho más que dos repeticiones sueltas", () => {
    const triple = [
      { courts: [court(0, 1, 2, 3)] },
      { courts: [court(0, 4, 2, 5)] },
      { courts: [court(0, 6, 2, 7)] },
    ];
    // 0 y 2 se enfrentan 3 veces
    const twoDoubles = [
      { courts: [court(0, 1, 2, 3)] },
      { courts: [court(0, 4, 2, 5)] },
      { courts: [court(1, 6, 3, 7)] },
    ];
    // 0-2 se enfrentan 2 veces y 1-3 se enfrentan 2 veces
    expect(roundsCost(triple, { weights: W })).toBeGreaterThan(roundsCost(twoDoubles, { weights: W }));
  });

  it("el orden de prioridades: repetir pareja pesa más que cualquier desequilibrio de nivel o rival repetido", () => {
    expect(W.partner).toBeGreaterThan(W.balance * 4);
    expect(W.partner).toBeGreaterThan(W.opponent * 4);
    // y un punto de desequilibrio de nivel pesa más que repetir un rival una vez: los niveles no se sacrifican por variedad
    expect(W.balance).toBeGreaterThan(W.opponent);
  });

  it("sin niveles activados no cuenta el desequilibrio", () => {
    const r = [{ courts: [{ pairA: [P(0, 3), P(1, 3)], pairB: [P(2, 1), P(3, 1)] }] }];
    expect(roundsCost(r, { weights: W, useLevels: false })).toBe(0);
    expect(roundsCost(r, { weights: W, useLevels: true })).toBe(W.balance * 4);
  });
});

describe("improveRounds", () => {
  const bad = () => [sameRound(), sameRound(), sameRound()];

  it("baja el coste y deja menos repeticiones", () => {
    const rounds = bad();
    const before = roundsCost(rounds, { weights: W });
    const improved = improveRounds(rounds, { weights: W });
    expect(roundsCost(improved, { weights: W })).toBeLessThan(before);
    const r0 = findRepeats(rounds);
    const r1 = findRepeats(improved);
    expect(r1.partners.length + r1.opponents.length).toBeLessThan(r0.partners.length + r0.opponents.length);
  });

  it("no modifica las rondas originales ni las fijadas, y cada ronda conserva a los mismos jugadores", () => {
    const rounds = bad();
    const snapshot = JSON.stringify(rounds);
    const improved = improveRounds(rounds, { weights: W, fixed: new Set([0]) });
    expect(JSON.stringify(rounds)).toBe(snapshot);
    expect(improved[0]).toEqual(rounds[0]);
    improved.forEach((r, i) => expect(idsOf(r)).toEqual(idsOf(rounds[i])));
  });

  it("si todas las rondas están fijadas no cambia nada", () => {
    const rounds = bad();
    const improved = improveRounds(rounds, { weights: W, fixed: new Set([0, 1, 2]) });
    expect(improved).toEqual(rounds);
  });

  it("el coste que lleva por dentro coincide con el cálculo completo (también con niveles, avanzados y rondas fijas)", () => {
    const lvl = (i) => (i < 4 ? 3 : i < 8 ? 2 : 1);
    const mk = (a, b, c, d) => ({ pairA: [P(a, lvl(a)), P(b, lvl(b))], pairB: [P(c, lvl(c)), P(d, lvl(d))] });
    const rounds = [
      { courts: [mk(0, 1, 2, 3), mk(4, 5, 6, 7), mk(8, 9, 10, 11)] },
      { courts: [mk(0, 1, 4, 5), mk(2, 3, 6, 7), mk(8, 9, 10, 11)] },
      { courts: [mk(0, 1, 2, 3), mk(4, 5, 6, 7), mk(8, 9, 10, 11)] },
      { courts: [mk(0, 4, 8, 9), mk(1, 5, 10, 11), mk(2, 6, 3, 7)] },
    ];
    for (const fixed of [new Set(), new Set([3])]) {
      for (const advancedPenalty of [false, true]) {
        // verify: lanza un error si el coste incremental se desvía del completo
        expect(() => improveRounds(rounds, { weights: W, useLevels: true, advancedPenalty, fixed, verify: true })).not.toThrow();
      }
    }
  });

  it("con recocido simulado tampoco empeora, respeta lo fijado y el coste interno coincide con el completo", () => {
    const rounds = bad();
    // generador pseudoaleatorio fijo para que el test sea reproducible
    let seed = 12345;
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const improved = improveRounds(rounds, { weights: W, fixed: new Set([0]), annealMs: 60, random, verify: true });
    expect(improved[0]).toEqual(rounds[0]);
    improved.forEach((r, i) => expect(idsOf(r)).toEqual(idsOf(rounds[i])));
    expect(roundsCost(improved, { weights: W })).toBeLessThanOrEqual(roundsCost(rounds, { weights: W }));
  });

  it("nunca sube el coste", () => {
    const rounds = [
      { courts: [court(0, 1, 2, 3), court(4, 5, 6, 7)] },
      { courts: [court(0, 4, 1, 5), court(2, 6, 3, 7)] },
      { courts: [court(0, 6, 1, 7), court(2, 4, 3, 5)] },
    ];
    const improved = improveRounds(rounds, { weights: W });
    expect(roundsCost(improved, { weights: W })).toBeLessThanOrEqual(roundsCost(rounds, { weights: W }));
  });

  it("no toca a quien descansa: el descanso de cada ronda se mantiene", () => {
    const rounds = [
      { courts: [court(0, 1, 2, 3)], sittingOut: [P(4)] },
      { courts: [court(0, 1, 2, 3)], sittingOut: [P(4)] },
    ];
    const improved = improveRounds(rounds, { weights: W });
    improved.forEach((r) => expect(r.sittingOut.map((p) => p.id)).toEqual([4]));
    improved.forEach((r, i) => expect(idsOf(r)).toEqual(idsOf(rounds[i])));
  });
});

describe("advancedPenaltyApplies", () => {
  const players = (levels) => levels.map((l, i) => P(i, l));
  it("se aplica si los avanzados caben sin juntarse (hasta 2 por pista)", () => {
    expect(advancedPenaltyApplies(players([3, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), 6)).toBe(true);
  });
  it("no se aplica si hay más de 2 avanzados por pista", () => {
    expect(advancedPenaltyApplies(players([3, 3, 3, 3, 3, 3, 3, 3]), 2)).toBe(false);
  });
});

describe("reparto de las repeticiones de rival por nivel", () => {
  it("repetir entre dos avanzados cuesta menos que entre medios, y con un principiante cuesta más", () => {
    expect(rivalFactor(P(0, 3), P(1, 3))).toBeLessThan(rivalFactor(P(0, 2), P(1, 2)));
    expect(rivalFactor(P(0, 2), P(1, 1))).toBeGreaterThan(rivalFactor(P(0, 2), P(1, 2)));
    expect(rivalFactor(P(0, 1), P(1, 1))).toBeGreaterThan(rivalFactor(P(0, 3), P(1, 3)));
  });

  it("la tercera vez pesa mucho más que la segunda, sea cual sea el nivel", () => {
    for (const f of [rivalFactor(P(0, 3), P(1, 3)), 1, rivalFactor(P(0, 1), P(1, 1))]) {
      expect(opponentRepeatCost(1, f)).toBe(0);
      expect(opponentRepeatCost(3, f)).toBeGreaterThan(4 * opponentRepeatCost(2, f));
    }
  });

  it("sin niveles activados todas las repeticiones pesan igual", () => {
    const dosVeces = (a, b) => [
      { courts: [{ pairA: [P(0, a), P(2, 0)], pairB: [P(1, b), P(3, 0)] }] },
      { courts: [{ pairA: [P(0, a), P(4, 0)], pairB: [P(1, b), P(5, 0)] }] },
    ];
    expect(roundsCost(dosVeces(3, 3), { weights: W })).toBe(roundsCost(dosVeces(1, 1), { weights: W }));
  });
});
