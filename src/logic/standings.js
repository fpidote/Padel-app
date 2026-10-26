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

// Relámpago acumula 1 pt por victoria y no tiene campo wins
export const winsOf = (p) => p.wins ?? p.pts ?? 0;

export function compareStandings(a, b) {
  const winsA = winsOf(a);
  const winsB = winsOf(b);
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

// Suma (sign=1) o resta (sign=-1) el resultado de un partido a los acumulados de las parejas
export function applyMatchToPairs(pairs, match, a, b, sets, sign) {
  let ga = 0;
  let gb = 0;
  (sets || []).forEach((set) => {
    ga += parseInt(set.a || 0);
    gb += parseInt(set.b || 0);
  });
  const next = [...pairs];
  [
    [match.pairA, a, b, ga, gb],
    [match.pairB, b, a, gb, ga],
  ].forEach(([pair, sf, sc, jf, jc]) => {
    if (!pair) return;
    const idx = next.findIndex((p) => p.id === pair.id);
    if (idx < 0) return;
    const won = sf > sc ? 1 : 0;
    next[idx] = {
      ...next[idx],
      pts: next[idx].pts + sign * won,
      played: Math.max(0, (next[idx].played || 0) + sign),
      gf: next[idx].gf + sign * sf,
      gc: next[idx].gc + sign * sc,
      gamesFor: (next[idx].gamesFor || 0) + sign * jf,
      gamesAgainst: (next[idx].gamesAgainst || 0) + sign * jc,
    };
  });
  return next;
}
