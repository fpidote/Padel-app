import { describe, it, expect } from "vitest";
import { buildKnockoutFromGroups, validateMundialitoConfig, seedQualifiers, knockoutInfo, knockoutByesText } from "./mundialito";
import { firstRoundSeedPairs } from "./relampago";
import { generateRules } from "./constants";

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

// ── Cruces de la eliminatoria ────────────────────────────────
const LETTERS = "ABCDEFGH";
// Grupo con el cuadro de posiciones ya definido: A1 > A2 > ... Cada grupo puede ser "más fuerte"
// (strength) para poder comparar a los primeros de grupos distintos.
function mkGroups(sizes, strength = {}) {
  return sizes.map((size, gi) => ({
    standings: Array.from({ length: size }, (_, k) => ({
      id: `${LETTERS[gi]}${k + 1}`,
      p1: `${LETTERS[gi]}${k + 1}`,
      p2: "x",
      wins: size - 1 - k,
      pts: size - 1 - k,
      played: size - 1,
      gf: 12 - 2 * k + (strength[LETTERS[gi]] ?? 0),
      gc: 2 * k,
    })),
    matches: [],
  }));
}
const groupOf = (id) => id[0];
const firstRound = (bracket) =>
  bracket
    .filter((m) => m.bracket === "winners" && m.round === 1)
    .sort((a, b) => a.matchIndex - b.matchIndex)
    .map((m) => [m.pairA.id, m.pairB.id]);
const realMatches = (bracket) => firstRound(bracket).filter(([a, b]) => a !== "bye" && b !== "bye");

describe("seedQualifiers", () => {
  it("ordena primero a los primeros de grupo, luego a los segundos y luego a los terceros", () => {
    const seeds = seedQualifiers(mkGroups([4, 4]), 3).map((p) => p.id);
    expect(seeds.map((id) => id[1])).toEqual(["1", "1", "2", "2", "3", "3"]);
  });

  it("entre los primeros, manda el mejor rendimiento y no la letra del grupo", () => {
    const seeds = seedQualifiers(mkGroups([4, 4], { B: 3 }), 3).map((p) => p.id);
    expect(seeds).toEqual(["B1", "A1", "B2", "A2", "B3", "A3"]);
  });

  it("devuelve a cada clasificado una sola vez", () => {
    const seeds = seedQualifiers(mkGroups([4, 4, 4]), 3).map((p) => p.id);
    expect(new Set(seeds).size).toBe(9);
  });

  it("compara grupos de distinto tamaño por porcentaje de victorias, no por victorias absolutas", () => {
    // El grupo de 5 tiene 4 victorias el primero; el de 4 tiene 3: ambos ganaron todo.
    // El segundo del grupo de 5 (3 de 4 = 75%) no debe pasar por delante del segundo del de 4 (2 de 3 = 67%) por tamaño.
    const seeds = seedQualifiers(mkGroups([5, 4]), 2).map((p) => p.id);
    expect(seeds.slice(0, 2).sort()).toEqual(["A1", "B1"]);
    expect(seeds.slice(2).sort()).toEqual(["A2", "B2"]);
  });

  it("usa el partido entre igualadas del grupo para decidir quién clasifica", () => {
    const g = mkGroups([3, 3]);
    // En A, A2 y A3 igualan en victorias; A3 le ganó a A2 y tiene peor diferencia.
    g[0].standings[1] = { ...g[0].standings[1], wins: 1, pts: 1, gf: 11, gc: 6 };
    g[0].standings[2] = { ...g[0].standings[2], wins: 1, pts: 1, gf: 6, gc: 7 };
    g[0].matches = [{ pairA: { id: "A2" }, pairB: { id: "A3" }, scoreA: "5", scoreB: "6", saved: true }];
    const seeds = seedQualifiers(g, 2).map((p) => p.id);
    expect(seeds).toContain("A3");
    expect(seeds).not.toContain("A2");
  });
});

describe("buildKnockoutFromGroups — cruces", () => {
  it("tu caso: 2 grupos de 4 clasifican 3 → pasan directo los dos primeros, no el grupo A", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([4, 4], { B: 3 }), 3);
    const byes = firstRound(bracket).filter(([a, b]) => a === "bye" || b === "bye").map(([a, b]) => (a === "bye" ? b : a));
    expect(byes.sort()).toEqual(["A1", "B1"]);
  });

  it("tu caso: nadie enfrenta en la primera ronda a alguien de su mismo grupo", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([4, 4]), 3);
    realMatches(bracket).forEach(([a, b]) => expect(groupOf(a)).not.toBe(groupOf(b)));
  });

  it("tu caso: los dos primeros de grupo se cruzan recién en la segunda ronda y de grupos distintos", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([4, 4]), 3);
    const r1 = firstRound(bracket);
    const byeHolders = r1.filter(([a, b]) => a === "bye" || b === "bye").map(([a, b]) => (a === "bye" ? b : a));
    expect(byeHolders.map(groupOf).sort()).toEqual(["A", "B"]);
  });

  it("3 grupos, clasifica 1: el pasa directo es del mejor primero, no del grupo A", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([3, 3, 3], { C: 2, B: 1 }), 1);
    const [a, b] = firstRound(bracket).find(([x, y]) => x === "bye" || y === "bye");
    expect([a, b].find((x) => x !== "bye")).toBe("C1");
  });

  it("10 clasificados (2 grupos de 5): 6 pasan directo y 2 partidos de primera ronda", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([5, 5]), 5);
    expect(firstRound(bracket)).toHaveLength(8);
    expect(realMatches(bracket)).toHaveLength(2);
    expect(firstRound(bracket).filter(([a, b]) => a === "bye" || b === "bye")).toHaveLength(6);
  });

  it("12 clasificados (3 grupos de 4): 4 pasan directo y 4 partidos", () => {
    const bracket = buildKnockoutFromGroups(mkGroups([4, 4, 4]), 4);
    expect(realMatches(bracket)).toHaveLength(4);
    expect(firstRound(bracket).filter(([a, b]) => a === "bye" || b === "bye")).toHaveLength(4);
  });

  it("cuadrícula: ningún cruce de primera ronda es del mismo grupo y todos los clasificados juegan", () => {
    for (let groupCount = 2; groupCount <= 4; groupCount++) {
      for (let size = 2; size <= 5; size++) {
        for (let adv = 1; adv <= size; adv++) {
          if (groupCount * adv < 2) continue;
          const groups = mkGroups(Array(groupCount).fill(size), { B: 1, C: 2, D: 3 });
          const label = `${groupCount} grupos de ${size}, avanzan ${adv}`;
          const bracket = buildKnockoutFromGroups(groups, adv);
          const flat = firstRound(bracket).flat().filter((id) => id !== "bye");
          expect(new Set(flat).size, label).toBe(groupCount * adv);
          realMatches(bracket).forEach(([a, b]) => expect(groupOf(a), `${label}: ${a} vs ${b}`).not.toBe(groupOf(b)));
        }
      }
    }
  });

  it("los pasa directo siempre son de los mejores sembrados", () => {
    const groups = mkGroups([4, 4, 4], { B: 1, C: 2 });
    const seeds = seedQualifiers(groups, 3).map((p) => p.id);
    const bracket = buildKnockoutFromGroups(groups, 3);
    const byes = firstRound(bracket).filter(([a, b]) => a === "bye" || b === "bye").map(([a, b]) => (a === "bye" ? b : a));
    expect(byes.sort()).toEqual(seeds.slice(0, byes.length).sort());
  });

  it("consistencia con el cuadro: usa la misma disposición de la primera ronda que el Relámpago", () => {
    const n = 6;
    expect(firstRoundSeedPairs(n)).toHaveLength(4);
  });
});

describe("knockoutInfo", () => {
  it("calcula clasificados, tamaño del cuadro y pasa directo", () => {
    expect(knockoutInfo(2, 3)).toEqual({ qualifiers: 6, size: 8, byes: 2 });
    expect(knockoutInfo(2, 2)).toEqual({ qualifiers: 4, size: 4, byes: 0 });
    expect(knockoutInfo(3, 1)).toEqual({ qualifiers: 3, size: 4, byes: 1 });
    expect(knockoutInfo(4, 3)).toEqual({ qualifiers: 12, size: 16, byes: 4 });
    expect(knockoutInfo(2, 5)).toEqual({ qualifiers: 10, size: 16, byes: 6 });
  });
  it("usa los valores por defecto de la configuración (2 grupos, 2 avanzan)", () => {
    expect(knockoutInfo(undefined, undefined)).toEqual({ qualifiers: 4, size: 4, byes: 0 });
  });
});

describe("reglas del Mundialito — pasa directo", () => {
  it("avisa cuántos pasan directo cuando los clasificados no son potencia de 2", () => {
    const rules = generateRules("mundialito", { groupCount: 2, advancePerGroup: 3 }).join(" ");
    expect(rules).toContain("6 parejas");
    expect(rules).toContain("2 mejor clasificadas pasan directo");
  });
  it("no menciona pasa directo cuando el cuadro es exacto", () => {
    expect(generateRules("mundialito", { groupCount: 2, advancePerGroup: 2 }).join(" ")).not.toContain("pasan directo");
  });
});

describe("knockoutByesText", () => {
  it("no dice nada si el cuadro es exacto", () => {
    expect(knockoutByesText(knockoutInfo(2, 2))).toBeNull();
  });
  it("en plural cuenta cuántas pasan directo", () => {
    expect(knockoutByesText(knockoutInfo(2, 3))).toBe("Con 6 parejas clasificadas, las 2 mejor clasificadas pasan directo a la segunda ronda.");
  });
  it("en singular usa la forma correcta", () => {
    expect(knockoutByesText(knockoutInfo(3, 1))).toBe("Con 3 parejas clasificadas, la mejor clasificada pasa directo a la segunda ronda.");
  });
});
