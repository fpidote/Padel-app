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
  if (currentPlayer && !available.find((p) => p.id === currentPlayer.id)) {
    return [currentPlayer, ...available];
  }
  return available;
}
