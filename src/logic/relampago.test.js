import { describe, it, expect } from "vitest";
import { buildBracket, advanceBracket } from "./relampago.js";

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

  it("T-REL-02: 6 parejas — consolación R2 tiene 1 match reservado para bye-loser de W_R2", () => {
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
  function buildAndAdvanceW2ByeMatch(n) {
    const pairs = makePairs(n);
    let bracket = buildBracket(pairs);
    // Encontrar el partido W_R2 donde ambos son bye-avanzados
    const w2ByeMatch = bracket.find(
      (m) => m.bracket === "winners" && m.round === 2 && m.pairAByeInR1 && m.pairBByeInR1
    );
    return { bracket, w2ByeMatch };
  }

  it("T-REL-04: 6 parejas — loser de W_R2 bye-match llega a consolación R2", () => {
    const { bracket, w2ByeMatch } = buildAndAdvanceW2ByeMatch(6);
    expect(w2ByeMatch).toBeTruthy();
    // Guardar el partido: pairA gana (scoreA=6, scoreB=3)
    const updated = advanceBracket(bracket, w2ByeMatch.id, 6, 3);
    const loser = w2ByeMatch.pairB; // pairB pierde
    const consR2 = updated.filter((m) => m.bracket === "consolation" && m.round === 2);
    const loserInConsolSlotB = consR2.some((m) => m.pairB?.id === loser.id);
    expect(loserInConsolSlotB).toBe(true);
  });

  it("T-REL-05: 6 parejas — winner de W_R2 bye-match NO va a consolación", () => {
    const { bracket, w2ByeMatch } = buildAndAdvanceW2ByeMatch(6);
    expect(w2ByeMatch).toBeTruthy();
    const updated = advanceBracket(bracket, w2ByeMatch.id, 6, 3);
    const winner = w2ByeMatch.pairA; // pairA gana
    const consolMatches = updated.filter((m) => m.bracket === "consolation");
    const winnerInConsol = consolMatches.some(
      (m) => m.pairA?.id === winner.id || m.pairB?.id === winner.id
    );
    expect(winnerInConsol).toBe(false);
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
