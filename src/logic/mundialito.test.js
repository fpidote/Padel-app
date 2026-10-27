import { describe, it, expect } from "vitest";
import { buildKnockoutFromGroups, validateMundialitoConfig, seedQualifiers, knockoutInfo, knockoutByesText, mundialitoGroupsLocked, canReopenMundialito, reopenMundialitoPatch, mundialitoThirdPlace, mundialitoFormatOptions, formatTitle, formatDetail, describeFormat, availableStages, optionsForStage, stageLabel, stageChoiceLabel } from "./mundialito";
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
  it("T-VAL-01: exige al menos 6 parejas y orienta a Liga o Relámpago", () => {
    for (const n of [0, 3, 4, 5]) {
      const r = validateMundialitoConfig(n, 2, 1);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("Necesitas al menos 6 parejas (2 grupos de 3). Con menos, usa Liga o Relámpago.");
    }
  });

  it("T-VAL-02: acepta 6 parejas en 2 grupos de 3, pasando 1 o 2", () => {
    expect(validateMundialitoConfig(6, 2, 1)).toMatchObject({ ok: true, maxGroups: 2, maxAdvance: 2, error: null });
    expect(validateMundialitoConfig(6, 2, 2).ok).toBe(true);
  });

  it("T-VAL-03: grupos de 3 como mínimo: el máximo de grupos es parejas ÷ 3", () => {
    expect(validateMundialitoConfig(8, 3, 1)).toMatchObject({ ok: false, maxGroups: 2 });
    expect(validateMundialitoConfig(9, 3, 1).ok).toBe(true);
    expect(validateMundialitoConfig(20, 6, 1)).toMatchObject({ ok: true, maxGroups: 6 });
  });

  it("T-VAL-04: hace falta al menos 2 grupos (con uno es una liga)", () => {
    expect(validateMundialitoConfig(8, 1, 2)).toMatchObject({ ok: false, error: "Necesitas al menos 2 grupos" });
  });

  it("T-VAL-05: nunca puede pasar todo el grupo: máximo = tamaño del grupo más chico − 1", () => {
    expect(validateMundialitoConfig(10, 2, 4).ok).toBe(true);
    expect(validateMundialitoConfig(10, 2, 5).ok).toBe(false);
    expect(validateMundialitoConfig(11, 3, 3)).toMatchObject({ ok: false, maxAdvance: 2 });
    expect(validateMundialitoConfig(6, 2, 3).ok).toBe(false);
  });

  it("T-VAL-06: dos grupos de 5 pueden pasar 1 (final) o 2 (semifinales)", () => {
    expect(validateMundialitoConfig(10, 2, 1).ok).toBe(true);
    expect(validateMundialitoConfig(10, 2, 2).ok).toBe(true);
  });

  it("T-VAL-07: no lanza error con valores absurdos y los considera inválidos", () => {
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
    expect(knockoutInfo(2, 3)).toEqual({ qualifiers: 6, size: 8, byes: 2, groups: 2 });
    expect(knockoutInfo(2, 2)).toEqual({ qualifiers: 4, size: 4, byes: 0, groups: 2 });
    expect(knockoutInfo(3, 1)).toEqual({ qualifiers: 3, size: 4, byes: 1, groups: 3 });
    expect(knockoutInfo(4, 3)).toEqual({ qualifiers: 12, size: 16, byes: 4, groups: 4 });
    expect(knockoutInfo(2, 5)).toEqual({ qualifiers: 10, size: 16, byes: 6, groups: 2 });
  });
  it("usa los valores por defecto de la configuración (2 grupos, 2 avanzan)", () => {
    expect(knockoutInfo(undefined, undefined)).toEqual({ qualifiers: 4, size: 4, byes: 0, groups: 2 });
  });
});

describe("reglas del Mundialito — pasa directo", () => {
  it("avisa quiénes pasan directo cuando los clasificados no son potencia de 2", () => {
    const rules = generateRules("mundialito", { groupCount: 2, advancePerGroup: 3 }).join(" ");
    expect(rules).toContain("6 parejas");
    expect(rules).toContain("pasan directo a la segunda ronda todos los primeros de grupo");
  });
  it("no menciona pasa directo cuando el cuadro es exacto", () => {
    expect(generateRules("mundialito", { groupCount: 2, advancePerGroup: 2 }).join(" ")).not.toContain("pasan directo");
  });
});

describe("knockoutByesText", () => {
  const text = (g, a) => knockoutByesText(knockoutInfo(g, a));
  it("no dice nada si el cuadro es exacto", () => {
    expect(text(2, 2)).toBeNull();
  });
  it("si sobran tantos lugares como grupos, pasan todos los primeros", () => {
    expect(text(2, 3)).toBe("Con 6 parejas clasificadas, pasan directo a la segunda ronda todos los primeros de grupo.");
  });
  it("si sobra un solo lugar, pasa el mejor primero", () => {
    expect(text(3, 1)).toBe("Con 3 parejas clasificadas, pasa directo a la segunda ronda el mejor primero de grupo. Entre los de un mismo puesto, se ordenan por victorias y diferencia.");
  });
  it("si sobran menos lugares que grupos, pasan los mejores primeros", () => {
    expect(text(5, 1)).toBe("Con 5 parejas clasificadas, pasan directo a la segunda ronda los 3 mejores primeros de grupo. Entre los de un mismo puesto, se ordenan por victorias y diferencia.");
    expect(text(3, 2)).toBe("Con 6 parejas clasificadas, pasan directo a la segunda ronda los 2 mejores primeros de grupo. Entre los de un mismo puesto, se ordenan por victorias y diferencia.");
  });
  it("si sobran más lugares que grupos, completan con los mejores segundos", () => {
    expect(text(3, 4)).toBe("Con 12 parejas clasificadas, pasan directo a la segunda ronda todos los primeros de grupo y el mejor segundo. Entre los de un mismo puesto, se ordenan por victorias y diferencia.");
  });
  it("con 9 clasificados (3 grupos de 3) pasan primeros, segundos y el mejor tercero", () => {
    expect(text(3, 3)).toBe("Con 9 parejas clasificadas, pasan directo a la segunda ronda todos los primeros de grupo, todos los segundos y el mejor tercero. Entre los de un mismo puesto, se ordenan por victorias y diferencia.");
  });
  it("con 10 clasificados (2 grupos de 5) pasan primeros, segundos y terceros", () => {
    expect(text(2, 5)).toBe("Con 10 parejas clasificadas, pasan directo a la segunda ronda todos los primeros de grupo, todos los segundos y todos los terceros.");
  });
  it("no aclara el desempate cuando pasan todos los de cada puesto", () => {
    expect(text(2, 3)).not.toContain("Entre los de un mismo puesto");
  });
});

describe("eliminatoria del Mundialito sin cuadro de revancha", () => {
  it("solo tiene partidos del cuadro principal", () => {
    const groups = mkGroups([4, 4, 4], { B: 1, C: 2 });
    const bracket = buildKnockoutFromGroups(groups, 3);
    expect(bracket.every((m) => m.bracket === "winners")).toBe(true);
  });
});

describe("cierre de los resultados de grupos del Mundialito", () => {
  const real = (saved) => ({ saved, pairA: { id: 1 }, pairB: { id: 2 } });
  const bye = { saved: true, pairA: { id: 3 }, pairB: { id: "bye" } };

  it("mientras se juega la fase de grupos se puede editar", () => {
    expect(mundialitoGroupsLocked({ phase: "groups" })).toBe(false);
    expect(mundialitoGroupsLocked({})).toBe(false);
  });
  it("al iniciar la eliminatoria quedan cerrados", () => {
    expect(mundialitoGroupsLocked({ phase: "knockout" })).toBe(true);
  });
  it("se puede volver a grupos si no se jugó ningún partido real de la eliminatoria", () => {
    expect(canReopenMundialito({ phase: "knockout", knockoutBracket: [bye, real(false)] })).toBe(true);
  });
  it("no se puede volver si ya se jugó un partido real", () => {
    expect(canReopenMundialito({ phase: "knockout", knockoutBracket: [real(true)] })).toBe(false);
  });
  it("no aplica fuera de la eliminatoria", () => {
    expect(canReopenMundialito({ phase: "groups", knockoutBracket: null })).toBe(false);
  });
  it("el parche descarta el cuadro y vuelve a los grupos", () => {
    expect(reopenMundialitoPatch()).toEqual({ knockoutBracket: null, phase: "groups" });
  });
});

describe("Torneo por grupos — partido por el 3.º puesto", () => {
  const groups = [
    { standings: [pair(1, 6, 4, 0), pair(2, 3, 2, 2), pair(3, 0, 0, 4)] },
    { standings: [pair(4, 6, 4, 1), pair(5, 3, 2, 2), pair(6, 0, 1, 4)] },
  ];

  it("T-3P-M1: buildKnockoutFromGroups con thirdPlace agrega el partido por el 3.º puesto", () => {
    expect(buildKnockoutFromGroups(groups, 2, { thirdPlace: true }).some((m) => m.bracket === "third")).toBe(true);
    expect(buildKnockoutFromGroups(groups, 2).some((m) => m.bracket === "third")).toBe(false);
  });

  it("T-3P-M2: mundialitoThirdPlace exige la opción y 4 o más clasificados", () => {
    expect(mundialitoThirdPlace({ groupCount: 2, advancePerGroup: 2, thirdPlace: true })).toBe(true);
    expect(mundialitoThirdPlace({ groupCount: 2, advancePerGroup: 2 })).toBe(false);
    expect(mundialitoThirdPlace({ groupCount: 2, advancePerGroup: 1, thirdPlace: true })).toBe(false);
  });

  it("T-3P-M3: las reglas lo mencionan solo si está activado", () => {
    const base = { groupCount: 2, advancePerGroup: 2 };
    expect(generateRules("mundialito", base).join(" ")).not.toMatch(/3\.º/);
    expect(generateRules("mundialito", { ...base, thirdPlace: true }).join(" ")).toMatch(/3\.º y 4\.º puesto/);
  });
});

describe("mundialitoFormatOptions — formatos sugeridos según las parejas", () => {
  const find = (opts, g, a) => opts.find((o) => o.groupCount === g && o.advancePerGroup === a && !o.extraQualifiers);

  it("T-FMT-01: 12 parejas ofrece 4 grupos de 3 con pase de 1 (2 partidos por pareja, 4 clasificados)", () => {
    const o = find(mundialitoFormatOptions(12), 4, 1);
    expect(o).toMatchObject({ groupSizes: [3, 3, 3, 3], matchesPerPair: [2, 2], groupMatches: 12, qualifiers: 4, byes: 0, recommended: true });
  });

  it("T-FMT-02: 10 parejas ofrece 2 grupos de 5 pasando 2 (4 partidos por pareja, 20 en grupos)", () => {
    const o = find(mundialitoFormatOptions(10), 2, 2);
    expect(o).toMatchObject({ groupSizes: [5, 5], matchesPerPair: [4, 4], groupMatches: 20, qualifiers: 4, byes: 0, recommended: true });
  });

  it("T-FMT-03: con 11 parejas en 3 grupos los tamaños son 4, 4 y 3 y los partidos por pareja van de 2 a 3", () => {
    const o = find(mundialitoFormatOptions(11), 3, 2);
    expect(o).toMatchObject({ groupSizes: [4, 4, 3], matchesPerPair: [2, 3], groupMatches: 15, qualifiers: 6, byes: 2, recommended: false });
  });

  it("T-FMT-04: nunca sugiere grupos de menos de 3 ni que pase todo el grupo", () => {
    for (const n of [6, 8, 10, 11, 12, 17, 20, 24]) {
      for (const o of mundialitoFormatOptions(n)) {
        expect(Math.min(...o.groupSizes)).toBeGreaterThanOrEqual(3);
        expect(o.advancePerGroup).toBeLessThan(Math.min(...o.groupSizes));
        expect(o.qualifiers).toBeLessThanOrEqual(16);
        expect(o.groupSizes.reduce((a, b) => a + b, 0)).toBe(n);
      }
    }
  });

  it("T-FMT-05: 20 parejas permite más de 4 grupos (5 grupos de 4)", () => {
    expect(find(mundialitoFormatOptions(20), 5, 1)).toBeTruthy();
  });

  it("T-FMT-06: los recomendados (grupos parejos y cuadro exacto) van primero", () => {
    const opts = mundialitoFormatOptions(12);
    const firstNon = opts.findIndex((o) => !o.recommended);
    expect(opts.slice(0, firstNon).every((o) => o.recommended)).toBe(true);
    expect(opts.slice(firstNon).some((o) => o.recommended)).toBe(false);
    expect(opts[0].recommended).toBe(true);
  });

  it("T-FMT-06b: entre los recomendados van primero los de menos clasificados y, a igualdad, los de más grupos", () => {
    const opts = mundialitoFormatOptions(12);
    expect(opts.slice(0, 2).map((o) => `${o.groupCount}x${o.advancePerGroup}`)).toEqual(["4x1", "2x2"]);
  });

  it("T-FMT-07: con menos de 6 parejas no hay sugerencias (solo configuración manual)", () => {
    expect(mundialitoFormatOptions(5)).toEqual([]);
    expect(mundialitoFormatOptions(0)).toEqual([]);
  });
});

describe("textos de los formatos sugeridos", () => {
  const find = (n, g, a) => mundialitoFormatOptions(n).find((o) => o.groupCount === g && o.advancePerGroup === a && !o.extraQualifiers);

  it("T-FMT-08: título con grupos parejos y pase de 1", () => {
    expect(formatTitle(find(12, 4, 1))).toBe("4 grupos de 3 · pasa 1 de cada grupo");
  });

  it("T-FMT-09: título con grupos desiguales y pase de 2", () => {
    expect(formatTitle(find(11, 3, 2))).toBe("3 grupos de 4 y 3 · pasan 2 de cada grupo");
  });

  it("T-FMT-10: detalle con cuadro exacto", () => {
    expect(formatDetail(find(12, 4, 1))).toBe("Cada pareja juega 2 partidos · 12 partidos en grupos · Clasifican 4: semifinales y final");
  });

  it("T-FMT-11: detalle con pasa directo y grupos desiguales", () => {
    expect(formatDetail(find(11, 3, 2))).toBe("Cada pareja juega 2 o 3 partidos · 15 partidos en grupos · Clasifican 6: cuartos de final, 2 pasan directo");
  });
});

describe("describeFormat — resumen de cualquier configuración", () => {
  it("T-FMT-12: describe una configuración manual con los mismos datos que una sugerencia", () => {
    expect(describeFormat(12, 4, 1)).toMatchObject({ groupSizes: [3, 3, 3, 3], matchesPerPair: [2, 2], groupMatches: 12, qualifiers: 4, byes: 0 });
  });

  it("T-FMT-13: devuelve null si la configuración no es válida para esas parejas", () => {
    expect(describeFormat(3, 2, 1)).toBeNull();
    expect(describeFormat(8, 4, 3)).toBeNull();
    expect(describeFormat(0, 2, 2)).toBeNull();
  });
});

describe("clasificados extra: mejores terceros (extraQualifiers)", () => {
  // 3 grupos de 4; los terceros rinden distinto: C3 (1 victoria de 3), A3 (1 de 3, peor diferencia), B3 (0 de 3)
  const st = (id, wins, played, gf, gc) => ({ id, p1: `A${id}`, p2: `B${id}`, pts: wins, wins, played, gf, gc });
  const groups = [
    { standings: [st("A1", 3, 3, 6, 0), st("A2", 2, 3, 4, 2), st("A3", 1, 3, 2, 4), st("A4", 0, 3, 0, 6)] },
    { standings: [st("B1", 3, 3, 6, 0), st("B2", 2, 3, 4, 2), st("B3", 0, 3, 1, 5), st("B4", 0, 3, 0, 6)] },
    { standings: [st("C1", 3, 3, 6, 0), st("C2", 2, 3, 4, 2), st("C3", 1, 3, 3, 3), st("C4", 0, 3, 0, 6)] },
  ];
  const ids = (bracket) => new Set(bracket.flatMap((m) => [m.pairA?.id, m.pairB?.id]).filter((id) => id && id !== "bye"));

  it("T-EXT-01: knockoutInfo suma los extra: 3 grupos pasando 2 + 2 mejores terceros = 8, cuadro exacto", () => {
    expect(knockoutInfo(3, 2, 2)).toMatchObject({ qualifiers: 8, size: 8, byes: 0 });
    expect(knockoutInfo(3, 2)).toMatchObject({ qualifiers: 6, byes: 2 });
  });

  it("T-EXT-02: seedQualifiers incluye a los 2 mejores terceros por rendimiento y deja fuera al peor", () => {
    const seeded = seedQualifiers(groups, 2, 2).map((p) => p.id);
    expect(seeded).toHaveLength(8);
    expect(seeded).toContain("C3");
    expect(seeded).toContain("A3");
    expect(seeded).not.toContain("B3");
  });

  it("T-EXT-03: los extra se siembran al final (no reciben pasa directo antes que un segundo)", () => {
    const seeded = seedQualifiers(groups, 2, 1).map((p) => p.id);
    expect(seeded).toHaveLength(7);
    expect(seeded.slice(-2)).not.toContain("A1");
    expect(seeded).not.toContain("A3");
  });

  it("T-EXT-04: buildKnockoutFromGroups arma el cuadro con los extra", () => {
    const bracket = buildKnockoutFromGroups(groups, 2, { extraQualifiers: 2 });
    expect(ids(bracket).size).toBe(8);
    expect(bracket.filter((m) => m.round === 1 && m.bracket === "winners")).toHaveLength(4);
    expect(ids(buildKnockoutFromGroups(groups, 2)).size).toBe(6);
  });

  it("T-EXT-05: validateMundialitoConfig limita los extra a menos que los grupos y exige que el grupo tenga ese puesto", () => {
    expect(validateMundialitoConfig(12, 3, 2, 2)).toMatchObject({ ok: true, maxExtra: 2 });
    expect(validateMundialitoConfig(12, 3, 2, 3).ok).toBe(false);
    expect(validateMundialitoConfig(12, 3, 4, 1).ok).toBe(false); // pasaría todo el grupo y no hay 5.º
    expect(validateMundialitoConfig(12, 3, 2).ok).toBe(true);
  });

  it("T-EXT-06: mundialitoThirdPlace cuenta los extra para tener semifinales", () => {
    expect(mundialitoThirdPlace({ groupCount: 3, advancePerGroup: 1, extraQualifiers: 1, thirdPlace: true })).toBe(true);
    expect(mundialitoThirdPlace({ groupCount: 3, advancePerGroup: 1, thirdPlace: true })).toBe(false);
  });

  it("T-EXT-07: 12 parejas sugiere 3 grupos de 4 pasando 2 + 2 mejores terceros como formato recomendado", () => {
    const o = mundialitoFormatOptions(12).find((x) => x.groupCount === 3 && x.advancePerGroup === 2 && x.extraQualifiers === 2);
    expect(o).toMatchObject({ qualifiers: 8, byes: 0, recommended: true });
    expect(mundialitoFormatOptions(12).find((x) => x.groupCount === 3 && x.advancePerGroup === 2 && !x.extraQualifiers)).toMatchObject({ qualifiers: 6, byes: 2, recommended: false });
  });

  it("T-EXT-08: las sugerencias con extra solo aparecen si completan un cuadro exacto", () => {
    for (const n of [9, 12, 15, 20]) {
      for (const o of mundialitoFormatOptions(n).filter((x) => x.extraQualifiers > 0)) {
        expect(o.byes).toBe(0);
        expect(o.extraQualifiers).toBeLessThan(o.groupCount);
      }
    }
  });

  it("T-EXT-09: título y resumen mencionan a los mejores terceros", () => {
    const o = describeFormat(12, 3, 2, 2);
    expect(formatTitle(o)).toBe("3 grupos de 4 · pasan 2 de cada grupo + los 2 mejores terceros");
    expect(formatDetail(o)).toBe("Cada pareja juega 3 partidos · 18 partidos en grupos · Clasifican 8: cuartos de final");
    expect(formatTitle(describeFormat(12, 4, 1, 1))).toBe("4 grupos de 3 · pasa 1 de cada grupo + el mejor segundo");
  });

  it("T-EXT-10: las reglas explican cómo se eligen los mejores terceros", () => {
    const rules = generateRules("mundialito", { groupCount: 3, advancePerGroup: 2, extraQualifiers: 2 }).join(" ");
    expect(rules).toMatch(/2 mejores terceros/);
    expect(rules).toMatch(/victorias por partido jugado/);
    expect(generateRules("mundialito", { groupCount: 3, advancePerGroup: 2 }).join(" ")).not.toMatch(/mejores terceros/);
  });
});

describe("elegir por objetivo: hasta qué ronda quiere llegar el organizador", () => {
  it("T-STG-01: con 10 parejas se puede llegar a final, semifinales y cuartos", () => {
    expect(availableStages(mundialitoFormatOptions(10))).toEqual([2, 4, 8]);
  });

  it("T-STG-02: con 6 parejas solo final o semifinales", () => {
    expect(availableStages(mundialitoFormatOptions(6))).toEqual([2, 4]);
  });

  it("T-STG-03: filtrar por semifinales con 10 parejas deja 2 grupos de 5 pasando 2 y no pasando 1", () => {
    const opts = optionsForStage(mundialitoFormatOptions(10), 4);
    expect(opts.some((o) => o.groupCount === 2 && o.advancePerGroup === 2)).toBe(true);
    expect(opts.some((o) => o.groupCount === 2 && o.advancePerGroup === 1)).toBe(false);
    expect(opts.every((o) => o.bracketSize === 4)).toBe(true);
  });

  it("T-STG-04: la final con 10 parejas es 2 grupos de 5 pasando 1 (2 clasificados)", () => {
    const opts = optionsForStage(mundialitoFormatOptions(10), 2);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({ groupCount: 2, advancePerGroup: 1, qualifiers: 2 });
  });

  it("T-STG-05: cuartos con 12 parejas incluye 4 grupos de 3 pasando 2 y 3 grupos de 4 con mejores terceros", () => {
    const opts = optionsForStage(mundialitoFormatOptions(12), 8);
    expect(opts.some((o) => o.groupCount === 4 && o.advancePerGroup === 2 && !o.extraQualifiers)).toBe(true);
    expect(opts.some((o) => o.groupCount === 3 && o.advancePerGroup === 2 && o.extraQualifiers === 2)).toBe(true);
  });

  it("T-STG-06: sin objetivo (null) devuelve todo y hay nombre para cada etapa", () => {
    const all = mundialitoFormatOptions(12);
    expect(optionsForStage(all, null)).toEqual(all);
    expect([2, 4, 8, 16].map(stageLabel)).toEqual(["Final", "Semifinales", "Cuartos", "Octavos"]);
  });
});

describe("stageChoiceLabel — cuántas parejas pasan a la fase final", () => {
  it("T-STG-07: el botón dice cuántas pasan y entre paréntesis con qué ronda empieza el cuadro", () => {
    expect([2, 4, 8, 16].map(stageChoiceLabel)).toEqual(["2 (final)", "4 (semifinales)", "8 (cuartos)", "16 (octavos)"]);
  });
});
