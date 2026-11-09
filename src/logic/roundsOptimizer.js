import { pk } from "./utils";

// Mejora de rondas ya armadas: intercambia jugadores dentro de una misma ronda mientras baje el coste total.
// No cambia quién descansa ni cuántos partidos juega cada uno (solo mueve a los que ya juegan), así que el reparto
// de descansos queda como estaba. Las rondas fijadas no se tocan.
//
// El coste crece al cuadrado con las veces que se repite una pareja de jugadores: repetir una vez cuesta poco, pero
// tres veces el mismo rival en pocas rondas cuesta mucho más, así que el optimizador reparte las repeticiones en vez
// de acumularlas.

// Orden de prioridades: 1.º no repetir pareja (el peso más alto de largo), después partidos igualados de nivel y, dentro
// de eso, el menor número de rivales repetidos. Los niveles no se sacrifican por variedad de rivales.
export const OPTIMIZER_WEIGHTS = { partner: 3000, opponent: 300, advanced: 5000, balance: 400 };

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
// El coste se lleva al día de forma incremental: al probar un intercambio solo se recalculan las (como mucho) dos
// pistas afectadas, no todas las rondas. Con `verify` se comprueba al final que coincide con el cálculo completo.
export function improveRounds(rounds, { fixed = new Set(), weights, useLevels = false, advancedPenalty = false, maxPasses = 40, timeBudgetMs = 1500, annealMs = 0, temperature = 300, random = Math.random, verify = false } = {}) {
  const opts = { weights, useLevels, advancedPenalty };
  const result = cloneRounds(rounds);
  const partners = new Map();
  const opponents = new Map();
  const repeatCost = (n) => (n > 1 ? (n - 1) * (n - 1) : 0);

  // Suma (sign = 1) o quita (sign = -1) una pista a los contadores y devuelve cuánto cambia el coste total
  function applyCourt(court, sign) {
    let delta = 0;
    const [a1, a2] = court.pairA;
    const [b1, b2] = court.pairB;
    const bump = (map, k, w) => {
      const n = map.get(k) || 0;
      const m = n + sign;
      map.set(k, m);
      delta += w * (repeatCost(m) - repeatCost(n));
    };
    for (const [x, y] of [[a1, a2], [b1, b2]]) {
      bump(partners, pk(x.id, y.id), weights.partner);
      if (useLevels && advancedPenalty && level(x) >= 3 && level(y) >= 3) delta += sign * weights.advanced;
    }
    for (const x of court.pairA) for (const y of court.pairB) bump(opponents, pk(x.id, y.id), weights.opponent);
    if (useLevels) delta += sign * weights.balance * Math.abs(level(a1) + level(a2) - level(b1) - level(b2));
    return delta;
  }

  let current = 0;
  for (const round of result) for (const court of round.courts) current += applyCourt(court, 1);

  // Bajada por intercambios: acepta solo los que mejoran el coste, hasta que ninguno mejora
  function descend(deadline) {
    let improved = true;
    let passes = 0;
    while (improved && passes < maxPasses && Date.now() < deadline) {
      improved = false;
      passes++;
      for (let ri = 0; ri < result.length; ri++) {
        if (fixed.has(ri)) continue;
        const round = result[ri];
        const slots = slotsOf(round);
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            if (trySwap(round, slots[i], slots[j], (delta) => delta < 0)) improved = true;
          }
        }
      }
    }
  }

  // Prueba un intercambio dentro de una ronda: lo deja si `accept(delta)` lo permite, y si no lo deshace
  function trySwap(round, s1, s2, accept) {
    const c1 = round.courts[s1[0]];
    const c2 = round.courts[s2[0]];
    let delta = applyCourt(c1, -1);
    if (c2 !== c1) delta += applyCourt(c2, -1);
    swapSlots(round, s1, s2);
    delta += applyCourt(c1, 1);
    if (c2 !== c1) delta += applyCourt(c2, 1);
    if (accept(delta)) {
      current += delta;
      return delta < 0;
    }
    applyCourt(c1, -1);
    if (c2 !== c1) applyCourt(c2, -1);
    swapSlots(round, s1, s2);
    applyCourt(c1, 1);
    if (c2 !== c1) applyCourt(c2, 1);
    return false;
  }

  const start = Date.now();
  descend(start + timeBudgetMs);

  // Recocido simulado con presupuesto de tiempo: acepta a veces un intercambio que empeora un poco, con una
  // «temperatura» que baja hasta casi cero, para salir de los atascos de la bajada simple. Como el límite es de
  // tiempo y no de pasos, en un móvil lento se hacen menos pasos pero tarda lo mismo. Al final se vuelve a bajar.
  const free = [];
  for (let ri = 0; ri < result.length; ri++) if (!fixed.has(ri)) free.push(ri);
  if (annealMs > 0 && free.length) {
    const t0 = temperature;
    const t1 = 5;
    const annealStart = Date.now();
    let temp = t0;
    for (let it = 0; ; it++) {
      if (it % 500 === 0) {
        const frac = (Date.now() - annealStart) / annealMs;
        if (frac >= 1) break;
        temp = t0 * Math.pow(t1 / t0, frac);
      }
      const round = result[free[Math.floor(random() * free.length)]];
      const nSlots = round.courts.length * 4;
      const i = Math.floor(random() * nSlots);
      const j = Math.floor(random() * nSlots);
      if (i === j) continue;
      const slot = (n) => [Math.floor(n / 4), n % 4 < 2 ? "pairA" : "pairB", n % 2];
      trySwap(round, slot(i), slot(j), (delta) => delta <= 0 || random() < Math.exp(-delta / temp));
    }
    descend(Date.now() + timeBudgetMs);
  }
  if (verify) {
    const full = roundsCost(result, opts);
    if (full !== current) throw new Error(`Coste incremental ${current} distinto del completo ${full}`);
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
