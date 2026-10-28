// ── Liga Logic ───────────────────────────────────────────────
import { shuffle } from "./utils";
import { buildBracket, hasPlayedRealMatch, bracketComplete } from "./relampago";
import { sortStandings } from "./standings";

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

// Arma el bracket de playoff con el top `advanceQualifiers` de la tabla, con el mismo orden que la
// tabla de posiciones (victorias → enfrentamiento directo → diferencia → games).
export function buildLigaKnockout(pairs, advanceQualifiers, matches = [], { thirdPlace = false } = {}) {
  const sorted = sortStandings(pairs, matches);
  return buildBracket(sorted.slice(0, advanceQualifiers), { consolation: false, thirdPlace });
}

// Cuántas parejas pueden pasar a la eliminatoria según cuántas juegan la liga: con menos de 5 solo
// 2, con 5 o más hasta 4, y con 9 o más hasta 8.
export function ligaQualifierOptions(pairCount) {
  if (pairCount >= 9) return [2, 4, 8];
  if (pairCount >= 5) return [2, 4];
  return [2];
}

// Parejas que pasan realmente: la elección del organizador, bajada al máximo que permite la cantidad
// de parejas (por si se quitaron parejas después de elegir).
export function ligaQualifiers(config, pairCount) {
  const options = ligaQualifierOptions(pairCount);
  const wanted = config?.advanceQualifiers ?? 4;
  return Math.max(...options.filter((n) => n <= wanted));
}

// ¿Se juega el partido por el 3.º y 4.º puesto? Solo con eliminatoria, la opción activada y semifinales
// (4 clasificados o más).
export function ligaThirdPlace(config, pairCount) {
  return !!config?.playoffEnabled && !!config?.thirdPlace && ligaQualifiers(config, pairCount) >= 4;
}

// Los resultados de la liga se cierran al iniciar la eliminatoria: a partir de ahí el cuadro depende
// de la tabla y modificarla lo dejaría incoherente.
export function ligaResultsLocked(t) {
  return t?.phase === "playoff" || t?.status === "finished";
}

// Se puede volver a la fase de liga mientras no se haya jugado ningún partido real de la eliminatoria
// (los pasa directo que se resuelven solos no cuentan).
export function canReopenLiga(t) {
  return t?.status !== "finished" && t?.phase === "playoff" && !hasPlayedRealMatch(t.knockoutBracket);
}

export function reopenLigaPatch() {
  return { knockoutBracket: null, phase: "fixture" };
}

// Eliminar un resultado: deja el partido como si no se hubiera jugado (Editar, en cambio, conserva el
// marcador para corregirlo).
export function clearLigaMatch(matches, matchId) {
  return matches.map((m) =>
    m.id === matchId ? { ...m, saved: false, scoreA: "", scoreB: "", sets: null } : m,
  );
}

// ¿Se puede cerrar el torneo? Sin eliminatoria, con todos los partidos de liga jugados; con
// eliminatoria, con la fase final completa (final y, si hay, partido por el 3.º puesto).
export function ligaCanFinish(t) {
  if (!t || t.status === "finished") return false;
  if (t.config?.playoffEnabled) return t.phase === "playoff" && bracketComplete(t.knockoutBracket);
  return (t.matches || []).length > 0 && t.matches.every((m) => m.saved);
}

// Al finalizar, los resultados se cierran (ligaResultsLocked).
export function finishPatch() {
  return { status: "finished" };
}
