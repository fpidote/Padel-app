import { describe, it, expect } from "vitest";
import { computeStandings, sortStandings, winsOf, applyMatchToPairs, standingsLabels } from "./standings";

const P = (id) => ({ id, p1: `A${id}`, p2: `B${id}` });
const match = (a, b, sa, sb, sets = null) => ({
  pairA: P(a),
  pairB: P(b),
  scoreA: String(sa),
  scoreB: String(sb),
  saved: true,
  sets,
});

describe("sortStandings", () => {
  it("ordena primero por partidos ganados", () => {
    const pairs = [P(1), P(2), P(3)];
    const s = computeStandings(pairs, [
      match(1, 2, 2, 0),
      match(1, 3, 2, 0),
      match(2, 3, 2, 1),
    ]);
    expect(sortStandings(s).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("desempata por diferencia de sets", () => {
    const pairs = [P(1), P(2), P(3)];
    // 1 gana a 2 (2-1), 2 gana a 3 (2-0), 3 gana a 1 (2-1): todos 1 victoria
    const s = computeStandings(pairs, [
      match(1, 2, 2, 1),
      match(2, 3, 2, 0),
      match(3, 1, 2, 1),
    ]);
    // dif sets: 1 → 3-3=0 ... 1: 2+1 - (1+2)=0 ; 2: 1+2 - (2+0)=1 ; 3: 0+2 - (2+1)=-1
    expect(sortStandings(s).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it("desempata por diferencia de juegos si empatan victorias y sets", () => {
    const pairs = [P(1), P(2), P(3), P(4)];
    const s = computeStandings(pairs, [
      match(1, 3, 2, 0, [{ a: 6, b: 4 }, { a: 6, b: 4 }]),
      match(2, 4, 2, 0, [{ a: 6, b: 0 }, { a: 6, b: 0 }]),
    ]);
    expect(sortStandings(s).map((x) => x.id).slice(0, 2)).toEqual([2, 1]);
  });
});

describe("sortStandings — enfrentamiento directo", () => {
  it("entre dos parejas igualadas en victorias gana la que ganó el partido entre ellas", () => {
    const pairs = [P(1), P(2), P(3)];
    // 1 gana a 2 por la mínima; 2 golea a 3. 1 y 2 empatan a 1 victoria y 2 tiene mejor diferencia.
    const matches = [match(1, 2, 6, 5), match(2, 3, 6, 0)];
    const s = computeStandings(pairs, matches);
    expect(sortStandings(s).map((x) => x.id)).toEqual([2, 1, 3]);
    expect(sortStandings(s, matches).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("un círculo entre tres igualadas no decide y cae a la diferencia", () => {
    const pairs = [P(1), P(2), P(3)];
    const matches = [match(1, 2, 2, 1), match(2, 3, 2, 0), match(3, 1, 2, 1)];
    const s = computeStandings(pairs, matches);
    expect(sortStandings(s, matches).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it("tres igualadas se ordenan por victorias en los partidos entre ellas", () => {
    // 1, 2 y 3 terminan con 2 victorias. Entre ellas: 1 gana a 2 y a 3, 2 gana a 3.
    // Por diferencia el orden sería 3, 1, 2 (3 golea a 4 y 5 y pierde por poco con 1 y 2).
    const pairs = [P(1), P(2), P(3), P(4), P(5)];
    const matches = [
      match(1, 2, 6, 0), match(1, 3, 6, 5), match(2, 3, 6, 5),
      match(3, 4, 6, 0), match(3, 5, 6, 0), match(2, 4, 6, 0),
    ];
    const s = computeStandings(pairs, matches);
    expect(sortStandings(s).map((x) => x.id).slice(0, 3)).toEqual([3, 1, 2]);
    expect(sortStandings(s, matches).map((x) => x.id).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("sin partidos entre las igualadas se mantiene el criterio anterior", () => {
    const pairs = [P(1), P(2), P(3), P(4)];
    const matches = [match(1, 3, 6, 5), match(2, 4, 6, 0)];
    const s = computeStandings(pairs, matches);
    expect(sortStandings(s, matches).map((x) => x.id)).toEqual(sortStandings(s).map((x) => x.id));
  });

  it("no muta la lista recibida", () => {
    const pairs = [P(1), P(2)];
    const matches = [match(1, 2, 6, 5)];
    const s = computeStandings(pairs, matches);
    const copy = s.map((x) => x.id);
    sortStandings(s, matches);
    expect(s.map((x) => x.id)).toEqual(copy);
  });
});

describe("standingsLabels", () => {
  it("por games usa G+ / G− / DG", () => {
    expect(standingsLabels({ scoringFormat: "games", scoringSystem: "games" })).toMatchObject({ unit: "games", plus: "G+", minus: "G−", diff: "DG" });
  });
  it("por tiempo contando games ganados usa games (también por defecto)", () => {
    expect(standingsLabels({ scoringSystem: "timed", timedMetric: "games" }).unit).toBe("games");
    expect(standingsLabels({}).unit).toBe("games");
    expect(standingsLabels(undefined).unit).toBe("games");
  });
  it("por tiempo contando puntos usa P+ / P−", () => {
    expect(standingsLabels({ scoringSystem: "timed", timedMetric: "points" })).toMatchObject({ unit: "points", plus: "P+", minus: "P−", diff: "DP" });
  });
  it("por puntos (rally) usa P+ / P−", () => {
    expect(standingsLabels({ scoringSystem: "rally" }).unit).toBe("points");
  });
  it("en sets usa S+ / S− / DS y suma la diferencia de games DG", () => {
    const l = standingsLabels({ scoringFormat: "sets3", scoringSystem: "rally" });
    expect(l).toMatchObject({ unit: "sets", plus: "S+", minus: "S−", diff: "DS", gamesDiff: "DG" });
    expect(standingsLabels({ scoringFormat: "sets5" }).unit).toBe("sets");
  });
  it("cada formato trae su leyenda con las mismas siglas que las columnas", () => {
    expect(standingsLabels({}).legend).toContain("G+");
    expect(standingsLabels({ scoringSystem: "rally" }).legend).toContain("P+");
    expect(standingsLabels({ scoringFormat: "sets3" }).legend).toContain("S+");
  });
});

describe("winsOf", () => {
  it("usa wins si existe, si no pts (torneos Relámpago antiguos)", () => {
    expect(winsOf({ wins: 2, pts: 6 })).toBe(2);
    expect(winsOf({ pts: 1 })).toBe(1);
    expect(winsOf({})).toBe(0);
  });
});

describe("applyMatchToPairs", () => {
  const base = { pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0 };
  const pairs = [{ id: 1, ...base }, { id: 2, ...base }];
  const match = { pairA: { id: 1 }, pairB: { id: 2 } };
  const sets = [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }];

  it("suma victoria, sets, juegos y partidos jugados", () => {
    const [w, l] = applyMatchToPairs(pairs, match, 2, 1, sets, 1);
    expect(w).toMatchObject({ pts: 1, gf: 2, gc: 1, gamesFor: 16, gamesAgainst: 15, played: 1 });
    expect(l).toMatchObject({ pts: 0, gf: 1, gc: 2, gamesFor: 15, gamesAgainst: 16, played: 1 });
  });
  it("sign -1 revierte exactamente y no muta la entrada", () => {
    const added = applyMatchToPairs(pairs, match, 2, 1, sets, 1);
    const back = applyMatchToPairs(added, match, 2, 1, sets, -1);
    expect(back).toEqual(pairs);
    expect(pairs[0].pts).toBe(0);
  });
  it("sin sets (modo games) solo mueve gf/gc", () => {
    const [w] = applyMatchToPairs(pairs, match, 6, 2, null, 1);
    expect(w).toMatchObject({ gf: 6, gc: 2, gamesFor: 0 });
  });
});
