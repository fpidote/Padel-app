// ── Liga Logic ───────────────────────────────────────────────
import { shuffle } from "./utils";
import { buildBracket } from "./relampago";

// Método del calendario (circle method): arma todas las rondas de un
// round-robin simple. Si `pairs` tiene cantidad impar, se usa un `null`
// interno como bye — nunca aparece en el output (esa pareja descansa esa ronda).
export function circleRoundRobin(pairs) {
  const n = pairs.length;
  if (n < 2) return [];

  const items = [...pairs];
  if (items.length % 2 !== 0) items.push(null);
  const size = items.length;
  const numRounds = size - 1;

  let arr = items;
  const rounds = [];
  for (let r = 0; r < numRounds; r++) {
    const matches = [];
    for (let i = 0; i < size / 2; i++) {
      const a = arr[i];
      const b = arr[size - 1 - i];
      if (a && b) matches.push({ pairA: a, pairB: b });
    }
    rounds.push(matches);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  return rounds;
}

// Arma el fixture completo de Liga (tabla única): rondas ida (o ida y vuelta,
// espejando la ida con los lados invertidos), lista plana de matches, y
// standings inicial en cero para cada pareja.
export function buildLigaFixture(pairs, idaYVuelta = false) {
  const shuffled = shuffle(pairs);
  const idaRounds = circleRoundRobin(shuffled);
  const vueltaRounds = idaYVuelta
    ? idaRounds.map((round) =>
        round.map(({ pairA, pairB }) => ({ pairA: pairB, pairB: pairA })),
      )
    : [];
  const allRounds = [...idaRounds, ...vueltaRounds];

  const rounds = allRounds.map((_, i) => ({ round: i + 1, date: null }));

  const matches = [];
  allRounds.forEach((roundMatches, ri) => {
    roundMatches.forEach((m, mi) => {
      matches.push({
        id: `r${ri + 1}_m${mi}`,
        round: ri + 1,
        pairA: m.pairA,
        pairB: m.pairB,
        scoreA: "",
        scoreB: "",
        saved: false,
        sets: null,
      });
    });
  });

  const standings = shuffled.map((p) => ({
    ...p,
    pts: 0,
    gf: 0,
    gc: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    played: 0,
    wins: 0,
  }));

  return { rounds, matches, pairs: standings };
}

// Recompute-from-scratch de standings a partir de los matches guardados.
// Puntos: 1 victoria, 0 derrota (sin empates — mejor de 3 sets siempre define ganador).
export function recomputeLigaStandings(pairs, matches) {
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
      if (
        m.scoreA === "" ||
        m.scoreB === "" ||
        (typeof m.scoreA !== "string" && typeof m.scoreA !== "number") ||
        (typeof m.scoreB !== "string" && typeof m.scoreB !== "number")
      ) {
        return;
      }

      const sa = Number(m.scoreA),
        sb = Number(m.scoreB);
      if (!Number.isInteger(sa) || !Number.isInteger(sb)) return;

      let ga = 0,
        gb = 0;
      if (m.sets) {
        m.sets.forEach((set) => {
          ga += parseInt(set.a || 0);
          gb += parseInt(set.b || 0);
        });
      }

      const idxA = standings.findIndex((s) => s.id === m.pairA.id);
      const idxB = standings.findIndex((s) => s.id === m.pairB.id);
      if (idxA >= 0) {
        standings[idxA].played++;
        standings[idxA].gf += sa;
        standings[idxA].gc += sb;
        standings[idxA].gamesFor += ga;
        standings[idxA].gamesAgainst += gb;
        standings[idxA].pts += sa > sb ? 1 : 0;
        if (sa > sb) standings[idxA].wins++;
      }
      if (idxB >= 0) {
        standings[idxB].played++;
        standings[idxB].gf += sb;
        standings[idxB].gc += sa;
        standings[idxB].gamesFor += gb;
        standings[idxB].gamesAgainst += ga;
        standings[idxB].pts += sb > sa ? 1 : 0;
        if (sb > sa) standings[idxB].wins++;
      }
    });

  return standings;
}

// Arma el bracket de playoff con el top `advanceQualifiers` de la tabla,
// usando el mismo orden de desempate que PairStandings.jsx (pts → gf-gc → gamesFor-gamesAgainst).
export function buildLigaKnockout(pairs, advanceQualifiers) {
  const sorted = [...pairs].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gf - b.gc !== a.gf - a.gc) return b.gf - b.gc - (a.gf - a.gc);
    return (
      (b.gamesFor || 0) - (b.gamesAgainst || 0) -
      ((a.gamesFor || 0) - (a.gamesAgainst || 0))
    );
  });
  return buildBracket(sorted.slice(0, advanceQualifiers), { consolation: false });
}
