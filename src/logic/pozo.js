// ── El Pozo Logic ────────────────────────────────────────────
export function buildPozoRound(pairs, courts) {
  const sorted = [...pairs].sort(
    (a, b) => b.pts - a.pts || b.courtLevel - a.courtLevel,
  );
  const assigned = [];
  for (let c = 0; c < courts; c++) {
    const pA = sorted[c * 2] || null;
    const pB = sorted[c * 2 + 1] || null;
    assigned.push({
      courtNum: c + 1,
      pairA: pA,
      pairB: pB,
      scoreA: "",
      scoreB: "",
      saved: false,
    });
  }
  return assigned;
}

// Aplica los resultados de una ronda y devuelve un nuevo array de parejas
// con pts/gf/gc actualizados y courtLevel corregido para la siguiente ronda.
//
// Invariante: winner.courtLevel > loser.courtLevel del mismo match.
// El ganador sube 1 cancha (hacia la cancha del rey), el perdedor baja 1.
// courtLevel es un tiebreaker descendente: mayor valor = mejor cancha.
export function applyPozoRoundResults(pairs, currentRound, courts) {
  const updated = pairs.map((p) => ({ ...p }));

  currentRound.forEach((court) => {
    const a = parseInt(court.scoreA);
    const b = parseInt(court.scoreB);
    const winner = a > b ? court.pairA : court.pairB;
    const loser  = a > b ? court.pairB : court.pairA;

    if (winner) {
      const idx = updated.findIndex((p) => p.id === winner.id);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          pts: updated[idx].pts + 1,
          gf:  updated[idx].gf + Math.max(a, b),
          gc:  updated[idx].gc + Math.min(a, b),
          // Sube 1 nivel: siempre courts + 1 - courtNum (garantiza winner.cl > loser.cl)
          courtLevel: courts + 1 - court.courtNum,
        };
      }
    }

    if (loser) {
      const idx = updated.findIndex((p) => p.id === loser.id);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          gf: updated[idx].gf + Math.min(a, b),
          gc: updated[idx].gc + Math.max(a, b),
          // Baja 1 nivel: siempre courts - 1 - courtNum
          courtLevel: courts - 1 - court.courtNum,
        };
      }
    }
  });

  return updated;
}

export function shufflePlayers(players, numCourts) {
  const sorted = [...players].sort(
    (a, b) => b.pts - a.pts || b.courtLevel - a.courtLevel,
  );
  const activeCourts = Math.min(numCourts, Math.floor(sorted.length / 4));
  const active       = sorted.slice(0, activeCourts * 4);
  const unassigned   = sorted.slice(activeCourts * 4).map((p) => p.id);

  const courts = [];
  for (let c = 0; c < activeCourts; c++) {
    const group = active.slice(c * 4, c * 4 + 4);
    courts.push({
      courtNum: c + 1,
      teamA: { playerIds: [group[0].id, group[1].id] },
      teamB: { playerIds: [group[2].id, group[3].id] },
    });
  }

  return { courts, unassigned };
}

export function isProposedRoundValid(proposedRound) {
  if (proposedRound.unassigned.length > 0) return false;
  const seen = new Set();
  for (const court of proposedRound.courts) {
    const ids = [...court.teamA.playerIds, ...court.teamB.playerIds];
    if (ids.length !== 4) return false;
    for (const id of ids) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  return true;
}

// updatedTempPairs: resultado de applyPozoRoundResults sobre temp pairs.
// Cada temp pair debe tener _playerIds: [string, string].
// currentRound: array de canchas en formato { pairA, pairB, scoreA, scoreB }.
export function distributePairLevelToPlayers(updatedTempPairs, players, currentRound) {
  const updated = players.map((p) => ({ ...p }));

  for (const court of currentRound) {
    const a = parseInt(court.scoreA);
    const b = parseInt(court.scoreB);
    const winnerTempId = a > b ? court.pairA.id : court.pairB.id;
    const loserTempId  = a > b ? court.pairB.id : court.pairA.id;
    const winScore  = Math.max(a, b);
    const loseScore = Math.min(a, b);

    const winner = updatedTempPairs.find((p) => p.id === winnerTempId);
    const loser  = updatedTempPairs.find((p) => p.id === loserTempId);

    if (winner) {
      for (const playerId of winner._playerIds) {
        const idx = updated.findIndex((p) => p.id === playerId);
        if (idx < 0) continue;
        updated[idx] = {
          ...updated[idx],
          pts:        updated[idx].pts + 1,
          gf:         updated[idx].gf + winScore,
          gc:         updated[idx].gc + loseScore,
          courtLevel: winner.courtLevel,
        };
      }
    }

    if (loser) {
      for (const playerId of loser._playerIds) {
        const idx = updated.findIndex((p) => p.id === playerId);
        if (idx < 0) continue;
        updated[idx] = {
          ...updated[idx],
          gf:         updated[idx].gf + loseScore,
          gc:         updated[idx].gc + winScore,
          courtLevel: loser.courtLevel,
        };
      }
    }
  }

  return updated;
}
