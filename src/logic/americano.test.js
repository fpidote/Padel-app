import { describe, test, expect, vi } from "vitest";
import {
  buildFirstRoundAmericano,
  buildRoundAmericano,
  precomputeAllRounds,
} from "./americano.js";

// shuffle es no-determinista — la mockeamos para que devuelva el array intacto
vi.mock("./utils.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shuffle: (arr) => [...arr] };
});

// ── Helpers ──────────────────────────────────────────────────
const p = (id, level = 0, pts = 0, gf = 0, gc = 0) => ({
  id,
  name: `P${id}`,
  level,
  pts,
  gf,
  gc,
});
const par = (id) => ({ id, name: `Par${id}` });

// ═══════════════════════════════════════════════════════════════
// buildFirstRoundAmericano — modo pairs
// ═══════════════════════════════════════════════════════════════
describe("buildFirstRoundAmericano — pairs", () => {
  // T9: schema del output
  test("T9: cada cancha tiene pairA, pairB, scoreA vacío, scoreB vacío y saved=false", () => {
    const pairs = [par("p1"), par("p2")];
    const result = buildFirstRoundAmericano(pairs, 1, "pairs");

    expect(result.courts).toHaveLength(1);
    const court = result.courts[0];
    expect(court).toHaveProperty("pairA");
    expect(court).toHaveProperty("pairB");
    expect(court.scoreA).toBe("");
    expect(court.scoreB).toBe("");
    expect(court.saved).toBe(false);
  });

  // T7: 2 parejas, 1 cancha — fit perfecto
  test("T7: con 2 parejas y 1 cancha, ninguna pareja se sienta", () => {
    const pairs = [par("p1"), par("p2")];
    const { courts, sittingOut } = buildFirstRoundAmericano(pairs, 1, "pairs");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(0);
  });

  // T8: 3 parejas, 1 cancha — una se sienta
  test("T8: con 3 parejas y 1 cancha, una pareja se sienta", () => {
    const pairs = [par("p1"), par("p2"), par("p3")];
    const { courts, sittingOut } = buildFirstRoundAmericano(pairs, 1, "pairs");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildFirstRoundAmericano — modo individual
// ═══════════════════════════════════════════════════════════════
describe("buildFirstRoundAmericano — individual", () => {
  // T1: 4 jugadores, 1 cancha — emparejamiento 1°+4° vs 2°+3°
  test("T1: empareja al primero con el cuarto y al segundo con el tercero por nivel", () => {
    const players = [
      p("A", 4),
      p("B", 3),
      p("C", 2),
      p("D", 1),
    ];
    const { courts, sittingOut } = buildFirstRoundAmericano(players, 1, "individual");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(0);
    const court = courts[0];
    // 1°(lv4)+4°(lv1) vs 2°(lv3)+3°(lv2)
    expect(court.pairA.map((x) => x.id).sort()).toEqual(["A", "D"]);
    expect(court.pairB.map((x) => x.id).sort()).toEqual(["B", "C"]);
  });

  // T2: 6 jugadores, 1 cancha — los 2 de menor nivel se sientan
  test("T2: con 6 jugadores y 1 cancha, los 2 de menor nivel se sientan", () => {
    const players = [
      p("A", 5), p("B", 4), p("C", 3),
      p("D", 2), p("E", 1), p("F", 0),
    ];
    const { courts, sittingOut } = buildFirstRoundAmericano(players, 1, "individual");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(2);
    const sitIds = sittingOut.map((x) => x.id).sort();
    expect(sitIds).toEqual(["E", "F"]);
  });

  // T3: 8 jugadores, 2 canchas — agrupación correcta por cancha
  test("T3: con 8 jugadores y 2 canchas cada cancha recibe su grupo de 4 por nivel", () => {
    const players = [
      p("A", 8), p("B", 7), p("C", 6), p("D", 5),
      p("E", 4), p("F", 3), p("G", 2), p("H", 1),
    ];
    const { courts, sittingOut } = buildFirstRoundAmericano(players, 2, "individual");

    expect(courts).toHaveLength(2);
    expect(sittingOut).toHaveLength(0);
    // Cancha 0: grupo [A,B,C,D] → pairA=[A,D], pairB=[B,C]
    expect(courts[0].pairA.map((x) => x.id).sort()).toEqual(["A", "D"]);
    expect(courts[0].pairB.map((x) => x.id).sort()).toEqual(["B", "C"]);
    // Cancha 1: grupo [E,F,G,H] → pairA=[E,H], pairB=[F,G]
    expect(courts[1].pairA.map((x) => x.id).sort()).toEqual(["E", "H"]);
    expect(courts[1].pairB.map((x) => x.id).sort()).toEqual(["F", "G"]);
  });

  // T4: más canchas que grupos posibles
  test("T4: con 4 jugadores y 5 canchas solo se activa 1 cancha", () => {
    const players = [p("A", 4), p("B", 3), p("C", 2), p("D", 1)];
    const { courts, sittingOut } = buildFirstRoundAmericano(players, 5, "individual");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(0);
  });

  // T5: jugadores sin campo level
  test("T5: jugadores sin campo level no lanzan error y producen output válido", () => {
    const players = [
      { id: "A", name: "PA" },
      { id: "B", name: "PB" },
      { id: "C", name: "PC" },
      { id: "D", name: "PD" },
    ];
    expect(() => buildFirstRoundAmericano(players, 1, "individual")).not.toThrow();
    const { courts } = buildFirstRoundAmericano(players, 1, "individual");
    expect(courts).toHaveLength(1);
  });

  // T6: 5 jugadores, 1 cancha — el de menor nivel se sienta
  test("T6: con 5 jugadores y 1 cancha, el de menor nivel queda en sittingOut", () => {
    const players = [
      p("A", 5), p("B", 4), p("C", 3), p("D", 2), p("E", 1),
    ];
    const { sittingOut } = buildFirstRoundAmericano(players, 1, "individual");

    expect(sittingOut).toHaveLength(1);
    expect(sittingOut[0].id).toBe("E");
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoundAmericano — ordenamiento y clasificación
// ═══════════════════════════════════════════════════════════════
describe("buildRoundAmericano — ordenamiento", () => {
  // T12: todos con pts=0
  test("T12: con todos los jugadores en pts=0 produce una ronda válida sin lanzar error", () => {
    const players = [p(1), p(2), p(3), p(4)];
    expect(() => buildRoundAmericano(players, 1, {}, {}, "individual")).not.toThrow();
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");
    expect(courts).toHaveLength(1);
  });

  // T10: ordenado por pts
  test("T10: los jugadores con más pts quedan en la primera cancha", () => {
    const players = [p(3, 0, 1), p(1, 0, 3), p(4, 0, 0), p(2, 0, 2)];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const ids = [
      ...courts[0].pairA.map((x) => x.id),
      ...courts[0].pairB.map((x) => x.id),
    ].sort();
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  // T11: desempate por diferencia de juegos
  test("T11: cuando pts son iguales, el de mayor diferencia de juegos (gf-gc) queda primero", () => {
    const players = [
      p(1, 0, 2, 5, 2), // pts=2, gf-gc=3
      p(2, 0, 2, 3, 3), // pts=2, gf-gc=0
      p(3, 0, 0),
      p(4, 0, 0),
    ];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const allPlayers = [...courts[0].pairA, ...courts[0].pairB];
    const idx1 = allPlayers.findIndex((x) => x.id === 1);
    const idx2 = allPlayers.findIndex((x) => x.id === 2);
    expect(idx1).toBeLessThan(idx2);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoundAmericano — selección de quién se sienta
// ═══════════════════════════════════════════════════════════════
describe("buildRoundAmericano — sitting out", () => {
  // T13: 5 jugadores, sin historial — el de menor pts se sienta
  test("T13: con 5 jugadores y soh vacío, el de menor pts se sienta", () => {
    const players = [p(1, 0, 4), p(2, 0, 3), p(3, 0, 2), p(4, 0, 1), p(5, 0, 0)];
    const { sittingOut } = buildRoundAmericano(players, 1, {}, {}, "individual");

    expect(sittingOut).toHaveLength(1);
    expect(sittingOut[0].id).toBe(5);
  });

  // T14: equidad — quien ya se sentó tiene prioridad para jugar
  test("T14: el jugador con mayor soh del pool del fondo no se sienta de nuevo", () => {
    const players = [p(1, 0, 4), p(2, 0, 3), p(3, 0, 2), p(4, 0, 1), p(5, 0, 0)];
    // jugador 5 ya se sentó 1 vez; jugador 4 nunca se sentó
    const soh = { 5: 1 };
    const { sittingOut } = buildRoundAmericano(players, 1, {}, soh, "individual");

    expect(sittingOut).toHaveLength(1);
    expect(sittingOut[0].id).toBe(4);
  });

  // T15: todos los candidatos con igual soh — alguien del fondo se sienta
  test("T15: con soh igual para todos, alguien de los últimos del ranking se sienta", () => {
    const players = [p(1, 0, 4), p(2, 0, 3), p(3, 0, 2), p(4, 0, 1), p(5, 0, 0)];
    const soh = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    const { sittingOut, courts } = buildRoundAmericano(players, 1, {}, soh, "individual");

    expect(sittingOut).toHaveLength(1);
    expect(courts).toHaveLength(1);
    // El que se sienta debe ser alguien del fondo (4 o 5), no 1 ni 2
    expect([4, 5]).toContain(sittingOut[0].id);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoundAmericano — evitar repetición de parejas (ph)
// ═══════════════════════════════════════════════════════════════
describe("buildRoundAmericano — historial de parejas (ph)", () => {
  // T18: ph vacío — no lanza error
  test("T18: con ph vacío produce output válido sin error", () => {
    const players = [p(1), p(2), p(3), p(4)];
    expect(() => buildRoundAmericano(players, 1, {}, {}, "individual")).not.toThrow();
  });

  // T16: el par (1,2) ya jugó junto — bestSplit evita esa pareja
  // NOTA: pk() usa Math.min/max → los IDs deben ser numéricos
  test("T16: si el par (1,2) ya jugó junto, no los pone en la misma pareja", () => {
    const players = [p(1, 0, 3), p(2, 0, 2), p(3, 0, 1), p(4, 0, 0)];
    const ph = { "1_2": 1 }; // pk(1,2) = "1_2"
    const { courts } = buildRoundAmericano(players, 1, ph, {}, "individual");

    const pairs = [courts[0].pairA, courts[0].pairB];
    const pairIds = pairs.map((pair) =>
      [Math.min(pair[0].id, pair[1].id), Math.max(pair[0].id, pair[1].id)].join("_")
    );
    expect(pairIds).not.toContain("1_2");
  });

  // T17: todos los splits tienen repetición — elige el de menor penalización
  test("T17: cuando todos los splits tienen parejas repetidas, elige el de menor penalización", () => {
    // Todos los pares posibles han jugado juntos al menos 1 vez
    const players = [p(1, 0, 3), p(2, 0, 2), p(3, 0, 1), p(4, 0, 0)];
    const ph = { "1_2": 2, "3_4": 1, "1_3": 1, "2_4": 1, "1_4": 1, "2_3": 1 };
    // El split con menor penalización es [[1,3],[2,4]] o [[1,4],[2,3]] (ph=2 vs ph=2)
    // Mientras que [[1,2],[3,4]] tiene ph["1_2"]=2 → score=20+10=30 > otros
    const { courts } = buildRoundAmericano(players, 1, ph, {}, "individual");

    const pairs = [courts[0].pairA, courts[0].pairB];
    const pairIds = pairs.map((pair) =>
      [Math.min(pair[0].id, pair[1].id), Math.max(pair[0].id, pair[1].id)].join("_")
    );
    // El peor split (1_2 con ph=2) no debe ser elegido si hay alternativas mejores
    expect(pairIds).not.toContain("1_2");
  });

  // T27: penalización por diferencia de nivel — elige la pareja que minimiza diferencia
  test("T27: sin historial de parejas, empareja minimizando diferencia de nivel", () => {
    // Los 4 players: A(lv4), B(lv3), C(lv2), D(lv1) — mismos pts
    // Split 1°+4° vs 2°+3° tiene menor penalty de nivel (|4-1|=3, |3-2|=1 → score=12)
    // Split 1°+2° vs 3°+4° tiene mayor penalty (|4-3|=1, |2-1|=1 → score=6)
    // Espera que bestSplit elija el split con menor score total
    const players = [
      p("A", 4, 3), p("B", 3, 2), p("C", 2, 1), p("D", 1, 0),
    ];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const pairIds = [courts[0].pairA, courts[0].pairB].map(
      (pair) => pair.map((x) => x.id).sort().join("+")
    );
    // El split con menor penalización de nivel: A+B vs C+D (diff 1 y 1) o A+C vs B+D (diff 2 y 2)
    // NO debe ser A+D vs B+C (diff 3 y 1 = score 12) cuando hay alternativas mejores
    // Mejor opción: A+B (diff=1) vs C+D (diff=1) → score total de nivel = 6 (1*3 + 1*3)
    expect(pairIds).toContain("A+B");
    expect(pairIds).toContain("C+D");
  });
});

// ═══════════════════════════════════════════════════════════════
// buildRoundAmericano — modo pairs
// ═══════════════════════════════════════════════════════════════
describe("buildRoundAmericano — pairs", () => {
  // T19: 4 parejas, 2 canchas — asignadas por ranking
  test("T19: con 4 parejas y 2 canchas, la pareja de más pts juega en cancha 0", () => {
    const pairs = [
      par("p1"), par("p2"), par("p3"), par("p4"),
    ].map((pr, i) => ({ ...pr, pts: 4 - i, gf: 0, gc: 0 }));
    const { courts } = buildRoundAmericano(pairs, 2, {}, {}, "pairs");

    expect(courts).toHaveLength(2);
    expect(courts[0].pairA.id).toBe("p1");
    expect(courts[0].pairB.id).toBe("p2");
  });

  // T20: 3 parejas, 2 canchas (solo 1 activa)
  test("T20: con 3 parejas y 2 canchas, solo 1 cancha se activa y 1 pareja se sienta", () => {
    const pairs = [par("p1"), par("p2"), par("p3")].map((pr, i) => ({
      ...pr,
      pts: 3 - i,
      gf: 0,
      gc: 0,
    }));
    const { courts, sittingOut } = buildRoundAmericano(pairs, 2, {}, {}, "pairs");

    expect(courts).toHaveLength(1);
    expect(sittingOut).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// precomputeAllRounds
// ═══════════════════════════════════════════════════════════════
describe("precomputeAllRounds", () => {
  const players6 = [
    p("A", 6, 0), p("B", 5, 0), p("C", 4, 0),
    p("D", 3, 0), p("E", 2, 0), p("F", 1, 0),
  ];

  // T21: sin maxRounds, 6 jugadores → min(5,12)=5 rondas
  test("T21: sin maxRounds con 6 jugadores genera min(n-1, 12) rondas", () => {
    const rounds = precomputeAllRounds(players6, { courts: 1, mode: "individual" });
    expect(rounds).toHaveLength(5);
  });

  // T22: sin maxRounds, 14 jugadores → capped en 12
  test("T22: con 14 jugadores sin maxRounds el resultado se limita a 12 rondas", () => {
    const players14 = Array.from({ length: 14 }, (_, i) => p(`P${i}`, i));
    const rounds = precomputeAllRounds(players14, { courts: 3, mode: "individual" });
    expect(rounds).toHaveLength(12);
  });

  // T23: maxRounds override
  test("T23: cuando maxRounds=3, se generan exactamente 3 rondas", () => {
    const rounds = precomputeAllRounds(players6, {
      courts: 1,
      mode: "individual",
      maxRounds: 3,
    });
    expect(rounds).toHaveLength(3);
  });

  // T24: la primera ronda usa ordenamiento por nivel (buildFirstRoundAmericano)
  test("T24: la ronda 0 empareja por nivel (1°+4° vs 2°+3°), no por pts", () => {
    const rounds = precomputeAllRounds(players6, { courts: 1, mode: "individual" });
    const court0 = rounds[0].courts[0];
    // players6 ordenados por nivel: A(6)>B(5)>C(4)>D(3)>E(2)>F(1)
    // Activos en cancha 0: A,B,C,D → pairA=[A,D], pairB=[B,C]
    expect(court0.pairA.map((x) => x.id).sort()).toEqual(["A", "D"]);
    expect(court0.pairB.map((x) => x.id).sort()).toEqual(["B", "C"]);
  });

  // T25: ph se acumula — en ronda 2, la pareja de ronda 1 se evita
  test("T25: en la segunda ronda las parejas de la primera ronda no se repiten", () => {
    const players = [p("A", 4), p("B", 3), p("C", 2), p("D", 1)].map((pl, i) => ({
      ...pl,
      pts: i, // distintos pts para que el sort cambie
    }));
    const rounds = precomputeAllRounds(players, { courts: 1, mode: "individual", maxRounds: 2 });

    const r0pairs = [
      rounds[0].courts[0].pairA.map((x) => x.id).sort().join("_"),
      rounds[0].courts[0].pairB.map((x) => x.id).sort().join("_"),
    ];
    const r1pairs = [
      rounds[1].courts[0].pairA.map((x) => x.id).sort().join("_"),
      rounds[1].courts[0].pairB.map((x) => x.id).sort().join("_"),
    ];
    // Ninguna pareja de ronda 1 debe repetirse en ronda 2
    for (const pair of r0pairs) {
      expect(r1pairs).not.toContain(pair);
    }
  });

  // T26: soh se acumula — quien se sentó en ronda 1 no se sienta en ronda 2
  test("T26: quien se sentó en la ronda 1 tiene prioridad para jugar en ronda 2", () => {
    const players = [
      p("A", 0, 4), p("B", 0, 3), p("C", 0, 2),
      p("D", 0, 1), p("E", 0, 0),
    ];
    const rounds = precomputeAllRounds(players, {
      courts: 1,
      mode: "individual",
      maxRounds: 2,
    });

    const sitR1 = rounds[0].sittingOut.map((x) => x.id);
    const sitR2 = rounds[1].sittingOut.map((x) => x.id);
    // El jugador que se sentó en ronda 1 no debe sentarse en ronda 2
    for (const id of sitR1) {
      expect(sitR2).not.toContain(id);
    }
  });
});
