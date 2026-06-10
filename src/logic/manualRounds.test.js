import { describe, it, expect } from "vitest";
import {
  calcularDescansos,
  isCourtComplete,
  isRoundComplete,
  buildEmptyRound,
  availablePlayersForSlot,
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
