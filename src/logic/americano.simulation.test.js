// src/logic/americano.simulation.test.js
// Test sin mock de shuffle — ejercita el algoritmo real con datos de producción
import { describe, test, expect } from "vitest";
import { precomputeAllRounds } from "./americano.js";
import { pk } from "./utils.js";

describe("Simulación — algoritmo de emparejamiento", () => {
  // T-SIM-01: escenario donde 0 repeticiones es matemáticamente fácil y el algoritmo
  // debe lograrlo siempre. C(8,2)=28 pares posibles, solo 6 usados en 3 rondas.
  test("T-SIM-01: cero repeticiones de pareja — 8 jugadores, 2 canchas, 3 rondas", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      name: `J${i}`,
      level: 0,
      pts: 0,
      gf: 0,
      gc: 0,
    }));

    const { rounds } = precomputeAllRounds(players, {
      courts: 2,
      mode: "individual",
      maxRounds: 3,
    });

    expect(rounds).toHaveLength(3);

    const partnerCounts = {};
    rounds.forEach((round) => {
      round.courts.forEach((court) => {
        const kA = pk(court.pairA[0].id, court.pairA[1].id);
        const kB = pk(court.pairB[0].id, court.pairB[1].id);
        partnerCounts[kA] = (partnerCounts[kA] || 0) + 1;
        partnerCounts[kB] = (partnerCounts[kB] || 0) + 1;
      });
    });

    const repeatedPairs = Object.entries(partnerCounts).filter(([, v]) => v > 1);
    expect(repeatedPairs).toHaveLength(0);
  });

  test("T-SIM-02: distribución equitativa de descansos — 9 jugadores, 2 canchas, 5 rondas", () => {
    const players = Array.from({ length: 9 }, (_, i) => ({
      id: i,
      name: `J${i}`,
      level: 0,
      pts: 0,
      gf: 0,
      gc: 0,
    }));

    const { rounds } = precomputeAllRounds(players, {
      courts: 2,
      mode: "individual",
      maxRounds: 5,
    });

    expect(rounds).toHaveLength(5);

    const restCounts = {};
    players.forEach((p) => { restCounts[p.id] = 0; });
    rounds.forEach((round) => {
      round.sittingOut.forEach((p) => {
        restCounts[p.id] = (restCounts[p.id] || 0) + 1;
      });
    });

    const counts = Object.values(restCounts);
    const maxRest = Math.max(...counts);
    const minRest = Math.min(...counts);
    expect(maxRest - minRest).toBeLessThanOrEqual(1);
  });
});
