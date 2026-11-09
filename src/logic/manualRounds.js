import { pk } from "./utils";

export function calcularDescansos(entities, courts) {
  const assigned = new Set();
  courts.forEach((c) => {
    [...(c.pairA || []), ...(c.pairB || [])].forEach((p) => {
      if (p) assigned.add(p.id);
    });
  });
  return entities.filter((p) => !assigned.has(p.id));
}

export function isCourtComplete(court) {
  return (
    Array.isArray(court?.pairA) && court.pairA.length === 2 && court.pairA.every(Boolean) &&
    Array.isArray(court?.pairB) && court.pairB.length === 2 && court.pairB.every(Boolean)
  );
}

export function isRoundComplete(round) {
  return round.courts.every(isCourtComplete);
}

export function buildEmptyRound(numCourts) {
  return {
    courts: Array.from({ length: numCourts }, () => ({
      pairA: [null, null],
      pairB: [null, null],
      scoreA: "",
      scoreB: "",
      saved: false,
    })),
    sittingOut: [],
  };
}

export function availablePlayersForSlot(players, round, courtIdx, pairKey, slotIdx) {
  const usedIds = new Set();
  round.courts.forEach((court, ci) => {
    ["pairA", "pairB"].forEach((pk) => {
      court[pk].forEach((player, si) => {
        if (player && !(ci === courtIdx && pk === pairKey && si === slotIdx)) {
          usedIds.add(player.id);
        }
      });
    });
  });
  const currentPlayer = round.courts[courtIdx][pairKey][slotIdx];
  const available = players.filter((p) => !usedIds.has(p.id));
  const assignedElsewhere = players.filter((p) => usedIds.has(p.id));
  // Jugador actual eliminado del torneo pero aún en el slot
  if (
    currentPlayer &&
    !available.find((p) => p.id === currentPlayer.id) &&
    !assignedElsewhere.find((p) => p.id === currentPlayer.id)
  ) {
    return { available: [currentPlayer, ...available], assignedElsewhere };
  }
  return { available, assignedElsewhere };
}

export function findRepeats(rounds) {
  const partners = new Map();
  const opponents = new Map();

  rounds.forEach((round, roundIndex) => {
    const roundNumber = roundIndex + 1;
    (round.courts || []).forEach((court) => {
      if (!isCourtComplete(court)) return;

      const [a1, a2] = court.pairA;
      const [b1, b2] = court.pairB;
      const partnerKey = pk(a1.id, a2.id);
      const opponentKeys = [
        [a1, b1],
        [a1, b2],
        [a2, b1],
        [a2, b2],
      ];

      if (!partners.has(partnerKey)) {
        partners.set(partnerKey, { a: a1, b: a2, rounds: [] });
      }
      const partnerRounds = partners.get(partnerKey).rounds;
      if (!partnerRounds.includes(roundNumber)) partnerRounds.push(roundNumber);

      const pairAKey = pk(a1.id, a2.id);
      const pairBKey = pk(b1.id, b2.id);
      opponentKeys.forEach(([a, b]) => {
        if (a.id === b.id || pairAKey === pairBKey) return;
        const key = pk(a.id, b.id);
        if (!opponents.has(key)) {
          opponents.set(key, { a, b, rounds: [] });
        }
        const opponentRounds = opponents.get(key).rounds;
        if (!opponentRounds.includes(roundNumber)) opponentRounds.push(roundNumber);
      });
    });
  });

  return {
    partners: [...partners.values()].filter(({ rounds: occurrences }) => occurrences.length >= 2),
    opponents: [...opponents.values()].filter(({ rounds: occurrences }) => occurrences.length >= 2),
  };
}

export function repeatedIdsByRound(repeats) {
  const result = new Map();
  ["partners", "opponents"].forEach((type) => {
    repeats[type].forEach(({ a, b, rounds }) => {
      rounds.forEach((round) => {
        if (!result.has(round)) result.set(round, new Set());
        result.get(round).add(a.id);
        result.get(round).add(b.id);
      });
    });
  });
  return result;
}

export function repeatsToWarnings(repeats) {
  const warnings = [];
  [
    ["partners", "partner_repeat", "fueron compañeros"],
    ["opponents", "opponent_repeat", "se enfrentaron"],
  ].forEach(([type, constraint, verb]) => {
    repeats[type].forEach(({ a, b, rounds }) => {
      rounds.slice(1).forEach((round, index) => {
        warnings.push({
          round,
          constraint,
          message: `Ronda ${round}: ${a.name} y ${b.name} ya ${verb} en la ronda ${rounds[index]}`,
        });
      });
    });
  });
  return warnings;
}

// Jugadores implicados en una repetición, solo en las rondas donde se repite (no en la primera vez que coincidieron):
// son las rondas que conviene tocar. Map<número de ronda 1-based, Set<id>>.
export function repeatOffenders(repeats) {
  const result = new Map();
  ["partners", "opponents"].forEach((type) => {
    repeats[type].forEach(({ a, b, rounds }) => {
      rounds.slice(1).forEach((round) => {
        if (!result.has(round)) result.set(round, new Set());
        result.get(round).add(a.id);
        result.get(round).add(b.id);
      });
    });
  });
  return result;
}

// Cuántos partidos juega cada jugador con las rondas armadas (solo canchas completas).
// Devuelve null si aún no hay partidos; si no, { equal, text } con la frase para el organizador.
export function manualPlaysSummary(players, rounds) {
  const plays = new Map(players.map((p) => [p.id, 0]));
  rounds.forEach((round) => {
    (round.courts || []).forEach((court) => {
      if (!isCourtComplete(court)) return;
      [...court.pairA, ...court.pairB].forEach((p) => {
        if (plays.has(p.id)) plays.set(p.id, plays.get(p.id) + 1);
      });
    });
  });
  const counts = [...plays.values()];
  if (!counts.length || counts.every((n) => n === 0)) return null;
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const games = (n) => (n === 1 ? "partido" : "partidos");
  if (min === max) return { equal: true, text: `Todos juegan ${max} ${games(max)}.` };
  const minCount = counts.filter((n) => n === min).length;
  const maxCount = counts.filter((n) => n === max).length;
  if (minCount + maxCount < counts.length) return { equal: false, text: `Los partidos por jugador van de ${min} a ${max}.` };
  const noun = (n) => (n === 1 ? "jugador" : "jugadores");
  const verb = (n) => (n === 1 ? "jugará" : "jugarán");
  return {
    equal: false,
    text: `${maxCount} ${noun(maxCount)} ${verb(maxCount)} ${max} ${games(max)} y ${minCount} ${verb(minCount)} ${min}.`,
  };
}
