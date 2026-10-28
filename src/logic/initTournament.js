import { TOURNAMENT_TYPES } from "./constants";

// "Torneo Americano", pero "Torneo por grupos" ya empieza por Torneo
function defaultName(type) {
  const name = TOURNAMENT_TYPES.find((x) => x.id === type).name;
  return /^torneo\b/i.test(name) ? name : `Torneo ${name}`;
}

export function buildInitialTournament(type, ownerUid) {
  const base = {
    ver: 1,
    status: "setup",
    type,
    ownerUid,
    config: {
      name: defaultName(type),
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
        courts: 2,
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
      config: { ...base.config, pozoMode: "fixed", targetRounds: null },
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
    liga: {
      ...base,
      config: {
        ...base.config,
        scoringFormat: "sets3",
        idaYVuelta: false,
        playoffEnabled: false,
        advanceQualifiers: 4,
        seasonMode: "single",
      },
      pairInputs: [],
      pairs: [],
      rounds: [],
      matches: [],
      knockoutBracket: null,
      phase: "setup",
    },
  };

  return inits[type];
}
