import { TOURNAMENT_TYPES } from "./constants";

export function buildInitialTournament(type, ownerUid) {
  const base = {
    ver: 1,
    status: "setup",
    type,
    ownerUid,
    config: {
      name: `Torneo ${TOURNAMENT_TYPES.find((x) => x.id === type).name}`,
      courts: 2,
    },
  };

  const inits = {
    americano: {
      ...base,
      config: { ...base.config, courts: 3, mode: "individual" },
      playerInputs: Array(12)
        .fill(null)
        .map((_, i) => ({ name: `Jugador ${i + 1}`, level: i % 2 === 0 ? 1 : 2 })),
      pairInputs: Array(6)
        .fill(null)
        .map((_, i) => ({
          id: i,
          p1: `Jugador ${i * 2 + 1}`,
          p2: `Jugador ${i * 2 + 2}`,
          pts: 0,
          gf: 0,
          gc: 0,
        })),
      players: [],
      pairs: [],
      rounds: [],
      currentRound: null,
      sittingOut: [],
      partnerHistory: {},
      sitOutHistory: {},
      roundNum: 1,
    },
    relampago: {
      ...base,
      pairInputs: Array(8)
        .fill(null)
        .map((_, i) => ({
          id: i,
          p1: `Jugador ${i * 2 + 1}`,
          p2: `Jugador ${i * 2 + 2}`,
          pts: 0,
          gf: 0,
          gc: 0,
        })),
      bracket: null,
      phase: "setup",
    },
    mundialito: {
      ...base,
      config: { ...base.config, groupCount: 2, advancePerGroup: 2 },
      pairInputs: Array(8)
        .fill(null)
        .map((_, i) => ({
          id: i,
          p1: `Jugador ${i * 2 + 1}`,
          p2: `Jugador ${i * 2 + 2}`,
          pts: 0,
          gf: 0,
          gc: 0,
        })),
      groups: null,
      knockoutBracket: null,
      phase: "setup",
    },
    pozo: {
      ...base,
      pairInputs: Array(8)
        .fill(null)
        .map((_, i) => ({
          id: i,
          p1: `Jugador ${i * 2 + 1}`,
          p2: `Jugador ${i * 2 + 2}`,
          pts: 0,
          gf: 0,
          gc: 0,
          courtLevel: 0,
        })),
      pozoRounds: [],
      currentPozoRound: null,
      roundNum: 1,
      phase: "setup",
      timerSeconds: 600,
      timerRunning: false,
      timerStartedAt: null,
      timerElapsed: 0,
    },
  };

  return inits[type];
}
