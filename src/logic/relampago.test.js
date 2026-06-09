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
  it("T-REL-06: 4 parejas — consolación R1 tiene 2 partidos reales, 0 BYEs", () => {
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
