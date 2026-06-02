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
