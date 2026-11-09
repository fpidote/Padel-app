import { pk } from "./utils";

// Mejora de rondas ya armadas: intercambia jugadores dentro de una misma ronda mientras baje el coste total.
// No cambia quién descansa ni cuántos partidos juega cada uno (solo mueve a los que ya juegan), así que el reparto
// de descansos queda como estaba. Las rondas fijadas no se tocan.
//
// El coste crece al cuadrado con las veces que se repite una pareja de jugadores: repetir una vez cuesta poco, pero
// tres veces el mismo rival en pocas rondas cuesta mucho más, así que el optimizador reparte las repeticiones en vez
// de acumularlas.

// Prioridad que elige el organizador: más variedad de rivales a costa de partidos algo menos igualados de nivel.
export const OPTIMIZER_PRIORITIES = {
  variedad: { partner: 3000, opponent: 300, advanced: 5000, balance: 150 },
  equilibrio: { partner: 3000, opponent: 300, advanced: 5000, balance: 400 },
};

const level = (p) => p?.level || 0;

// Coste de un conjunto de rondas. `useLevels` activa el equilibrio de nivel y la penalización de dos avanzados juntos.
export function roundsCost(rounds, { weights, useLevels = false, advancedPenalty = false }) {
  const partners = {};
  const opponents = {};
  let cost = 0;
  for (const round of rounds) {
    for (const court of round.courts) {
      const [a1, a2] = court.pairA;
      const [b1, b2] = court.pairB;
      for (const [x, y] of [[a1, a2], [b1, b2]]) {
        const k = pk(x.id, y.id);
        partners[k] = (partners[k] || 0) + 1;
        if (useLevels && advancedPenalty && level(x) >= 3 && level(y) >= 3) cost += weights.advanced;
      }
      for (const x of court.pairA) {
        for (const y of court.pairB) {
          const k = pk(x.id, y.id);
          opponents[k] = (opponents[k] || 0) + 1;
        }
      }
      if (useLevels) {
        cost += weights.balance * Math.abs(level(a1) + level(a2) - level(b1) - level(b2));
      }
    }
  }
  for (const n of Object.values(partners)) if (n > 1) cost += weights.partner * (n - 1) * (n - 1);
  for (const n of Object.values(opponents)) if (n > 1) cost += weights.opponent * (n - 1) * (n - 1);
  return cost;
}

function cloneRounds(rounds) {
  return rounds.map((r) => ({
    ...r,
    courts: r.courts.map((c) => ({ ...c, pairA: [...c.pairA], pairB: [...c.pairB] })),
  }));
}

function slotsOf(round) {
  const slots = [];
  round.courts.forEach((_, ci) => {
    ["pairA", "pairB"].forEach((side) => [0, 1].forEach((i) => slots.push([ci, side, i])));
  });
  return slots;
}

function swapSlots(round, s1, s2) {
  const c1 = round.courts[s1[0]];
  const c2 = round.courts[s2[0]];
  const tmp = c1[s1[1]][s1[2]];
  c1[s1[1]][s1[2]] = c2[s2[1]][s2[2]];
  c2[s2[1]][s2[2]] = tmp;
}

// Devuelve rondas nuevas (las originales no se modifican). `fixed`: Set de índices de ronda que no se tocan.
export function improveRounds(rounds, { fixed = new Set(), weights, useLevels = false, advancedPenalty = false, maxPasses = 40, timeBudgetMs = 1500 } = {}) {
  const opts = { weights, useLevels, advancedPenalty };
  const result = cloneRounds(rounds);
  let current = roundsCost(result, opts);
  const start = Date.now();
  let improved = true;
  let passes = 0;
  while (improved && passes < maxPasses && Date.now() - start < timeBudgetMs) {
    improved = false;
    passes++;
    for (let ri = 0; ri < result.length; ri++) {
      if (fixed.has(ri)) continue;
      const slots = slotsOf(result[ri]);
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          swapSlots(result[ri], slots[i], slots[j]);
          const c = roundsCost(result, opts);
          if (c < current) {
            current = c;
            improved = true;
          } else {
            swapSlots(result[ri], slots[i], slots[j]);
          }
        }
      }
    }
  }
  return result;
}

// Igual que en precomputeAllRounds: con muchos avanzados (más de 2 por pista) evitar que dos jueguen juntos es
// imposible, así que esa penalización no se aplica.
export function advancedPenaltyApplies(players, courts) {
  const advanced = players.filter((p) => level(p) >= 3).length;
  const activeCourts = Math.min(courts, Math.floor(players.length / 4));
  return !(advanced > 2 * activeCourts);
}
