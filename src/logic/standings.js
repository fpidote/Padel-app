// ── Standings compartidos (Mundialito, tablas generales) ─────
// Criterio: 1º partidos ganados, 2º diferencia de sets (gf − gc), 3º diferencia de juegos.
// En formato por games, gf/gc ya son juegos y el 3er criterio queda en 0.

export function computeStandings(pairs, matches) {
  const standings = pairs.map((p) => ({
    ...p,
    pts: 0,
    gf: 0,
    gc: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    played: 0,
    wins: 0,
  }));

  matches
    .filter((m) => m.saved)
    .forEach((m) => {
      const sa = parseInt(m.scoreA);
      const sb = parseInt(m.scoreB);

      let ga = 0;
      let gb = 0;
      if (m.sets) {
        m.sets.forEach((set) => {
          ga += parseInt(set.a || 0);
          gb += parseInt(set.b || 0);
        });
      }

      const a = standings.find((s) => s.id === m.pairA.id);
      const b = standings.find((s) => s.id === m.pairB.id);
      if (a) {
        a.played++;
        a.gf += sa;
        a.gc += sb;
        a.gamesFor += ga;
        a.gamesAgainst += gb;
        if (sa > sb) {
          a.wins++;
          a.pts += 3;
        }
      }
      if (b) {
        b.played++;
        b.gf += sb;
        b.gc += sa;
        b.gamesFor += gb;
        b.gamesAgainst += ga;
        if (sb > sa) {
          b.wins++;
          b.pts += 3;
        }
      }
    });

  return standings;
}

export function compareStandings(a, b) {
  // Relámpago acumula 1 pt por victoria sin campo wins
  const winsA = a.wins ?? a.pts ?? 0;
  const winsB = b.wins ?? b.pts ?? 0;
  if (winsB !== winsA) return winsB - winsA;
  const setDiffA = a.gf - a.gc;
  const setDiffB = b.gf - b.gc;
  if (setDiffB !== setDiffA) return setDiffB - setDiffA;
  return (
    (b.gamesFor || 0) -
    (b.gamesAgainst || 0) -
    ((a.gamesFor || 0) - (a.gamesAgainst || 0))
  );
}

export function sortStandings(standings) {
  return [...standings].sort(compareStandings);
}
