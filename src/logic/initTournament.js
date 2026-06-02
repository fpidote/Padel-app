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
      scoringSystem: "timed",
      matchMinutes: 10,
      rallyPoints: 24,
      targetGames: 6,
      goldenPoint: true,
      timedMetric: "games",
      useLevels: false,
      description: "",
      datetime: null,
      location: "",
    },
  };

  const inits = {
    americano: {
      ...base,
      config: {
        ...base.config,
        courts: 3,
        mode: "individual",
        matchmaking: "americano",
        maxRounds: null,
      },
      playerInputs: [],
      pairInputs: [],
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
      pairInputs: [],
      bracket: null,
      phase: "setup",
    },
    mundialito: {
      ...base,
      config: { ...base.config, groupCount: 2, advancePerGroup: 2 },
      pairInputs: [],
      groups: null,
      knockoutBracket: null,
      phase: "setup",
    },
    pozo: {
      ...base,
      config: { ...base.config, pozoMode: "fixed" },
      pairInputs: [],
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
