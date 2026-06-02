import { describe, test, expect } from "vitest";
import { calculateStats } from "./stats.js";

const match = (teamAIds, teamBIds, scoreA, scoreB, mode = "fixed") => ({
  roundNum: 1,
  courtNum: 1,
  mode,
  teamA: { playerIds: teamAIds, pairId: null, courtLevelBefore: 0, courtLevelAfter: 0 },
  teamB: { playerIds: teamBIds, pairId: null, courtLevelBefore: 0, courtLevelAfter: 0 },
  result: {
    scoreA,
    scoreB,
    winningSide: scoreA > scoreB ? "A" : "B",
  },
});

describe("calculateStats", () => {
  test("array vacío devuelve objeto vacío", () => {
    expect(calculateStats([])).toEqual({});
  });

  test("ganador acumula gamesWon=1 y perdedor gamesLost=1", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].gamesWon).toBe(1);
    expect(stats["p1"].gamesLost).toBe(0);
    expect(stats["p3"].gamesWon).toBe(0);
    expect(stats["p3"].gamesLost).toBe(1);
  });

  test("pointsFor y pointsAgainst correctos para ambos lados", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].pointsFor).toBe(6);
    expect(stats["p1"].pointsAgainst).toBe(3);
    expect(stats["p3"].pointsFor).toBe(3);
    expect(stats["p3"].pointsAgainst).toBe(6);
  });

  test("pointsDiff es pointsFor - pointsAgainst", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].pointsDiff).toBe(3);
    expect(stats["p3"].pointsDiff).toBe(-3);
  });

  test("winRate es 1.0 tras ganar todos los matches", () => {
    const matches = [
      match(["p1", "p2"], ["p3", "p4"], 6, 3),
      match(["p1", "p2"], ["p5", "p6"], 6, 4),
    ];
    const stats = calculateStats(matches);
    expect(stats["p1"].winRate).toBe(1);
    expect(stats["p1"].matchesPlayed).toBe(2);
  });

  test("winRate es 0.5 con 1 victoria y 1 derrota", () => {
    const matches = [
      match(["p1", "p2"], ["p3", "p4"], 6, 3),
      match(["p3", "p4"], ["p1", "p2"], 6, 4),
    ];
    const stats = calculateStats(matches);
    expect(stats["p1"].gamesWon).toBe(1);
    expect(stats["p1"].gamesLost).toBe(1);
    expect(stats["p1"].matchesPlayed).toBe(2);
    expect(stats["p1"].winRate).toBe(0.5);
  });

  test("ambos jugadores del equipo ganador reciben las mismas stats", () => {
    const stats = calculateStats([match(["p1", "p2"], ["p3", "p4"], 6, 3)]);
    expect(stats["p1"].gamesWon).toBe(stats["p2"].gamesWon);
    expect(stats["p1"].pointsFor).toBe(stats["p2"].pointsFor);
  });

  test("funciona con mode mixer — misma lógica, distintos playerIds", () => {
    const stats = calculateStats([match(["alice", "bob"], ["carol", "dave"], 6, 2, "mixer")]);
    expect(stats["alice"].gamesWon).toBe(1);
    expect(stats["carol"].gamesLost).toBe(1);
  });
});
