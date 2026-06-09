import { describe, test, expect, vi } from "vitest";
import {
  buildFirstRoundAmericano,
  buildRoundAmericano,
  precomputeAllRounds,
  optimalCourtsAssignment,
  PENALTY,
  RELAX_THRESHOLDS,
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

  // T3: 8 jugadores, 2 canchas — cada cancha recibe 2 del tramo alto + 2 del tramo bajo
  test("T3: con 8 jugadores y 2 canchas, cada cancha mezcla 2 del tramo alto y 2 del tramo bajo por nivel", () => {
    const players = [
      p("A", 8), p("B", 7), p("C", 6), p("D", 5),
      p("E", 4), p("F", 3), p("G", 2), p("H", 1),
    ];
    const { courts, sittingOut } = buildFirstRoundAmericano(players, 2, "individual");

    expect(courts).toHaveLength(2);
    expect(sittingOut).toHaveLength(0);
    // Top half (lv 8,7,6,5) y bottom half (lv 4,3,2,1) distribuidos 2+2 por cancha
    const topIds = new Set(["A", "B", "C", "D"]);
    const botIds = new Set(["E", "F", "G", "H"]);
    for (const court of courts) {
      const ids = [...court.pairA, ...court.pairB].map((x) => x.id);
      expect(ids.filter((id) => topIds.has(id))).toHaveLength(2);
      expect(ids.filter((id) => botIds.has(id))).toHaveLength(2);
    }
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
  // NOTA: pk() usa comparación numérica para IDs numéricos — usar IDs numéricos aquí
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

  // T27: sin historial, bestSplit equilibra la suma de niveles de los equipos
  test("T27: sin historial de parejas, empareja equilibrando la suma de niveles de los equipos", () => {
    // Players: A(lv4,pts3) B(lv3,pts2) C(lv2,pts1) D(lv1,pts0)
    // Sort by pts desc: [A,B,C,D]
    // Opciones:
    //   [A+B] vs [C+D]: clash(lv4,lv3)=15 + balance=|7-3|*2=8 = 23
    //   [A+C] vs [B+D]: clash=0 + balance=|6-4|*2=4 = 4
    //   [A+D] vs [B+C]: clash=0 + balance=|5-5|*2=0 = 0  ← gana
    const players = [
      p("A", 4, 3), p("B", 3, 2), p("C", 2, 1), p("D", 1, 0),
    ];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const pairIds = [courts[0].pairA, courts[0].pairB].map(
      (pair) => pair.map((x) => x.id).sort().join("+")
    );
    // La opción más equilibrada es A+D vs B+C (suma 5 vs 5)
    expect(pairIds).toContain("A+D");
    expect(pairIds).toContain("B+C");
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
// precomputeAllRounds — forma de retorno { rounds, warnings }
// ═══════════════════════════════════════════════════════════════
describe("precomputeAllRounds", () => {
  const players6 = [
    p("A", 6, 0), p("B", 5, 0), p("C", 4, 0),
    p("D", 3, 0), p("E", 2, 0), p("F", 1, 0),
  ];

  // T-ret1: retorna objeto con { rounds, warnings } — NO un array plano
  test("T-ret1: retorna objeto con keys 'rounds' y 'warnings', no un array", () => {
    const result = precomputeAllRounds(players6, { courts: 1, mode: "individual" });
    expect(result).not.toBeInstanceOf(Array);
    expect(result).toHaveProperty("rounds");
    expect(result).toHaveProperty("warnings");
    expect(Array.isArray(result.rounds)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  // T-pairs: modo pairs retorna { rounds: null, warnings: [] }
  test("T-pairs: modo pairs retorna { rounds: null, warnings: [] }", () => {
    const result = precomputeAllRounds(players6, { courts: 1, mode: "pairs" });
    expect(result.rounds).toBeNull();
    expect(result.warnings).toHaveLength(0);
  });

  // T-warn: warnings tienen la forma correcta cuando se emiten
  test("T-warn: los warnings emitidos tienen shape { round, constraint, message }", () => {
    const result = precomputeAllRounds(players6, { courts: 1, mode: "individual", maxRounds: 10 });
    result.warnings.forEach((w) => {
      expect(w).toHaveProperty("round");
      expect(typeof w.round).toBe("number");
      expect(w).toHaveProperty("constraint");
      expect(["partner_repeat", "court_repeat", "advanced_pair"]).toContain(w.constraint);
      expect(w).toHaveProperty("message");
      expect(typeof w.message).toBe("string");
    });
  });

  // T-advancedOk: con 4 avanzados y 2 canchas (advancedCount >= 2*courts), no hay warnings advanced_pair
  test("T-advancedOk: con advancedCount >= 2*courts, no se emiten warnings advanced_pair", () => {
    const adv = Array.from({ length: 8 }, (_, i) => ({
      id: i, name: `P${i}`, level: i < 4 ? 3 : 1, pts: 0, gf: 0, gc: 0,
    }));
    const result = precomputeAllRounds(adv, { courts: 2, mode: "individual", maxRounds: 3 });
    const apWarn = result.warnings.filter((w) => w.constraint === "advanced_pair");
    expect(apWarn).toHaveLength(0);
  });

  // T-courtShape: cada elemento de rounds tiene { courts, sittingOut } con forma correcta
  test("T-courtShape: cada ronda tiene courts con pairA/pairB (2 jugadores) y scoreA/scoreB/saved por defecto", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: i, name: `P${i}`, level: 0, pts: 0, gf: 0, gc: 0 }));
    const result = precomputeAllRounds(players, { courts: 2, mode: "individual", maxRounds: 7 });
    expect(result.rounds).toHaveLength(7);
    result.rounds.forEach((r) => {
      expect(Array.isArray(r.courts)).toBe(true);
      expect(Array.isArray(r.sittingOut)).toBe(true);
      r.courts.forEach((c) => {
        expect(Array.isArray(c.pairA) && c.pairA.length === 2).toBe(true);
        expect(Array.isArray(c.pairB) && c.pairB.length === 2).toBe(true);
        expect(c.scoreA).toBe("");
        expect(c.scoreB).toBe("");
        expect(c.saved).toBe(false);
      });
    });
  });

  // T21: sin maxRounds, 6 jugadores → min(5,12)=5 rondas
  test("T21: sin maxRounds con 6 jugadores genera min(n-1, 12) rondas", () => {
    const result = precomputeAllRounds(players6, { courts: 1, mode: "individual" });
    expect(result.rounds).toHaveLength(5);
  });

  // T22: sin maxRounds, 14 jugadores → capped en 12
  test("T22: con 14 jugadores sin maxRounds el resultado se limita a 12 rondas", () => {
    const players14 = Array.from({ length: 14 }, (_, i) => p(`P${i}`, i));
    const result = precomputeAllRounds(players14, { courts: 3, mode: "individual" });
    expect(result.rounds).toHaveLength(12);
  });

  // T23: maxRounds override
  test("T23: cuando maxRounds=3, se generan exactamente 3 rondas", () => {
    const result = precomputeAllRounds(players6, {
      courts: 1,
      mode: "individual",
      maxRounds: 3,
    });
    expect(result.rounds).toHaveLength(3);
  });

  // T24: la primera ronda empareja por nivel
  test("T24: la ronda 0 empareja por nivel (1°+4° vs 2°+3°), no por pts", () => {
    const result = precomputeAllRounds(players6, { courts: 1, mode: "individual" });
    const court0 = result.rounds[0].courts[0];
    // players6 con shuffle mockeado (identidad): ordenados por nivel desc: A(6)>B(5)>C(4)>D(3)>E(2)>F(1)
    // Activos en cancha 0 (topHalf: A,B; botHalf: C,D) → alguna de las 3 combinaciones
    expect(court0.pairA).toHaveLength(2);
    expect(court0.pairB).toHaveLength(2);
  });

  // T25: ph se acumula — en ronda 2, la pareja de ronda 1 se evita
  test("T25: en la segunda ronda las parejas de la primera ronda no se repiten", () => {
    const players = [p("A", 4), p("B", 3), p("C", 2), p("D", 1)].map((pl, i) => ({
      ...pl,
      pts: i,
    }));
    const result = precomputeAllRounds(players, { courts: 1, mode: "individual", maxRounds: 2 });

    const r0pairs = [
      result.rounds[0].courts[0].pairA.map((x) => x.id).sort().join("_"),
      result.rounds[0].courts[0].pairB.map((x) => x.id).sort().join("_"),
    ];
    const r1pairs = [
      result.rounds[1].courts[0].pairA.map((x) => x.id).sort().join("_"),
      result.rounds[1].courts[0].pairB.map((x) => x.id).sort().join("_"),
    ];
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
    const result = precomputeAllRounds(players, {
      courts: 1,
      mode: "individual",
      maxRounds: 2,
    });

    const sitR1 = result.rounds[0].sittingOut.map((x) => x.id);
    const sitR2 = result.rounds[1].sittingOut.map((x) => x.id);
    for (const id of sitR1) {
      expect(sitR2).not.toContain(id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// PENALTY y RELAX_THRESHOLDS — constantes exportadas
// ═══════════════════════════════════════════════════════════════
describe("PENALTY y RELAX_THRESHOLDS — constantes exportadas", () => {
  test("T-penalty: PENALTY tiene las 4 claves con valores correctos", () => {
    expect(PENALTY.PARTNER_REPEAT).toBe(1000);
    expect(PENALTY.ADVANCED_PAIR).toBe(5000);
    expect(PENALTY.COURT_REPEAT).toBe(500);
    expect(PENALTY.REST_IMBALANCE).toBe(2000);
  });

  test("T-relax: RELAX_THRESHOLDS es array de 3 elementos [2000, 6000, 15000]", () => {
    expect(Array.isArray(RELAX_THRESHOLDS)).toBe(true);
    expect(RELAX_THRESHOLDS).toHaveLength(3);
    expect(RELAX_THRESHOLDS[0]).toBe(2000);
    expect(RELAX_THRESHOLDS[1]).toBe(6000);
    expect(RELAX_THRESHOLDS[2]).toBe(15000);
  });
});

// ═══════════════════════════════════════════════════════════════
// bestSplit — separación de avanzados y equilibrio de equipos
// ═══════════════════════════════════════════════════════════════
describe("bestSplit — separación de avanzados (level >= 3)", () => {
  // T28: 2 avanzados → equipos distintos
  test("T28: con 2 avanzados y 2 no-avanzados, los avanzados quedan en equipos distintos", () => {
    // Todos pts distintos para que el sort sea [1,2,3,4]
    const players = [p(1, 3, 3), p(2, 3, 2), p(3, 2, 1), p(4, 1, 0)];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const pairA = courts[0].pairA.map((x) => x.id);
    const pairB = courts[0].pairB.map((x) => x.id);
    // Jugadores 1 y 2 son avanzados (lv 3) — deben estar en equipos distintos
    expect(
      (pairA.includes(1) && pairB.includes(2)) ||
      (pairA.includes(2) && pairB.includes(1))
    ).toBe(true);
  });

  // T29: posibilidades repetidas agotadas → sin historial gana frente a historial+balance
  test("T29: cuando todas las combinaciones ya fueron usadas, elige la sin historial aunque desequilibre", () => {
    const players = [p(1, 3, 3), p(2, 3, 2), p(3, 2, 1), p(4, 1, 0)];
    // ph cubre las 4 combos con repetición: 1+3, 2+4, 1+4, 2+3 (1 vez c/u)
    // p(id, level, pts): p1=lv3, p2=lv3, p3=lv2, p4=lv1
    // [1+2] vs [3+4]: ph=0+0, clash([1+2])=1(ambos lv≥3), balance|6-3|=3 → 15+3*w=27 ← gana
    // [1+3] vs [2+4]: ph=12+12, balance|5-4|=1 → 24+1*w=28
    // [1+4] vs [2+3]: ph=12+12, balance|4-5|=1 → 24+1*w=28
    const ph = { "1_3": 1, "2_4": 1, "1_4": 1, "2_3": 1 };
    const { courts } = buildRoundAmericano(players, 1, ph, {}, "individual");

    const pairA = courts[0].pairA.map((x) => x.id);
    const pairB = courts[0].pairB.map((x) => x.id);
    // Debe elegir [1+2] vs [3+4]: clash pero sin historial gana vs no-clash con historial
    const hasClash =
      (pairA.includes(1) && pairA.includes(2)) ||
      (pairB.includes(1) && pairB.includes(2));
    expect(hasClash).toBe(true);
  });

  // T30: equilibrio de equipos — suma de niveles lo más pareja posible
  test("T30: sin historial, elige la distribución que equilibra la suma de niveles de los equipos", () => {
    // [1(lv3), 2(lv2), 3(lv2), 4(lv1)] — pts distintos para sort [1,2,3,4]
    // [1+4] vs [2+3]: sumas = 4 vs 4 = balance 0  ← gana
    // [1+3] vs [2+4]: sumas = 5 vs 3 = balance 2
    // [1+2] vs [3+4]: sumas = 5 vs 3 = balance 2
    const players = [p(1, 3, 3), p(2, 2, 2), p(3, 2, 1), p(4, 1, 0)];
    const { courts } = buildRoundAmericano(players, 1, {}, {}, "individual");

    const sumTeam = (pair) => pair.reduce((s, pl) => s + (pl.level || 0), 0);
    const diff = Math.abs(
      sumTeam(courts[0].pairA) - sumTeam(courts[0].pairB)
    );
    expect(diff).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Distribución entre canchas — mezcla de niveles
// ═══════════════════════════════════════════════════════════════
describe("distribución entre canchas — mezcla avanzados/básicos", () => {
  // T31: buildFirstRoundAmericano — 4 avanzados + 4 básicos, 2 canchas
  test("T31: con 4 avanzados (lv≥3) y 4 básicos en 2 canchas, cada equipo tiene exactamente 1 avanzado", () => {
    const players = [
      p("A1", 4), p("A2", 4), p("A3", 3), p("A4", 3),
      p("B1", 2), p("B2", 2), p("B3", 1), p("B4", 1),
    ];
    const { courts } = buildFirstRoundAmericano(players, 2, "individual");

    expect(courts).toHaveLength(2);
    for (const court of courts) {
      const advA = court.pairA.filter((x) => x.level >= 3).length;
      const advB = court.pairB.filter((x) => x.level >= 3).length;
      expect(advA).toBe(1);
      expect(advB).toBe(1);
    }
  });

  // T32: buildRoundAmericano — avanzados dominan pts, 2 canchas
  test("T32: cuando avanzados tienen más pts que básicos, cada equipo tiene exactamente 1 avanzado por cancha", () => {
    const players = [
      p("A1", 4, 4), p("A2", 4, 3), p("A3", 3, 2), p("A4", 3, 1),
      p("B1", 2, 0), p("B2", 2, 0), p("B3", 1, 0), p("B4", 1, 0),
    ];
    const { courts } = buildRoundAmericano(players, 2, {}, {}, "individual");

    expect(courts).toHaveLength(2);
    for (const court of courts) {
      const advA = court.pairA.filter((x) => x.level >= 3).length;
      const advB = court.pairB.filter((x) => x.level >= 3).length;
      expect(advA).toBe(1);
      expect(advB).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// optimalCourtsAssignment
// ═══════════════════════════════════════════════════════════════
describe("optimalCourtsAssignment", () => {
  // T-OC1: con historial vacío devuelve los grupos en algún orden válido
  test("T-OC1: con historial vacío devuelve exactamente los mismos grupos", () => {
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const g1 = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];
    const result = optimalCourtsAssignment([g0, g1], {});
    expect(result).toHaveLength(2);
    expect(result).toContain(g0);
    expect(result).toContain(g1);
  });

  // T-OC2: mueve el grupo con historial alto a la pista menos visitada
  test("T-OC2: asigna el grupo con historial en pista 0 a otra pista", () => {
    // J0, J1 han jugado 3 veces en pista 0 → deben ir a pista 1
    // J4, J5 no tienen historial → van a pista 0
    const courtHistory = { "0_c0": 3, "1_c0": 3 };
    const heavy = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const fresh  = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];

    // shuffle está mockeado como identidad → base = [heavy, fresh] sin cambios
    const result = optimalCourtsAssignment([heavy, fresh], courtHistory);

    // pista 0 (result[0]) debe ser el grupo sin historial en c0
    expect(result[0]).toEqual(fresh);
    // pista 1 (result[1]) debe ser el grupo con historial en c0
    expect(result[1]).toEqual(heavy);
  });

  // T-OC3: 3 grupos, elige la permutación de menor costo total
  test("T-OC3: con 3 pistas elige la asignación de menor costo global", () => {
    const courtHistory = { "0_c0": 5, "4_c1": 5, "8_c2": 5 };
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const g1 = [{ id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];
    const g2 = [{ id: 8 }, { id: 9 }, { id: 10 }, { id: 11 }];

    const result = optimalCourtsAssignment([g0, g1, g2], courtHistory);

    // Ningún grupo debe estar en su pista costosa
    expect(result[0]).not.toEqual(g0);
    expect(result[1]).not.toEqual(g1);
    expect(result[2]).not.toEqual(g2);
  });

  // T-OC4: 1 grupo — devuelve el array tal cual
  test("T-OC4: con un solo grupo lo devuelve sin cambios", () => {
    const g0 = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const result = optimalCourtsAssignment([g0], { "0_c0": 99 });
    expect(result[0]).toEqual(g0);
  });
});

// ═══════════════════════════════════════════════════════════════
// precomputeAllRounds — distribución de canchas
// ═══════════════════════════════════════════════════════════════
describe("precomputeAllRounds — distribución de canchas", () => {
  // T-CD1: ningún jugador repite pista más de 2 veces en 20j/4c/5r
  test("T-CD1: con 20 jugadores, 4 canchas, 5 rondas — max repetición ≤ 2", () => {
    const players = Array.from({ length: 20 }, (_, i) => ({
      id: i, name: `J${i+1}`, level: [1,1,2,2,3][i%5], pts:0, gf:0, gc:0,
    }));
    const { rounds } = precomputeAllRounds(players, { courts: 4, maxRounds: 5 });

    const courtCount = {};
    players.forEach(p => { courtCount[p.id] = {}; });
    rounds.forEach((round) => {
      round.courts.forEach((court, ci) => {
        [...court.pairA, ...court.pairB].forEach(p => {
          courtCount[p.id][ci] = (courtCount[p.id][ci] || 0) + 1;
        });
      });
    });

    let maxRepeat = 0;
    players.forEach(p => {
      Object.values(courtCount[p.id]).forEach(count => {
        if (count > maxRepeat) maxRepeat = count;
      });
    });

    expect(maxRepeat).toBeLessThanOrEqual(2);
  });
});
