import { describe, it, expect } from "vitest";
import { buildBracket, advanceBracket, unadvanceBracket, countPlayed, firstRoundSeedPairs, canEditBracketMatch, hasPlayedRealMatch, bracketRoundName, bracketPodium, bracketComplete, bracketSemifinalLosers, relampagoPodium, relampagoCanFinish } from "./relampago.js";
import { generateRules, TOURNAMENT_TYPES } from "./constants.js";

function makePairs(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    p1: `P${i}A`,
    p2: `P${i}B`,
  }));
}

describe("buildBracket — sin byes (potencia de 2)", () => {
  it("T-REL-06: 4 parejas — consolación R1 tiene 1 match, 0 BYEs en slots", () => {
    const bracket = buildBracket(makePairs(4));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    expect(consR1).toHaveLength(1);
    const allPairs = consR1.flatMap((m) => [m.pairA, m.pairB]);
    expect(allPairs.every((p) => p === null || p.id !== "bye")).toBe(true);
  });

  it("T-REL-07: 8 parejas — W_R1 tiene 4 partidos reales, consolación R1 tiene 2 partidos", () => {
    const bracket = buildBracket(makePairs(8));
    const wR1 = bracket.filter((m) => m.bracket === "winners" && m.round === 1);
    expect(wR1).toHaveLength(4);
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    expect(consR1).toHaveLength(2);
  });
});

describe("buildBracket — con byes (no potencia de 2)", () => {
  it("T-REL-01: 6 parejas — consolación R1 tiene 2 equipos reales, 0 BYEs en slots", () => {
    const bracket = buildBracket(makePairs(6));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    // Con el fix: solo 1 match en consR1 con 2 slots null (se llenan al avanzar)
    // Bug actual: 2 matches, uno con BYE vs BYE
    const byeSlots = consR1.flatMap((m) => [m.pairA, m.pairB]).filter((p) => p?.id === "bye");
    expect(byeSlots).toHaveLength(0);
  });

  it("T-REL-02: 6 parejas — la consolación tiene dos semifinales y una final", () => {
    const bracket = buildBracket(makePairs(6));
    const consR2 = bracket.filter((m) => m.bracket === "consolation" && m.round === 2);
    expect(consR2).toHaveLength(1);
  });

  it("T-REL-03: 7 parejas — consolación R1 tiene slots para 3 equipos reales, no BYEs", () => {
    const bracket = buildBracket(makePairs(7));
    const consR1 = bracket.filter((m) => m.bracket === "consolation" && m.round === 1);
    // 3 losers reales → ceil(3/2) = 2 matches en consolación R1
    expect(consR1).toHaveLength(2);
    const byeSlots = consR1.flatMap((m) => [m.pairA, m.pairB]).filter((p) => p?.id === "bye");
    expect(byeSlots).toHaveLength(0);
  });
});

describe("advanceBracket — bye-loser de W_R2 va a consolación", () => {
  // 6 parejas: las dos mejores descansan en mitades opuestas, cada una espera a un ganador de R1.
  function conditionalR2Matches(bracket) {
    return bracket.filter(
      (m) => m.bracket === "winners" && m.round === 2 && (m.pairAByeInR1 || m.pairBByeInR1)
    );
  }

  it("T-REL-04: 6 parejas — la pareja que descansó y pierde en W_R2 llega a la consolación", () => {
    const bracket = buildBracket(makePairs(6));
    const conds = conditionalR2Matches(bracket);
    expect(conds).toHaveLength(2);
    const target = conds[0];
    const byeIsA = target.pairAByeInR1;
    const loser = byeIsA ? target.pairA : target.pairB;
    const withOpponent = bracket.map((m) => ({ ...m }));
    const opp = { id: "rival", p1: "R1", p2: "R2" };
    const t = withOpponent.find((m) => m.id === target.id);
    if (byeIsA) t.pairB = opp; else t.pairA = opp;
    const updated = advanceBracket(withOpponent, target.id, byeIsA ? 3 : 6, byeIsA ? 6 : 3);
    const inConsol = updated
      .filter((m) => m.bracket === "consolation")
      .some((m) => m.pairA?.id === loser.id || m.pairB?.id === loser.id);
    expect(inConsol).toBe(true);
  });

  it("T-REL-05: 6 parejas — el ganador del W_R2 condicional NO va a consolación", () => {
    const bracket = buildBracket(makePairs(6));
    const target = conditionalR2Matches(bracket)[0];
    const byeIsA = target.pairAByeInR1;
    const winner = byeIsA ? target.pairA : target.pairB;
    const withOpponent = bracket.map((m) => ({ ...m }));
    const opp = { id: "rival", p1: "R1", p2: "R2" };
    const t = withOpponent.find((m) => m.id === target.id);
    if (byeIsA) t.pairB = opp; else t.pairA = opp;
    const updated = advanceBracket(withOpponent, target.id, byeIsA ? 6 : 3, byeIsA ? 3 : 6);
    const inConsol = updated
      .filter((m) => m.bracket === "consolation")
      .some((m) => m.pairA?.id === winner.id || m.pairB?.id === winner.id);
    expect(inConsol).toBe(false);
  });
});

// Juega un cuadro completo con resultados pseudoaleatorios reproducibles.
function playAll(bracket, seed) {
  let x = seed;
  const rnd = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let b = bracket;
  for (let guard = 0; guard < 500; guard++) {
    const m = b.find((mm) => !mm.saved && mm.pairA && mm.pairB && mm.pairA.id !== "bye" && mm.pairB.id !== "bye");
    if (!m) break;
    const aWins = rnd() < 0.5;
    b = advanceBracket(b, m.id, aWins ? 6 : 3, aWins ? 3 : 6);
  }
  return b;
}

describe("cuadro completo — cualquier cantidad de parejas", () => {
  it("se puede jugar hasta el final: todos los partidos quedan resueltos y hay campeón", () => {
    for (let n = 3; n <= 20; n++) {
      for (const seed of [1, 7, 42]) {
        const b = playAll(buildBracket(makePairs(n)), seed);
        const stuck = b.filter((m) => !m.saved && (m.pairA?.id !== "bye" && m.pairB?.id !== "bye") );
        expect(stuck.map((m) => m.id), `n=${n} seed=${seed}`).toEqual([]);
        const final = b.find((m) => m.bracket === "winners" && !m.nextMatchId);
        expect(final.winner, `n=${n} seed=${seed}`).toBeTruthy();
      }
    }
  });

  it("la consolación también termina con un campeón de revancha", () => {
    for (let n = 3; n <= 20; n++) {
      const b = playAll(buildBracket(makePairs(n)), 5);
      const cons = b.filter((m) => m.bracket === "consolation");
      const final = cons.find((m) => !m.nextMatchId);
      expect(final?.winner, `n=${n}`).toBeTruthy();
      expect(final.winner.id, `n=${n}`).not.toBe("bye");
    }
  });

  it("cada pareja juega como máximo un partido por ronda del cuadro principal", () => {
    for (let n = 3; n <= 20; n++) {
      const b = playAll(buildBracket(makePairs(n)), 3);
      for (const m of b.filter((x) => x.bracket === "winners")) {
        // el ganador de un partido no puede estar en dos partidos de la misma ronda
        const same = b.filter((x) => x.bracket === "winners" && x.round === m.round);
        const ids = same.flatMap((x) => [x.pairA?.id, x.pairB?.id]).filter((id) => id && id !== "bye");
        expect(new Set(ids).size, `n=${n} ronda ${m.round}`).toBe(ids.length);
      }
    }
  });

  it("en el cuadro principal se juegan n-1 partidos reales (cada uno elimina a una pareja)", () => {
    for (let n = 2; n <= 20; n++) {
      const b = playAll(buildBracket(makePairs(n)), 11);
      const real = b.filter(
        (m) => m.bracket === "winners" && m.saved && m.pairA?.id !== "bye" && m.pairB?.id !== "bye"
      );
      expect(real, `n=${n}`).toHaveLength(n - 1);
    }
  });
});

describe("buildBracket — casos extremos", () => {
  it("T-REL-10: 2 parejas — sin cuadro de consolación", () => {
    const bracket = buildBracket(makePairs(2));
    const consol = bracket.filter((m) => m.bracket === "consolation");
    expect(consol).toHaveLength(0);
  });
});

describe("advanceBracket — enrutamiento condicional (5 parejas)", () => {
  it("T-REL-08: 5 parejas — bye-advanced loser de W_R2 va a consolación R1", () => {
    const bracket = buildBracket(makePairs(5));
    // Con 5 parejas: size=8, 3 partidos reales en W_R1, 1 bye en W_R1
    // W_R2 conditional: el lado bye-avanzado que pierde → consolación R1 slot extra
    const w2CondMatch = bracket.find(
      (m) => m.bracket === "winners" && m.round === 2 &&
        ((m.pairAByeInR1 && !m.pairBByeInR1) || (!m.pairAByeInR1 && m.pairBByeInR1))
    );
    expect(w2CondMatch).toBeTruthy();
    // Hacer perder al equipo bye-avanzado
    const byeSlotIsA = w2CondMatch.pairAByeInR1;
    // Si el bye está en A, hacer ganar B (scoreA=3, scoreB=6)
    const updated = byeSlotIsA
      ? advanceBracket(bracket, w2CondMatch.id, 3, 6)
      : advanceBracket(bracket, w2CondMatch.id, 6, 3);
    const loser = byeSlotIsA ? w2CondMatch.pairA : w2CondMatch.pairB;
    const consolR1 = updated.filter((m) => m.bracket === "consolation" && m.round === 1);
    const loserInConsolR1 = consolR1.some(
      (m) => m.pairA?.id === loser.id || m.pairB?.id === loser.id
    );
    expect(loserInConsolR1).toBe(true);
  });

  it("T-REL-09: 7 parejas — loser no-bye-avanzado de W_R2 condicional NO va a consolación", () => {
    // Con 7 parejas hay un W_R2 condicional (pairAByeInR1=true, pairBByeInR1=false).
    // pairA se llena por rippleByes; pairB requiere jugar primero el W_R1 real que lo alimenta.
    // Si pierde el equipo NO bye-avanzado (pairB), shouldRoute=false → no va a consolación.
    let bracket = buildBracket(makePairs(7));
    const w2CondMatch = bracket.find(
      (m) => m.bracket === "winners" && m.round === 2 && m.pairAByeInR1 && !m.pairBByeInR1
    );
    expect(w2CondMatch).toBeTruthy();
    // El pairB viene del W_R1 real cuyo nextMatchId apunta a este W_R2
    const w1Feeder = bracket.find(
      (m) => m.bracket === "winners" && m.round === 1 &&
        m.nextMatchId === w2CondMatch.id && m.nextMatchSlot === "B"
    );
    expect(w1Feeder).toBeTruthy();
    // Jugar el W_R1 feeder para poblar pairB del W_R2 condicional
    bracket = advanceBracket(bracket, w1Feeder.id, 6, 3);
    const w2AfterR1 = bracket.find((m) => m.id === w2CondMatch.id);
    expect(w2AfterR1.pairB).toBeTruthy();
    // Hacer perder a pairB (el no-bye-avanzado): scoreA > scoreB → pairA gana, pairB pierde
    const updated = advanceBracket(bracket, w2AfterR1.id, 6, 3);
    const loser = w2AfterR1.pairB;
    const consolMatches = updated.filter((m) => m.bracket === "consolation");
    const loserInConsol = consolMatches.some(
      (m) => m.pairA?.id === loser.id || m.pairB?.id === loser.id
    );
    expect(loserInConsol).toBe(false);
  });
});

describe("countPlayed", () => {
  const m = (id, a, b, saved) => ({ id, pairA: { id: a }, pairB: { id: b }, saved });
  const bracket = [m("1", 1, 2, true), m("2", 3, "bye", true), m("3", 1, 3, false), m("4", 1, 3, true)];

  it("cuenta solo partidos guardados", () => {
    expect(countPlayed(bracket, 1)).toBe(2);
    expect(countPlayed(bracket, 2)).toBe(1);
  });
  it("ignora partidos contra BYE", () => {
    expect(countPlayed(bracket, 3)).toBe(1);
  });
  it("pareja sin partidos devuelve 0", () => {
    expect(countPlayed(bracket, 99)).toBe(0);
  });
});

describe("firstRoundSeedPairs", () => {
  it("empareja el mejor sembrado con el peor y reparte los pasa directo entre los mejores", () => {
    // 6 parejas en un cuadro de 8: los índices 6 y 7 son BYE
    expect(firstRoundSeedPairs(6)).toEqual([[0, 7], [3, 4], [1, 6], [2, 5]]);
  });
  it("los dos mejores sembrados quedan en mitades opuestas y solo se cruzan en la final", () => {
    for (const size of [4, 8, 16, 32]) {
      const pairs = firstRoundSeedPairs(size);
      const half = pairs.length / 2;
      const indexOf = (seed) => pairs.findIndex((p) => p.includes(seed));
      expect(indexOf(0) < half, `size ${size}`).not.toBe(indexOf(1) < half);
    }
  });
  it("los cuatro mejores quedan cada uno en un cuarto distinto del cuadro", () => {
    for (const size of [8, 16, 32]) {
      const pairs = firstRoundSeedPairs(size);
      const quarter = pairs.length / 4;
      const quarters = [0, 1, 2, 3].map((s) => Math.floor(pairs.findIndex((p) => p.includes(s)) / quarter));
      expect(new Set(quarters).size, `size ${size}`).toBe(4);
    }
  });
  it("sin pasa directo (potencia de 2) no hay índices fuera de rango", () => {
    expect(firstRoundSeedPairs(4)).toEqual([[0, 3], [1, 2]]);
  });
  it("coincide con la primera ronda real de buildBracket para cualquier cantidad", () => {
    for (let n = 2; n <= 16; n++) {
      const pairs = Array.from({ length: n }, (_, i) => ({ id: i, p1: `P${i}`, p2: "x" }));
      const r1 = buildBracket(pairs)
        .filter((m) => m.bracket === "winners" && m.round === 1)
        .sort((a, b) => a.matchIndex - b.matchIndex)
        .map((m) => [m.pairA.id, m.pairB.id]);
      const expected = firstRoundSeedPairs(n).map(([a, b]) => [a < n ? a : "bye", b < n ? b : "bye"]);
      expect(r1).toEqual(expected);
    }
  });
});

describe("unadvanceBracket — deshacer un resultado", () => {
  const cons = (b) => b.filter((m) => m.bracket === "consolation");
  const condMatch = (b) =>
    b.find((m) => m.bracket === "winners" && m.round === 2 && (m.pairAByeInR1 !== m.pairBByeInR1));

  // Hace jugar el W_R2 condicional de 5 parejas dejando que gane quien descansó.
  function playCondWithByeWinner(n) {
    let b = buildBracket(makePairs(n));
    const target = condMatch(b);
    const feeder = b.find((m) => m.bracket === "winners" && m.round === 1 && m.nextMatchId === target.id && m.pairA?.id !== "bye" && m.pairB?.id !== "bye");
    b = advanceBracket(b, feeder.id, 6, 3);
    const t = b.find((m) => m.id === target.id);
    const byeIsA = t.pairAByeInR1;
    b = advanceBracket(b, t.id, byeIsA ? 6 : 3, byeIsA ? 3 : 6);
    return { b, targetId: target.id };
  }

  it("quita al ganador del partido siguiente y al perdedor de la consolación", () => {
    let b = buildBracket(makePairs(4));
    const r1 = b.find((m) => m.id === "w_r1_m0");
    b = advanceBracket(b, r1.id, 6, 3);
    b = unadvanceBracket(b, r1.id);
    const next = b.find((m) => m.id === r1.nextMatchId);
    expect([next.pairA, next.pairB]).toEqual([null, null]);
    expect(cons(b).every((m) => !m.pairA && !m.pairB || m.pairB?.id === "bye")).toBe(true);
    expect(b.find((m) => m.id === r1.id).saved).toBe(false);
  });

  it("si al ganar el que descansó se cubrió un lugar con BYE, deshacer lo vuelve a vaciar", () => {
    const { b, targetId } = playCondWithByeWinner(5);
    const slotted = cons(b).filter((m) => m.round === 1 && (m.pairA?.id === "bye" || m.pairB?.id === "bye") && m.saved);
    expect(slotted.length).toBeGreaterThan(0);
    const undone = unadvanceBracket(b, targetId);
    const after = cons(undone).filter((m) => m.round === 1);
    // no queda ningún partido de consolación resuelto solo por ese BYE
    expect(after.some((m) => m.saved && m.pairA?.id === "bye")).toBe(false);
    const fed = undone.find((m) => m.id === targetId);
    expect(fed.saved).toBe(false);
  });

  it("deshacer y volver a guardar con otro resultado deja el cuadro consistente", () => {
    const { b, targetId } = playCondWithByeWinner(5);
    const t = b.find((m) => m.id === targetId);
    const byeIsA = t.pairAByeInR1;
    let again = unadvanceBracket(b, targetId);
    // ahora pierde quien descansó
    again = advanceBracket(again, targetId, byeIsA ? 3 : 6, byeIsA ? 6 : 3);
    const loser = byeIsA ? t.pairA : t.pairB;
    expect(cons(again).some((m) => m.pairA?.id === loser.id || m.pairB?.id === loser.id)).toBe(true);
  });
});

describe("buildBracket — sin consolación (eliminatorias de Mundialito y Liga)", () => {
  it("con consolation:false solo hay cuadro principal y nadie se deriva a revancha", () => {
    for (const n of [3, 4, 5, 6, 8, 10, 12]) {
      const b = buildBracket(makePairs(n), { consolation: false });
      expect(b.filter((m) => m.bracket === "consolation"), `n=${n}`).toHaveLength(0);
      expect(b.every((m) => !m.loserMatchId), `n=${n}`).toBe(true);
    }
  });
  it("se puede jugar completo y el único partido sin siguiente es la final", () => {
    for (const n of [3, 5, 6, 7, 10, 12]) {
      const b = playAll(buildBracket(makePairs(n), { consolation: false }), 9);
      const finals = b.filter((m) => !m.nextMatchId);
      expect(finals, `n=${n}`).toHaveLength(1);
      expect(finals[0].winner, `n=${n}`).toBeTruthy();
    }
  });
});

describe("canEditBracketMatch — no corregir lo que ya condiciona partidos jugados", () => {
  const play = (b, id, a = 6, c = 3) => advanceBracket(b, id, a, c);

  it("un partido recién jugado se puede corregir mientras el siguiente no se haya jugado", () => {
    let b = buildBracket(makePairs(4));
    b = play(b, "w_r1_m0");
    expect(canEditBracketMatch(b, "w_r1_m0")).toBe(true);
  });

  it("deja de poder corregirse cuando se jugó el partido al que avanzó el ganador", () => {
    let b = buildBracket(makePairs(4));
    b = play(b, "w_r1_m0");
    b = play(b, "w_r1_m1");
    expect(canEditBracketMatch(b, "w_r1_m0")).toBe(true);
    b = play(b, "w_r2_m0");
    expect(canEditBracketMatch(b, "w_r1_m0")).toBe(false);
    expect(canEditBracketMatch(b, "w_r1_m1")).toBe(false);
    // La final sí se puede corregir: nada depende de ella
    expect(canEditBracketMatch(b, "w_r2_m0")).toBe(true);
  });

  it("tampoco se corrige si se jugó el partido de revancha al que fue el perdedor", () => {
    let b = buildBracket(makePairs(4));
    b = play(b, "w_r1_m0");
    b = play(b, "w_r1_m1");
    b = play(b, "c_r1_m0");
    expect(canEditBracketMatch(b, "w_r1_m0")).toBe(false);
  });

  it("un partido que no existe no se puede corregir", () => {
    expect(canEditBracketMatch(buildBracket(makePairs(4)), "nope")).toBe(false);
  });

  it("los pasa directo resueltos solos no bloquean la corrección", () => {
    // 3 parejas: el mejor sembrado descansa y espera al ganador del otro partido
    let b = buildBracket(makePairs(3));
    const real = b.find((m) => m.bracket === "winners" && m.round === 1 && m.pairA?.id !== "bye" && m.pairB?.id !== "bye");
    b = play(b, real.id);
    expect(canEditBracketMatch(b, real.id)).toBe(true);
  });
});

describe("hasPlayedRealMatch", () => {
  it("es falso en un cuadro recién armado aunque haya pasa directo resueltos solos", () => {
    expect(hasPlayedRealMatch(buildBracket(makePairs(6)))).toBe(false);
  });
  it("es verdadero en cuanto se juega un partido real", () => {
    let b = buildBracket(makePairs(4));
    b = advanceBracket(b, "w_r1_m0", 6, 3);
    expect(hasPlayedRealMatch(b)).toBe(true);
  });
  it("tolera un cuadro vacío o nulo", () => {
    expect(hasPlayedRealMatch(null)).toBe(false);
    expect(hasPlayedRealMatch([])).toBe(false);
  });
});

describe("partido por el 3.º y 4.º puesto (thirdPlace)", () => {
  const opts = { consolation: false, thirdPlace: true };
  const third = (b) => b.find((m) => m.bracket === "third");
  const play = (b, id, x, y) => advanceBracket(b, id, x, y);

  it("T-3P-01: con 4 parejas agrega un partido por el 3.º puesto en la ronda de la final", () => {
    const b = buildBracket(makePairs(4), opts);
    expect(third(b)).toMatchObject({ id: "w_third", round: 2, nextMatchId: null, pairA: null, pairB: null });
    expect(b.filter((m) => m.bracket === "winners")).toHaveLength(3);
  });

  it("T-3P-02: los perdedores de las dos semifinales se enfrentan en ese partido", () => {
    let b = buildBracket(makePairs(4), opts);
    const [s0, s1] = b.filter((m) => m.round === 1 && m.bracket === "winners");
    b = play(b, s0.id, 6, 2);
    b = play(b, s1.id, 3, 6);
    expect(third(b).pairA.id).toBe(s0.pairB.id);
    expect(third(b).pairB.id).toBe(s1.pairA.id);
  });

  it("T-3P-03: con 8 parejas el 3.º puesto se alimenta de las semifinales (ronda 2), no de los cuartos", () => {
    let b = buildBracket(makePairs(8), opts);
    expect(b.filter((m) => m.round === 1).every((m) => !m.loserMatchId)).toBe(true);
    expect(b.filter((m) => m.round === 2).map((m) => m.loserMatchId)).toEqual(["w_third", "w_third"]);
    expect(third(b).round).toBe(3);
  });

  it("T-3P-04: con pasa directo (5 parejas) el perdedor de la semifinal llega igual, aunque venga de jugar la ronda 1", () => {
    let b = buildBracket(makePairs(5), opts);
    for (const m of b.filter((x) => x.round === 1 && !x.saved && x.pairA && x.pairB)) b = play(b, m.id, 6, 1);
    const semis = b.filter((m) => m.round === 2);
    for (const s of semis) b = play(b, s.id, 6, 3);
    expect(third(b).pairA?.id).toBeTruthy();
    expect(third(b).pairB?.id).toBeTruthy();
    expect(third(b).pairA.id).not.toBe("bye");
    expect(third(b).pairB.id).not.toBe("bye");
  });

  it("T-3P-05: sin la opción, o con menos de 4 parejas, no hay partido por el 3.º puesto", () => {
    expect(third(buildBracket(makePairs(4), { consolation: false }))).toBeUndefined();
    expect(third(buildBracket(makePairs(2), opts))).toBeUndefined();
    expect(third(buildBracket(makePairs(3), opts))).toBeUndefined();
  });

  it("T-3P-06: no se puede corregir una semifinal si ya se jugó el 3.º puesto, y al deshacerla el hueco queda libre", () => {
    let b = buildBracket(makePairs(4), opts);
    const [s0, s1] = b.filter((m) => m.round === 1 && m.bracket === "winners");
    b = play(b, s0.id, 6, 2);
    b = play(b, s1.id, 6, 2);
    expect(canEditBracketMatch(b, s0.id)).toBe(true);
    b = play(b, "w_third", 6, 4);
    expect(canEditBracketMatch(b, s0.id)).toBe(false);
    b = unadvanceBracket(b, "w_third");
    b = unadvanceBracket(b, s0.id);
    expect(third(b).pairA).toBeNull();
  });
});

describe("bracketRoundName — nombre de cada ronda según su distancia a la final", () => {
  it("T-RND-01: la última es la Final y las anteriores Semifinales, Cuartos y Octavos", () => {
    expect([1, 2, 3, 4].map((r) => bracketRoundName(r, 4))).toEqual(["Octavos de final", "Cuartos de final", "Semifinales", "Final"]);
  });

  it("T-RND-02: con 4 parejas (2 rondas) son Semifinales y Final", () => {
    expect([1, 2].map((r) => bracketRoundName(r, 2))).toEqual(["Semifinales", "Final"]);
  });

  it("T-RND-03: más allá de octavos se usa 'Ronda N'", () => {
    expect([1, 2].map((r) => bracketRoundName(r, 6))).toEqual(["Ronda 1", "Ronda 2"]);
  });

  it("T-RND-04: con 2 parejas solo hay Final", () => {
    expect(bracketRoundName(1, 1)).toBe("Final");
  });

  it("T-RND-05: coincide con un cuadro real de 8 parejas", () => {
    const rounds = [...new Set(buildBracket(makePairs(8), { consolation: false }).map((m) => m.round))];
    expect(rounds.map((r) => bracketRoundName(r, Math.max(...rounds)))).toEqual(["Cuartos de final", "Semifinales", "Final"]);
  });
});

describe("bracketPodium — campeón, subcampeón y 3.º puesto", () => {
  const play = (b, id, x, y) => advanceBracket(b, id, x, y);
  const semis = (b) => b.filter((m) => m.bracket === "winners" && m.round === 1);

  it("T-POD-01: sin la final jugada no hay podio", () => {
    const b = buildBracket(makePairs(4), { consolation: false });
    expect(bracketPodium(b)).toEqual({ champion: null, runnerUp: null, third: null, fourth: null });
    expect(bracketPodium(null)).toEqual({ champion: null, runnerUp: null, third: null, fourth: null });
  });

  it("T-POD-02: con la final jugada hay campeón y subcampeón, y sin partido por el 3.º no hay tercero", () => {
    let b = buildBracket(makePairs(4), { consolation: false });
    const [s0, s1] = semis(b);
    b = play(b, s0.id, 6, 2);
    b = play(b, s1.id, 6, 3);
    b = play(b, "w_r2_m0", 6, 4);
    const pod = bracketPodium(b);
    expect(pod.champion.id).toBe(s0.pairA.id);
    expect(pod.runnerUp.id).toBe(s1.pairA.id);
    expect(pod.third).toBeNull();
  });

  it("T-POD-03: con partido por el 3.º jugado salen tercero y cuarto", () => {
    let b = buildBracket(makePairs(4), { consolation: false, thirdPlace: true });
    const [s0, s1] = semis(b);
    b = play(b, s0.id, 6, 2);
    b = play(b, s1.id, 6, 3);
    b = play(b, "w_r2_m0", 6, 4);
    b = play(b, "w_third", 6, 1);
    const pod = bracketPodium(b);
    expect(pod.third.id).toBe(s0.pairB.id);
    expect(pod.fourth.id).toBe(s1.pairB.id);
  });

  it("T-POD-04: con el partido por el 3.º sin jugar todavía no hay tercero", () => {
    let b = buildBracket(makePairs(4), { consolation: false, thirdPlace: true });
    const [s0, s1] = semis(b);
    b = play(b, s0.id, 6, 2);
    b = play(b, s1.id, 6, 3);
    b = play(b, "w_r2_m0", 6, 4);
    expect(bracketPodium(b).third).toBeNull();
  });

  it("T-POD-05: con 2 parejas la final decide campeón y subcampeón", () => {
    let b = buildBracket(makePairs(2), { consolation: false });
    b = play(b, b[0].id, 3, 6);
    const pod = bracketPodium(b);
    expect(pod.champion.id).toBe("p1");
    expect(pod.runnerUp.id).toBe("p0");
  });
});

describe("bracketComplete y bracketSemifinalLosers", () => {
  const play = (b, id, x, y) => advanceBracket(b, id, x, y);
  const jugarTodo = (b) => {
    for (const m of b.filter((x) => x.round === 1 && x.bracket === "winners")) b = play(b, m.id, 6, 2);
    return play(b, "w_r2_m0", 6, 4);
  };

  it("T-FIN-01: está completo cuando todos los partidos están jugados, incluido el del 3.º puesto", () => {
    let b = buildBracket(makePairs(4), { consolation: false, thirdPlace: true });
    expect(bracketComplete(b)).toBe(false);
    b = jugarTodo(b);
    expect(bracketComplete(b)).toBe(false); // falta el 3.º puesto
    b = play(b, "w_third", 6, 1);
    expect(bracketComplete(b)).toBe(true);
  });

  it("T-FIN-02: sin partido por el 3.º, completo en cuanto se juega la final", () => {
    expect(bracketComplete(jugarTodo(buildBracket(makePairs(4), { consolation: false })))).toBe(true);
  });

  it("T-FIN-03: sin cuadro no está completo", () => {
    expect(bracketComplete(null)).toBe(false);
    expect(bracketComplete([])).toBe(false);
  });

  it("T-FIN-04: los perdedores de semifinales (con 4 y con 8 parejas)", () => {
    for (const n of [4, 8]) {
      let b = buildBracket(makePairs(n), { consolation: false });
      const semis = (x) => x.filter((m) => m.bracket === "winners" && m.round === Math.log2(n) - 1);
      expect(bracketSemifinalLosers(b)).toEqual([]);
      for (let r = 1; r <= Math.log2(n) - 1; r++) {
        for (const m of b.filter((x) => x.bracket === "winners" && x.round === r)) b = play(b, m.id, 6, 2);
      }
      expect(bracketSemifinalLosers(b).map((p) => p.id).sort()).toEqual(semis(b).map((m) => m.loser.id).sort());
      expect(bracketSemifinalLosers(b)).toHaveLength(2);
    }
  });

  it("T-FIN-05: con 2 parejas no hay semifinales", () => {
    expect(bracketSemifinalLosers(buildBracket(makePairs(2), { consolation: false }))).toEqual([]);
  });
});

// Juega todo lo jugable; `ganaA` decide quién gana cada partido y `hasta` corta antes de que se juegue ese id
function jugar(bracket, { ganaA = true, salvo = [] } = {}) {
  let b = bracket;
  for (let g = 0; g < 100; g++) {
    const m = b.find((x) => !x.saved && x.pairA && x.pairB && x.pairA.id !== "bye" && x.pairB.id !== "bye" && !salvo.includes(x.id));
    if (!m) break;
    b = advanceBracket(b, m.id, ganaA ? 6 : 2, ganaA ? 2 : 6);
  }
  return b;
}

describe("relampagoPodium — podio del Relámpago según el cuadro", () => {
  it("sin la final jugada no hay podio", () => {
    const b = buildBracket(makePairs(6));
    expect(relampagoPodium(b)).toEqual({ champion: null, runnerUp: null, third: null });
  });

  it("el campeón es quien gana la final, el subcampeón quien la pierde (no el mejor por victorias)", () => {
    const b = jugar(buildBracket(makePairs(6)));
    const final = b.find((m) => m.bracket === "winners" && !m.nextMatchId);
    const podio = relampagoPodium(b);
    expect(podio.champion.id).toBe(final.winner.id);
    expect(podio.runnerUp.id).toBe(final.loser.id);
  });

  it("el tercero es el ganador de la final de la revancha", () => {
    const b = jugar(buildBracket(makePairs(8)));
    const consolFinal = b.find((m) => m.bracket === "consolation" && !m.nextMatchId);
    expect(consolFinal.saved).toBe(true);
    expect(relampagoPodium(b).third.id).toBe(consolFinal.winner.id);
  });

  it("con la final jugada y la revancha sin terminar, el tercero queda sin definir", () => {
    const base = buildBracket(makePairs(8));
    const consolFinal = base.find((m) => m.bracket === "consolation" && !m.nextMatchId);
    const b = jugar(base, { salvo: [consolFinal.id] });
    const podio = relampagoPodium(b);
    expect(podio.champion).not.toBeNull();
    expect(podio.third).toBeNull();
  });

  it("el subcampeón no es nunca el tercero ni el campeón (simulación 4–17 parejas)", () => {
    for (let n = 4; n <= 17; n++) {
      for (const ganaA of [true, false]) {
        const podio = relampagoPodium(jugar(buildBracket(makePairs(n)), { ganaA }));
        const ids = [podio.champion?.id, podio.runnerUp?.id, podio.third?.id].filter(Boolean);
        expect(new Set(ids).size).toBe(ids.length);
        expect(podio.champion).not.toBeNull();
        expect(podio.runnerUp).not.toBeNull();
      }
    }
  });
});

describe("reglas del Relámpago", () => {
  it("aclara que a la revancha pasa quien pierde su primer partido", () => {
    const reglas = generateRules("relampago", { courts: 2, scoringFormat: "games" }).join(" ");
    expect(reglas).toMatch(/primer partido/i);
    const desc = TOURNAMENT_TYPES.find((x) => x.id === "relampago").desc;
    expect(desc).toMatch(/primer partido/i);
  });
});

describe("relampagoCanFinish — cuándo se puede finalizar el torneo", () => {
  it("no se puede con el cuadro a medias ni sin cuadro", () => {
    expect(relampagoCanFinish({ status: "playing", bracket: buildBracket(makePairs(8)) })).toBe(false);
    expect(relampagoCanFinish({ status: "playing", bracket: [] })).toBe(false);
    expect(relampagoCanFinish(null)).toBe(false);
  });

  it("con la final jugada pero la revancha pendiente tampoco", () => {
    const base = buildBracket(makePairs(8));
    const consolFinal = base.find((m) => m.bracket === "consolation" && !m.nextMatchId);
    expect(relampagoCanFinish({ status: "playing", bracket: jugar(base, { salvo: [consolFinal.id] }) })).toBe(false);
  });

  it("se puede cuando todo el cuadro principal y la revancha están jugados, y una sola vez", () => {
    const t = { status: "playing", bracket: jugar(buildBracket(makePairs(8))) };
    expect(relampagoCanFinish(t)).toBe(true);
    expect(relampagoCanFinish({ ...t, status: "finished" })).toBe(false);
  });
});
