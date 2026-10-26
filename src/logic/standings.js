// ── Standings compartidos (Mundialito, tablas generales) ─────
// Criterio: 1º partidos ganados, 2º enfrentamiento directo entre las igualadas (si se pasan
// los partidos), 3º diferencia a favor y en contra (gf − gc), 4º diferencia de games.
// En formato por games o puntos, gf/gc ya son esa unidad y el 4º criterio queda en 0.

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

// Victorias de cada pareja de `run` contando solo los partidos jugados entre ellas.
function winsAmong(run, matches) {
  const ids = new Set(run.map((p) => p.id));
  const wins = new Map(run.map((p) => [p.id, 0]));
  matches.forEach((m) => {
    if (!m.saved || !m.pairA || !m.pairB) return;
    if (!ids.has(m.pairA.id) || !ids.has(m.pairB.id)) return;
    const sa = parseInt(m.scoreA);
    const sb = parseInt(m.scoreB);
    if (sa > sb) wins.set(m.pairA.id, wins.get(m.pairA.id) + 1);
    else if (sb > sa) wins.set(m.pairB.id, wins.get(m.pairB.id) + 1);
  });
  return wins;
}

// Orden: 1º victorias, 2º victorias en los partidos entre las igualadas (enfrentamiento
// directo), 3º diferencia de sets/games a favor y en contra, 4º diferencia de games.
// Si no se pasan `matches` el enfrentamiento directo no interviene.
export function sortStandings(standings, matches = []) {
  const byWins = [...standings].sort((a, b) => winsOf(b) - winsOf(a));
  if (!matches.length) return [...standings].sort(compareStandings);

  const result = [];
  for (let i = 0; i < byWins.length; ) {
    let j = i + 1;
    while (j < byWins.length && winsOf(byWins[j]) === winsOf(byWins[i])) j++;
    const run = byWins.slice(i, j);
    if (run.length > 1) {
      const direct = winsAmong(run, matches);
      run.sort((a, b) => direct.get(b.id) - direct.get(a.id) || compareStandings(a, b));
    }
    result.push(...run);
    i = j;
  }
  return result;
}

// Siglas de las columnas de la tabla según cómo se anota el partido, para que la tabla diga
// "puntos" cuando se cuentan puntos y "games" cuando se cuentan games.
export function standingsLabels(config = {}) {
  const cfg = config || {};
  if (cfg.scoringFormat === "sets3" || cfg.scoringFormat === "sets5") {
    return {
      unit: "sets",
      plus: "S+",
      minus: "S−",
      diff: "DS",
      gamesDiff: "DG",
      legend: "PJ jugados · PG ganados · S+ sets a favor · S− en contra · DS dif. de sets · DG dif. de games",
    };
  }
  const system = cfg.scoringSystem || "timed";
  const countsPoints = system === "rally" || (system === "timed" && cfg.timedMetric === "points");
  if (countsPoints) {
    return {
      unit: "points",
      plus: "P+",
      minus: "P−",
      diff: "DP",
      gamesDiff: null,
      legend: "PJ jugados · PG ganados · P+ puntos a favor · P− en contra · DP diferencia",
    };
  }
  return {
    unit: "games",
    plus: "G+",
    minus: "G−",
    diff: "DG",
    gamesDiff: null,
    legend: "PJ jugados · PG ganados · G+ games a favor · G− en contra · DG diferencia",
  };
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
