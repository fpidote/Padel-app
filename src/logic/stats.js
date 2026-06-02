export function calculateStats(matches) {
  const stats = {};

  const ensure = (id) => {
    if (!stats[id]) {
      stats[id] = {
        matchesPlayed: 0,
        gamesWon:      0,
        gamesLost:     0,
        pointsFor:     0,
        pointsAgainst: 0,
        pointsDiff:    0,
        winRate:       0,
      };
    }
    return stats[id];
  };

  for (const m of matches) {
    const { teamA, teamB, result } = m;
    const { scoreA, scoreB, winningSide } = result;
    const winTeam  = winningSide === "A" ? teamA : teamB;
    const loseTeam = winningSide === "A" ? teamB : teamA;
    const winScore  = winningSide === "A" ? scoreA : scoreB;
    const loseScore = winningSide === "A" ? scoreB : scoreA;

    for (const id of winTeam.playerIds) {
      const s = ensure(id);
      s.matchesPlayed++;
      s.gamesWon++;
      s.pointsFor     += winScore;
      s.pointsAgainst += loseScore;
    }

    for (const id of loseTeam.playerIds) {
      const s = ensure(id);
      s.matchesPlayed++;
      s.gamesLost++;
      s.pointsFor     += loseScore;
      s.pointsAgainst += winScore;
    }
  }

  for (const s of Object.values(stats)) {
    s.pointsDiff = s.pointsFor - s.pointsAgainst;
    s.winRate    = s.matchesPlayed > 0 ? s.gamesWon / s.matchesPlayed : 0;
  }

  return stats;
}
