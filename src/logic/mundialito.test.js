import { describe, it, expect } from "vitest";
import { buildKnockoutFromGroups, validateMundialitoConfig } from "./mundialito";

const pair = (id, pts, gf, gc) => ({ id, p1: `A${id}`, p2: `B${id}`, pts, gf, gc });

describe("buildKnockoutFromGroups", () => {
  it("genera el cuadro con los mejores de cada grupo", () => {
    const groups = [
      { standings: [pair(1, 6, 4, 0), pair(2, 3, 2, 2), pair(3, 0, 0, 4)] },
      { standings: [pair(4, 6, 4, 1), pair(5, 3, 2, 2), pair(6, 0, 1, 4)] },
    ];
    const bracket = buildKnockoutFromGroups(groups, 2);
    const ids = bracket
      .flatMap((m) => [m.pairA?.id, m.pairB?.id])
      .filter((id) => id && id !== "bye");
    expect(new Set(ids)).toEqual(new Set([1, 2, 4, 5]));
  });
});

describe("buildKnockoutFromGroups — enfrentamiento directo", () => {
  it("clasifica a la pareja que ganó el partido directo aunque la otra tenga mejor diferencia", () => {
    // En el grupo A, 1 y 2 empatan a 1 victoria. 1 le ganó a 2 por poco; 2 tiene mejor diferencia.
    const groups = [
      {
        standings: [pair(1, 1, 6, 5), pair(2, 1, 11, 6), pair(3, 0, 0, 6)],
        matches: [
          { pairA: { id: 1 }, pairB: { id: 2 }, scoreA: "6", scoreB: "5", saved: true },
          { pairA: { id: 2 }, pairB: { id: 3 }, scoreA: "6", scoreB: "0", saved: true },
        ],
      },
      { standings: [pair(4, 2, 12, 3), pair(5, 0, 3, 12)], matches: [] },
    ];
    const bracket = buildKnockoutFromGroups(groups, 1);
    const ids = bracket
      .flatMap((m) => [m.pairA?.id, m.pairB?.id])
      .filter((id) => id && id !== "bye");
    expect(new Set(ids)).toEqual(new Set([1, 4]));
  });
});

describe("validateMundialitoConfig", () => {
  it("rechaza más grupos que parejas disponibles para formar cruces", () => {
    const result = validateMundialitoConfig(4, 3, 2);

    expect(result.ok).toBe(false);
    expect(result.maxGroups).toBe(2);
  });

  it("acepta 4 parejas en 2 grupos con avance de 2", () => {
    const result = validateMundialitoConfig(4, 2, 2);

    expect(result).toMatchObject({ ok: true, maxGroups: 2, maxAdvance: 2, error: null });
  });

  it("rechaza un avance mayor que el tamaño del grupo más chico", () => {
    const result = validateMundialitoConfig(4, 2, 3);

    expect(result.ok).toBe(false);
    expect(result.maxAdvance).toBe(2);
  });

  it("rechaza menos de 4 parejas con el mensaje exacto", () => {
    const result = validateMundialitoConfig(3, 2, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Necesitas al menos 4 parejas");
  });

  it("acepta 8 parejas en 4 grupos con avance de 2", () => {
    const result = validateMundialitoConfig(8, 4, 2);

    expect(result).toMatchObject({ ok: true, maxGroups: 4, maxAdvance: 2, error: null });
  });

  it("rechaza 8 parejas en 4 grupos con avance de 3", () => {
    const result = validateMundialitoConfig(8, 4, 3);

    expect(result.ok).toBe(false);
    expect(result.maxAdvance).toBe(2);
  });

  it("calcula el avance máximo según el grupo más chico", () => {
    const result = validateMundialitoConfig(9, 4, 2);

    expect(result.maxAdvance).toBe(2);
  });

  it("no lanza error con 0 parejas y lo considera inválido", () => {
    expect(() => validateMundialitoConfig(0, 1, 0)).not.toThrow();
    expect(validateMundialitoConfig(0, 1, 0).ok).toBe(false);
  });
});
