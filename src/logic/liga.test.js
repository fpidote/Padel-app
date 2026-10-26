import { describe, test, expect, vi } from "vitest";
import {
  circleRoundRobin,
  buildLigaFixture,
  recomputeLigaStandings,
  buildLigaKnockout,
  ligaQualifierOptions,
  ligaQualifiers,
} from "./liga.js";
import { generateRules } from "./constants.js";

// shuffle es no-determinista — la mockeamos para que devuelva el array intacto
vi.mock("./utils.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shuffle: (arr) => [...arr] };
});

// ── Helpers ──────────────────────────────────────────────────
const pair = (id, pts = 0, gf = 0, gc = 0, gamesFor = 0, gamesAgainst = 0) => ({
  id,
  p1: `${id}a`,
  p2: `${id}b`,
  pts,
  gf,
  gc,
  gamesFor,
  gamesAgainst,
});

function pairsOf(n) {
  return Array.from({ length: n }, (_, i) => pair(i));
}

function allMatchupsCovered(rounds, n) {
  const seen = new Set();
  let total = 0;
  rounds.forEach((round) => {
    round.forEach(({ pairA, pairB }) => {
      const key = [pairA.id, pairB.id].sort((a, b) => a - b).join("_");
      expect(seen.has(key)).toBe(false); // nunca se repite un cruce
      seen.add(key);
      total++;
    });
  });
  expect(total).toBe((n * (n - 1)) / 2);
  return seen;
}

// ═══════════════════════════════════════════════════════════════
// circleRoundRobin
// ═══════════════════════════════════════════════════════════════
describe("circleRoundRobin — cantidad par de parejas", () => {
  test("con 4 parejas genera 3 rondas", () => {
    const rounds = circleRoundRobin(pairsOf(4));
    expect(rounds).toHaveLength(3);
  });

  test("con 4 parejas, cada pareja enfrenta a cada otra exactamente una vez", () => {
    const rounds = circleRoundRobin(pairsOf(4));
    allMatchupsCovered(rounds, 4);
  });

  test("con 6 parejas genera 5 rondas y 15 partidos totales (n*(n-1)/2)", () => {
    const rounds = circleRoundRobin(pairsOf(6));
    expect(rounds).toHaveLength(5);
    allMatchupsCovered(rounds, 6);
  });

  test("ninguna pareja juega dos veces en la misma ronda", () => {
    const rounds = circleRoundRobin(pairsOf(8));
    rounds.forEach((round) => {
      const idsInRound = round.flatMap((m) => [m.pairA.id, m.pairB.id]);
      expect(new Set(idsInRound).size).toBe(idsInRound.length);
    });
  });

  test("no muta el array de entrada", () => {
    const pairs = pairsOf(4);
    const snapshot = JSON.parse(JSON.stringify(pairs));
    circleRoundRobin(pairs);
    expect(pairs).toEqual(snapshot);
  });
});

describe("circleRoundRobin — cantidad impar de parejas", () => {
  test("con 3 parejas genera 3 rondas, cada una con exactamente 1 partido real", () => {
    const rounds = circleRoundRobin(pairsOf(3));
    expect(rounds).toHaveLength(3);
    rounds.forEach((round) => expect(round).toHaveLength(1));
    allMatchupsCovered(rounds, 3);
  });

  test("con 5 parejas genera 5 rondas y 10 partidos totales, cada pareja descansa exactamente una vez", () => {
    const rounds = circleRoundRobin(pairsOf(5));
    expect(rounds).toHaveLength(5);
    allMatchupsCovered(rounds, 5);

    const restCount = {};
    rounds.forEach((round) => {
      const playing = new Set(round.flatMap((m) => [m.pairA.id, m.pairB.id]));
      for (let id = 0; id < 5; id++) {
        if (!playing.has(id)) restCount[id] = (restCount[id] || 0) + 1;
      }
    });
    Object.values(restCount).forEach((count) => expect(count).toBe(1));
  });
});

describe("circleRoundRobin — casos límite", () => {
  test("con menos de 2 parejas devuelve un array vacío", () => {
    expect(circleRoundRobin([])).toEqual([]);
    expect(circleRoundRobin(pairsOf(1))).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildLigaFixture
// ═══════════════════════════════════════════════════════════════
describe("buildLigaFixture — ida", () => {
  test("con 6 parejas arma 5 jornadas y 15 partidos", () => {
    const { rounds, matches } = buildLigaFixture(pairsOf(6), false);
    expect(rounds).toHaveLength(5);
    expect(matches).toHaveLength(15);
  });

  test("cada jornada tiene date: null por defecto", () => {
    const { rounds } = buildLigaFixture(pairsOf(4), false);
    rounds.forEach((r) => expect(r.date).toBeNull());
  });

  test("el schema de cada match tiene pairA, pairB, scoreA/scoreB vacíos, saved=false, sets=null", () => {
    const { matches } = buildLigaFixture(pairsOf(4), false);
    matches.forEach((m) => {
      expect(m).toHaveProperty("pairA");
      expect(m).toHaveProperty("pairB");
      expect(m.scoreA).toBe("");
      expect(m.scoreB).toBe("");
      expect(m.saved).toBe(false);
      expect(m.sets).toBeNull();
      expect(m.round).toBeGreaterThan(0);
    });
  });

  test("standings inicial en cero para cada pareja", () => {
    const { pairs } = buildLigaFixture(pairsOf(4), false);
    expect(pairs).toHaveLength(4);
    pairs.forEach((p) => {
      expect(p.pts).toBe(0);
      expect(p.gf).toBe(0);
      expect(p.gc).toBe(0);
      expect(p.gamesFor).toBe(0);
      expect(p.gamesAgainst).toBe(0);
      expect(p.played).toBe(0);
      expect(p.wins).toBe(0);
    });
  });
});

describe("buildLigaFixture — ida y vuelta", () => {
  test("duplica exactamente la cantidad de partidos y jornadas", () => {
    const ida = buildLigaFixture(pairsOf(6), false);
    const idaYVuelta = buildLigaFixture(pairsOf(6), true);
    expect(idaYVuelta.matches).toHaveLength(ida.matches.length * 2);
    expect(idaYVuelta.rounds).toHaveLength(ida.rounds.length * 2);
  });

  test("la jornada de vuelta espeja la ida con los lados invertidos", () => {
    const { matches, rounds } = buildLigaFixture(pairsOf(4), true);
    const half = rounds.length / 2;
    for (let r = 1; r <= half; r++) {
      const idaMatches = matches.filter((m) => m.round === r);
      const vueltaMatches = matches.filter((m) => m.round === r + half);
      expect(vueltaMatches).toHaveLength(idaMatches.length);
      idaMatches.forEach((im, i) => {
        expect(vueltaMatches[i].pairA.id).toBe(im.pairB.id);
        expect(vueltaMatches[i].pairB.id).toBe(im.pairA.id);
      });
    }
  });

  test("ninguna pareja se enfrenta más de 2 veces contra el mismo rival", () => {
    const { matches } = buildLigaFixture(pairsOf(5), true);
    const counts = {};
    matches.forEach((m) => {
      const key = [m.pairA.id, m.pairB.id].sort((a, b) => a - b).join("_");
      counts[key] = (counts[key] || 0) + 1;
    });
    Object.values(counts).forEach((c) => expect(c).toBe(2));
  });
});

// ═══════════════════════════════════════════════════════════════
// recomputeLigaStandings
// ═══════════════════════════════════════════════════════════════
describe("recomputeLigaStandings", () => {
  test("ignora partidos guardados con scoreA o scoreB inválidos", () => {
    const pairs = [pair(0), pair(1)];
    const matches = [
      {
        id: "m0",
        pairA: pair(0),
        pairB: pair(1),
        scoreA: "",
        scoreB: "no válido",
        saved: true,
        sets: [{ a: 6, b: 4 }],
      },
    ];

    const standings = recomputeLigaStandings(pairs, matches);

    standings.forEach((standing) => {
      expect(standing).toMatchObject({
        pts: 0,
        gf: 0,
        gc: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        played: 0,
        wins: 0,
      });
    });
  });

  test("sin partidos guardados, todos los standings quedan en cero", () => {
    const pairs = pairsOf(4);
    const { matches } = buildLigaFixture(pairs, false);
    const standings = recomputeLigaStandings(pairs, matches);
    standings.forEach((s) => {
      expect(s.pts).toBe(0);
      expect(s.played).toBe(0);
    });
  });

  test("victoria = 1 punto, derrota = 0 puntos, nunca fracciones ni empates", () => {
    const pairs = [pair(0), pair(1)];
    const matches = [
      {
        id: "m0",
        pairA: pair(0),
        pairB: pair(1),
        scoreA: "2",
        scoreB: "1",
        saved: true,
        sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 6, b: 2 }],
      },
    ];
    const standings = recomputeLigaStandings(pairs, matches);
    const a = standings.find((s) => s.id === 0);
    const b = standings.find((s) => s.id === 1);
    expect(a.pts).toBe(1);
    expect(b.pts).toBe(0);
    expect(a.wins).toBe(1);
    expect(b.wins).toBe(0);
  });

  test("gf/gc acumulan sets ganados/perdidos y gamesFor/gamesAgainst acumulan games reales", () => {
    const pairs = [pair(0), pair(1)];
    const matches = [
      {
        id: "m0",
        pairA: pair(0),
        pairB: pair(1),
        scoreA: "2",
        scoreB: "1",
        saved: true,
        sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 6, b: 2 }],
      },
    ];
    const standings = recomputeLigaStandings(pairs, matches);
    const a = standings.find((s) => s.id === 0);
    const b = standings.find((s) => s.id === 1);
    expect(a.gf).toBe(2);
    expect(a.gc).toBe(1);
    expect(a.gamesFor).toBe(15); // 6+3+6
    expect(a.gamesAgainst).toBe(12); // 4+6+2
    expect(b.gf).toBe(1);
    expect(b.gc).toBe(2);
  });

  test("es idempotente: llamarlo dos veces con el mismo estado da el mismo resultado", () => {
    const pairs = pairsOf(4);
    const { matches } = buildLigaFixture(pairs, false);
    const savedMatches = matches.map((m, i) =>
      i === 0 ? { ...m, scoreA: "2", scoreB: "0", saved: true, sets: [{ a: 6, b: 2 }, { a: 6, b: 3 }] } : m,
    );
    const first = recomputeLigaStandings(pairs, savedMatches);
    const second = recomputeLigaStandings(pairs, savedMatches);
    expect(second).toEqual(first);
  });

  test("al deshacer un resultado (saved: false), los acumulados vuelven a excluirlo", () => {
    const pairs = [pair(0), pair(1)];
    const saved = [
      { id: "m0", pairA: pair(0), pairB: pair(1), scoreA: "2", scoreB: "0", saved: true, sets: [{ a: 6, b: 2 }, { a: 6, b: 3 }] },
    ];
    const undone = [{ ...saved[0], saved: false }];
    const withResult = recomputeLigaStandings(pairs, saved);
    const withoutResult = recomputeLigaStandings(pairs, undone);
    expect(withResult.find((s) => s.id === 0).pts).toBe(1);
    expect(withoutResult.find((s) => s.id === 0).pts).toBe(0);
    expect(withoutResult.find((s) => s.id === 0).played).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildLigaKnockout
// ═══════════════════════════════════════════════════════════════
describe("buildLigaKnockout", () => {
  test("arma el bracket con el top N de la tabla ordenado por pts → gf-gc → gamesFor-gamesAgainst", () => {
    const standings = [
      pair(0, 3, 0, 0, 0, 0), // 3 pts
      pair(1, 2, 0, 0, 0, 0), // 2 pts
      pair(2, 2, 1, 0, 0, 0), // 2 pts, mejor gf-gc
      pair(3, 1, 0, 0, 0, 0), // 1 pt
    ];
    const bracket = buildLigaKnockout(standings, 2);
    const r1 = bracket.filter((m) => m.round === 1);
    const seeded = r1.flatMap((m) => [m.pairA, m.pairB]).filter(Boolean);
    // top 2 son id 0 y 2 (2 tiene mejor diferencia que 1 con mismos puntos)
    expect(seeded.map((p) => p.id).sort()).toEqual([0, 2]);
  });

  test("no muta el array de standings de entrada", () => {
    const standings = [pair(0, 3), pair(1, 1)];
    const snapshot = JSON.parse(JSON.stringify(standings));
    buildLigaKnockout(standings, 2);
    expect(standings).toEqual(snapshot);
  });
});

describe("ligaQualifierOptions", () => {
  test("con menos de 5 parejas solo pueden pasar 2", () => {
    [2, 3, 4].forEach((n) => expect(ligaQualifierOptions(n)).toEqual([2]));
  });
  test("con 5 a 8 parejas pueden pasar 2 o 4", () => {
    [5, 6, 8].forEach((n) => expect(ligaQualifierOptions(n)).toEqual([2, 4]));
  });
  test("con 9 o más parejas pueden pasar 2, 4 u 8", () => {
    [9, 10, 16].forEach((n) => expect(ligaQualifierOptions(n)).toEqual([2, 4, 8]));
  });
});

describe("ligaQualifiers", () => {
  test("respeta la elección si es válida", () => {
    expect(ligaQualifiers({ advanceQualifiers: 4 }, 6)).toBe(4);
    expect(ligaQualifiers({ advanceQualifiers: 8 }, 12)).toBe(8);
  });
  test("baja al máximo permitido si hay pocas parejas", () => {
    expect(ligaQualifiers({ advanceQualifiers: 4 }, 4)).toBe(2);
    expect(ligaQualifiers({ advanceQualifiers: 8 }, 6)).toBe(4);
  });
  test("sin elección usa 4 si se puede", () => {
    expect(ligaQualifiers({}, 6)).toBe(4);
    expect(ligaQualifiers({}, 3)).toBe(2);
  });
});

describe("reglas de la Liga según el formato de partido", () => {
  const rules = (config) => generateRules("liga", config).join(" ");
  test("sets: explica el mejor de 3 y desempata por sets y games", () => {
    const r = rules({ scoringFormat: "sets3" });
    expect(r).toContain("mejor de 3 sets");
    expect(r).toContain("diferencia de sets");
  });
  test("sin formato guardado se asume mejor de 3 sets", () => {
    expect(rules({})).toContain("mejor de 3 sets");
  });
  test("mejor de 5 sets", () => {
    expect(rules({ scoringFormat: "sets5" })).toContain("mejor de 5 sets");
  });
  test("por games: lo dice y no habla de sets", () => {
    const r = rules({ scoringFormat: "games", scoringSystem: "games", targetGames: 6 });
    expect(r).toContain("6 juegos");
    expect(r).not.toContain("sets");
  });
  test("la eliminatoria usa las parejas que realmente pasan", () => {
    const r = generateRules("liga", { scoringFormat: "sets3", playoffEnabled: true, advanceQualifiers: 8 }, { pairCount: 6 }).join(" ");
    expect(r).toContain("los 4 mejores");
  });
});
