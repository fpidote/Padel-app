import { describe, it, expect } from "vitest";
import {
  calcularDescansos,
  isCourtComplete,
  isRoundComplete,
  buildEmptyRound,
  availablePlayersForSlot,
  findRepeats,
  repeatedIdsByRound,
  repeatOffenders,
  manualPlaysSummary,
  repeatsToWarnings,
} from "./manualRounds";

const p = (id) => ({ id, name: `J${id}`, level: 0, pts: 0, gf: 0, gc: 0 });

describe("calcularDescansos", () => {
  it("devuelve los jugadores no asignados a ninguna cancha", () => {
    const players = [p(0), p(1), p(2), p(3), p(4), p(5)];
    const courts = [{ pairA: [p(0), p(1)], pairB: [p(2), p(3)] }];
    expect(calcularDescansos(players, courts).map((x) => x.id)).toEqual([4, 5]);
  });

  it("devuelve todos los jugadores si no hay canchas", () => {
    const players = [p(0), p(1)];
    expect(calcularDescansos(players, [])).toHaveLength(2);
  });

  it("ignora slots null al calcular asignados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const courts = [{ pairA: [p(0), null], pairB: [p(2), p(3)] }];
    expect(calcularDescansos(players, courts).map((x) => x.id)).toEqual([1]);
  });

  it("devuelve array vacío cuando todos están asignados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const courts = [{ pairA: [p(0), p(1)], pairB: [p(2), p(3)] }];
    expect(calcularDescansos(players, courts)).toHaveLength(0);
  });
});

describe("isCourtComplete", () => {
  it("devuelve true cuando los 4 slots tienen jugadores", () => {
    expect(isCourtComplete({ pairA: [p(0), p(1)], pairB: [p(2), p(3)] })).toBe(true);
  });

  it("devuelve false cuando algún slot es null", () => {
    expect(isCourtComplete({ pairA: [p(0), null], pairB: [p(2), p(3)] })).toBe(false);
  });

  it("devuelve false cuando ambos slots de un par son null", () => {
    expect(isCourtComplete({ pairA: [null, null], pairB: [p(2), p(3)] })).toBe(false);
  });
});

describe("isRoundComplete", () => {
  it("devuelve true cuando todas las canchas están completas", () => {
    const round = {
      courts: [
        { pairA: [p(0), p(1)], pairB: [p(2), p(3)] },
        { pairA: [p(4), p(5)], pairB: [p(6), p(7)] },
      ],
    };
    expect(isRoundComplete(round)).toBe(true);
  });

  it("devuelve false cuando alguna cancha tiene un slot null", () => {
    const round = {
      courts: [
        { pairA: [p(0), p(1)], pairB: [p(2), p(3)] },
        { pairA: [p(4), null], pairB: [p(6), p(7)] },
      ],
    };
    expect(isRoundComplete(round)).toBe(false);
  });
});

describe("buildEmptyRound", () => {
  it("crea N canchas con todos los slots en null", () => {
    const round = buildEmptyRound(3);
    expect(round.courts).toHaveLength(3);
    round.courts.forEach((c) => {
      expect(c.pairA).toEqual([null, null]);
      expect(c.pairB).toEqual([null, null]);
      expect(c.scoreA).toBe("");
      expect(c.scoreB).toBe("");
      expect(c.saved).toBe(false);
    });
  });
});

describe("availablePlayersForSlot", () => {
  it("retorna available con jugadores libres y assignedElsewhere con los ocupados", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toEqual([2, 3]);
    expect(assignedElsewhere.map((x) => x.id)).toEqual([0, 1]);
  });

  it("incluye el jugador actual del slot en available (no en assignedElsewhere)", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    round.courts[0].pairA[0] = p(0);
    round.courts[0].pairA[1] = p(1);
    round.courts[0].pairB[0] = p(2);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 0);
    expect(available.map((x) => x.id)).toContain(2);
    expect(assignedElsewhere.map((x) => x.id)).not.toContain(2);
    expect(assignedElsewhere.map((x) => x.id)).toEqual([0, 1]);
  });

  it("devuelve todos en available y assignedElsewhere vacío si la ronda está vacía", () => {
    const players = [p(0), p(1), p(2), p(3)];
    const round = buildEmptyRound(1);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairA", 0);
    expect(available).toHaveLength(4);
    expect(assignedElsewhere).toHaveLength(0);
  });

  it("prepende el jugador actual en available aunque no esté en la lista de jugadores", () => {
    const players = [p(0), p(1), p(2)];
    const round = buildEmptyRound(1);
    round.courts[0].pairB[1] = p(3);
    const { available, assignedElsewhere } = availablePlayersForSlot(players, round, 0, "pairB", 1);
    expect(available[0].id).toBe(3);
    expect(available).toHaveLength(4);
    expect(assignedElsewhere).toHaveLength(0);
  });
});

describe("repeticiones de rondas manuales", () => {
  const fede = { id: "T-MAN-01", name: "Fede" };
  const juan = { id: "T-MAN-02", name: "Juan" };
  const pedro = { id: "T-MAN-03", name: "Pedro" };
  const ana = { id: "T-MAN-04", name: "Ana" };
  const lucia = { id: "T-MAN-05", name: "Lucia" };
  const mario = { id: "T-MAN-06", name: "Mario" };
  const sara = { id: "T-MAN-07", name: "Sara" };
  const diego = { id: "T-MAN-08", name: "Diego" };
  const court = (pairA, pairB) => ({ pairA, pairB });
  const round = (...courts) => ({ courts });

  it("detecta rivales repetidos aunque cambie el compañero", () => {
    const repeats = findRepeats([
      round(court([fede, ana], [juan, pedro])),
      round(court([fede, pedro], [juan, lucia])),
    ]);

    expect(repeats.opponents).toEqual([
      { a: fede, b: juan, rounds: [1, 2] },
    ]);
  });

  it("detecta compañeros repetidos", () => {
    const repeats = findRepeats([
      round(court([fede, juan], [pedro, ana])),
      round(court([juan, fede], [lucia, mario])),
    ]);

    expect(repeats.partners).toEqual([
      { a: fede, b: juan, rounds: [1, 2] },
    ]);
  });

  it("ignora canchas incompletas y no crea falsos positivos", () => {
    const repeats = findRepeats([
      round(court([fede, juan], [pedro, ana])),
      round(court([fede, null], [pedro, ana])),
      round(court([lucia, mario], [sara, diego])),
    ]);

    expect(repeats.partners).toEqual([]);
    expect(repeats.opponents).toEqual([]);
  });

  it("no cuenta un mismo par contra sí mismo en una ronda", () => {
    const repeats = findRepeats([
      round(court([fede, juan], [fede, juan])),
      round(court([fede, ana], [juan, pedro])),
    ]);

    expect(repeats.opponents).toEqual([]);
  });

  it("agrupa ids repetidos y genera avisos desde la segunda ocurrencia", () => {
    const repeats = findRepeats([
      round(court([fede, juan], [pedro, ana])),
      round(court([fede, pedro], [juan, ana])),
      round(court([fede, juan], [pedro, ana])),
    ]);
    const ids = repeatedIdsByRound(repeats);

    expect(ids.get(1)).toEqual(new Set([fede.id, juan.id, pedro.id, ana.id]));
    // Un aviso por pareja de jugadores, no por cada vez que se repite, ordenados por ronda
    const warnings = repeatsToWarnings(repeats);
    expect(warnings).toContainEqual({ round: 3, times: 2, constraint: "partner_repeat", message: "Fede y Juan: compañeros en R1, R3" });
    expect(warnings).toContainEqual({ round: 3, times: 2, constraint: "opponent_repeat", message: "Fede y Pedro: rivales en R1, R3" });
    // Los que se repiten tres veces o más se marcan y salen primero
    expect(warnings[0].message).toMatch(/\(3 veces\)$/);
    // Primero los que más se repiten; a igualdad, por ronda
    expect(warnings.map((w) => w.times)).toEqual([...warnings.map((w) => w.times)].sort((a, b) => b - a));
  });

  describe("repeatOffenders", () => {
    it("marca solo las rondas donde se repite, no la primera coincidencia", () => {
      const repeats = findRepeats([
        round(court([fede, juan], [pedro, ana])),
        round(court([fede, pedro], [juan, ana])),
        round(court([fede, juan], [pedro, ana])),
      ]);
      const off = repeatOffenders(repeats);
      expect(off.has(1)).toBe(false);
      expect(off.get(3)).toEqual(new Set([fede.id, juan.id, pedro.id, ana.id]));
    });
  });

  describe("manualPlaysSummary", () => {
    const four = [fede, juan, pedro, ana];
    const extra = { id: 99, name: "Extra" };

    it("sin canchas completas no hay resumen", () => {
      expect(manualPlaysSummary(four, [])).toBeNull();
    });

    it("si todos juegan lo mismo lo dice", () => {
      const r = manualPlaysSummary(four, [round(court([fede, juan], [pedro, ana]))]);
      expect(r).toEqual({ equal: true, text: "Todos juegan 1 partido." });
    });

    it("con descansos desiguales dice quién juega menos", () => {
      const five = [...four, extra];
      const r = manualPlaysSummary(five, [
        round(court([fede, juan], [pedro, ana])),
        round(court([fede, extra], [pedro, ana])),
      ]);
      expect(r.equal).toBe(false);
      expect(r.text).toBe("3 jugadores jugarán 2 partidos y 2 jugarán 1.");
    });
  });
});
