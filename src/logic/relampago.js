// ── Relámpago Logic ──────────────────────────────────────────
// Orden en que se ubican las siembras en la primera ronda (siembra estándar de torneos): el mejor
// contra el peor, los dos mejores en mitades opuestas (solo se cruzan en la final) y los cuatro
// mejores en cuartos distintos. Los pasa directo (las plazas que sobran hasta la potencia de 2)
// caen sobre los mejores sembrados.
function seedOrder(size) {
  let order = [0];
  for (let s = 1; s < size; s *= 2) {
    order = order.flatMap((seed) => [seed, 2 * s - 1 - seed]);
  }
  return order;
}

// Enfrentamientos de la primera ronda como pares de índices de siembra (0 = mejor).
// Un índice >= n es un pasa directo. buildBracket usa esta misma disposición.
export function firstRoundSeedPairs(n) {
  let size = 1;
  while (size < n) size *= 2;
  const order = seedOrder(size);
  const pairs = [];
  for (let i = 0; i < size / 2; i++) pairs.push([order[i * 2], order[i * 2 + 1]]);
  return pairs;
}

const ROUND_NAMES = ["Final", "Semifinales", "Cuartos de final", "Octavos de final"];

// Nombre de una ronda según lo lejos que está de la final (round 1 = primera ronda).
export function bracketRoundName(round, finalRound) {
  return ROUND_NAMES[finalRound - round] ?? `Ronda ${round}`;
}

// Podio de un cuadro de eliminación directa: la final decide campeón y subcampeón y, si se jugó el
// partido por el 3.º puesto, también tercero y cuarto. Sin la final jugada no hay podio.
export function bracketPodium(bracket) {
  const empty = { champion: null, runnerUp: null, third: null, fourth: null };
  const list = bracket || [];
  const final = list.find((m) => !m.nextMatchId && m.bracket !== "third" && m.bracket !== "consolation");
  if (!final?.saved) return empty;
  const thirdMatch = list.find((m) => m.bracket === "third");
  return {
    champion: final.winner,
    runnerUp: final.loser,
    third: thirdMatch?.saved ? thirdMatch.winner : null,
    fourth: thirdMatch?.saved ? thirdMatch.loser : null,
  };
}

// Podio del Relámpago: campeón y subcampeón salen de la final del cuadro principal (no de la tabla de
// victorias) y el tercero es el ganador de la final de la revancha, que es quien "sigue jugando".
export function relampagoPodium(bracket) {
  const { champion, runnerUp } = bracketPodium(bracket);
  const consolFinal = (bracket || []).find((m) => m.bracket === "consolation" && !m.nextMatchId);
  const third = consolFinal?.saved && consolFinal.winner?.id !== "bye" ? consolFinal.winner : null;
  return { champion, runnerUp, third };
}

// ¿Se puede cerrar el torneo? Con todo el cuadro jugado, revancha incluida, y solo una vez.
export function relampagoCanFinish(t) {
  return !!t && t.status !== "finished" && bracketComplete(t.bracket);
}

// ¿Se jugó todo el cuadro? Los pasa directo se resuelven solos, así que basta con que todo esté guardado
// (incluido el partido por el 3.º puesto si existe).
export function bracketComplete(bracket) {
  return !!bracket?.length && bracket.every((m) => m.saved);
}

// Los dos perdedores de semifinales (para mostrarlos cuando no hay partido por el 3.º puesto).
export function bracketSemifinalLosers(bracket) {
  const winners = (bracket || []).filter((m) => m.bracket === "winners");
  if (winners.length < 3) return [];
  const finalRound = Math.max(...winners.map((m) => m.round));
  return winners
    .filter((m) => m.round === finalRound - 1 && m.saved && m.loser && m.loser.id !== "bye")
    .map((m) => m.loser);
}

const BYE_PAIR = { id: "bye", p1: "BYE", p2: "BYE" };

// Con { consolation: false } es eliminación directa pura (Mundialito y Liga); por defecto incluye
// el cuadro de revancha del Relámpago.
// Con { thirdPlace: true } (solo sin consolación y con 4 parejas o más) suma un partido entre los dos
// perdedores de semifinales, `w_third`, en la ronda de la final.
export function buildBracket(pairs, { consolation = true, thirdPlace = false } = {}) {
  const n = pairs.length;
  let size = 1;
  while (size < n) size *= 2;
  const hasThird = thirdPlace && !consolation && n >= 4;
  const finalRound = Math.log2(size);
  // A qué hueco del partido por el 3.º puesto va el perdedor de una semifinal
  const thirdRouting = (round, matchIndex) =>
    hasThird && round === finalRound - 1
      ? { loserMatchId: "w_third", loserMatchSlot: matchIndex % 2 === 0 ? "A" : "B" }
      : null;

  const BYE = BYE_PAIR;
  const distributed = Array(size).fill(null).map((_, i) => (i < n ? pairs[i] : BYE));
  // Interleave seeds so no two BYEs face each other in R1
  const interleaved = seedOrder(size).map((i) => distributed[i]);
  const seeds = interleaved;
  const matches = [];

  // Clasificar partidos W_R1: reales vs bye
  const byeMatchIndices = new Set();
  const realMatchList = []; // índices de partidos reales (en orden)
  for (let i = 0; i < size / 2; i++) {
    if (seeds[i * 2].id === "bye" || seeds[i * 2 + 1].id === "bye") {
      byeMatchIndices.add(i);
    } else {
      realMatchList.push(i);
    }
  }

  // Quiénes caen a la consolación, en este orden: los perdedores de los W_R1 reales, los de los W_R2
  // en que ambos descansaron (seguro) y los de los W_R2 en que solo uno descansó (condicional: entra
  // solo si pierde quien descansó; si no, ese lugar se resuelve solo con un BYE).
  const guaranteedR2 = [];
  const conditionalR2 = [];
  for (let i = 0; i < Math.floor(size / 4); i++) {
    const aIsBye = byeMatchIndices.has(2 * i);
    const bIsBye = byeMatchIndices.has(2 * i + 1);
    if (aIsBye && bIsBye) guaranteedR2.push(i);
    else if (aIsBye || bIsBye) conditionalR2.push(i);
  }
  const sources = [
    ...realMatchList.map((idx) => ({ round: 1, idx })),
    ...guaranteedR2.map((idx) => ({ round: 2, idx })),
    ...conditionalR2.map((idx) => ({ round: 2, idx })),
  ];
  let consolSize = 1;
  while (consolSize < sources.length) consolSize *= 2;
  const hasConsolation = consolation && size > 2 && sources.length >= 2;
  // Parejas de la primera ronda de consolación: primero las de dos entrantes y al final las que
  // tienen un BYE (así el BYE queda con los últimos, que son los condicionales).
  const fullPairs = sources.length - consolSize / 2;
  const loserRouting = {};
  sources.forEach((src, k) => {
    const pairIdx = k < fullPairs * 2 ? Math.floor(k / 2) : fullPairs + (k - fullPairs * 2);
    const slot = k < fullPairs * 2 ? (k % 2 === 0 ? "A" : "B") : "A";
    loserRouting[`${src.round}_${src.idx}`] = { consolMatchId: `c_r1_m${pairIdx}`, consolSlot: slot };
  });

  // 1. Winners R1
  for (let i = 0; i < size / 2; i++) {
    const routing = hasConsolation ? loserRouting[`1_${i}`] : null;
    const third = thirdRouting(1, i);
    matches.push({
      id: `w_r1_m${i}`,
      bracket: "winners",
      round: 1,
      matchIndex: i,
      pairA: seeds[i * 2],
      pairB: seeds[i * 2 + 1],
      scoreA: "",
      scoreB: "",
      saved: false,
      winner: null,
      loser: null,
      nextMatchId: size > 2 ? `w_r2_m${Math.floor(i / 2)}` : null,
      nextMatchSlot: i % 2 === 0 ? "A" : "B",
      loserMatchId: routing ? routing.consolMatchId : (third?.loserMatchId ?? null),
      loserMatchSlot: routing ? routing.consolSlot : (third?.loserMatchSlot ?? null),
    });
  }

  // 2. Winners Subsequent Rounds
  let prevRoundSize = size / 2;
  let roundNum = 2;
  while (prevRoundSize > 1) {
    const newSize = prevRoundSize / 2;
    for (let i = 0; i < newSize; i++) {
      const feedA = 2 * i;
      const feedB = 2 * i + 1;
      const pairAByeInR1 = roundNum === 2 ? byeMatchIndices.has(feedA) : false;
      const pairBByeInR1 = roundNum === 2 ? byeMatchIndices.has(feedB) : false;

      // Los W_R2 con alguna pareja que descansó mandan a su perdedor a la consolación
      const routing = roundNum === 2 && hasConsolation ? loserRouting[`2_${i}`] : null;
      const third = thirdRouting(roundNum, i);
      const loserMatchId = routing ? routing.consolMatchId : (third?.loserMatchId ?? null);
      const loserMatchSlot = routing ? routing.consolSlot : (third?.loserMatchSlot ?? null);

      matches.push({
        id: `w_r${roundNum}_m${i}`,
        bracket: "winners",
        round: roundNum,
        matchIndex: i,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: newSize > 1 ? `w_r${roundNum + 1}_m${Math.floor(i / 2)}` : null,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId,
        loserMatchSlot,
        pairAByeInR1,
        pairBByeInR1,
      });
    }
    prevRoundSize = newSize;
    roundNum++;
  }

  // 2b. Partido por el 3.º y 4.º puesto
  if (hasThird) {
    matches.push({
      id: "w_third",
      bracket: "third",
      round: finalRound,
      matchIndex: 0,
      pairA: null,
      pairB: null,
      scoreA: "",
      scoreB: "",
      saved: false,
      winner: null,
      loser: null,
      nextMatchId: null,
      nextMatchSlot: "A",
      loserMatchId: null,
    });
  }

  // 3. Consolation Bracket (con 2 parejas no hay: el único partido es la final)
  if (hasConsolation) {
    let count = consolSize / 2;
    for (let round = 1; count >= 1; round++, count /= 2) {
      for (let i = 0; i < count; i++) {
        const isLeaf = round === 1;
        matches.push({
          id: `c_r${round}_m${i}`,
          bracket: "consolation",
          round,
          matchIndex: i,
          pairA: null,
          pairB: isLeaf && i >= fullPairs ? BYE : null,
          scoreA: "",
          scoreB: "",
          saved: false,
          winner: null,
          loser: null,
          nextMatchId: count > 1 ? `c_r${round + 1}_m${Math.floor(i / 2)}` : null,
          nextMatchSlot: i % 2 === 0 ? "A" : "B",
          loserMatchId: null,
        });
      }
    }
  }

  // 4. Ripple Byes
  rippleByes(matches);

  return matches;
}

export function advanceBracket(matches, savedId, scoreA, scoreB) {
  let updated = matches.map((m) => ({ ...m }));
  const match = updated.find((m) => m.id === savedId);
  if (!match) return updated;
  const a = parseInt(scoreA),
    b = parseInt(scoreB);
  if (a === b) return updated;
  match.scoreA = String(a);
  match.scoreB = String(b);
  match.saved = true;
  match.winner = a > b ? match.pairA : match.pairB;
  match.loser = a > b ? match.pairB : match.pairA;
  // Advance winner
  if (match.nextMatchId) {
    const next = updated.find((m) => m.id === match.nextMatchId);
    if (next) {
      if (match.nextMatchSlot === "A") next.pairA = match.winner;
      else next.pairB = match.winner;
    }
  }
  // Advance loser to consolation
  if (match.loserMatchId && match.loser && match.loser.id !== "bye") {
    // Para W_R2 con bye-tracking: solo enrutar si el loser tuvo bye en R1.
    // Para W_R1 real (sin flags) y W_R2 guaranteed (ambos son bye): siempre enrutar.
    const loserIsA = a < b; // a < b → pairA perdió
    const loserHadBye = loserIsA ? (match.pairAByeInR1 ?? false) : (match.pairBByeInR1 ?? false);
    // W_R1 matches have NO pairAByeInR1/pairBByeInR1 (undefined → hasByeTracking=false → always route).
    // Do NOT set these to false on W_R1 — that would silently block consolation routing.
    const hasByeTracking = match.pairAByeInR1 != null || match.pairBByeInR1 != null;
    const cons = updated.find((m) => m.id === match.loserMatchId);
    // El seguimiento de byes solo importa para la consolación; el partido por el 3.º puesto recibe
    // siempre al perdedor de la semifinal.
    const shouldRoute = cons?.bracket !== "consolation" || !hasByeTracking || loserHadBye;
    if (cons) {
      // Si perdió quien ya había jugado, a la consolación no llega nadie: el lugar se cubre con un
      // BYE para que el cuadro no quede esperando.
      const entrant = shouldRoute ? match.loser : { ...BYE_PAIR };
      if (match.loserMatchSlot === "A") cons.pairA = entrant;
      else cons.pairB = entrant;
    }
  }

  rippleByes(updated);

  return updated;
}

const isRealPlayed = (m) => !!m?.saved && m.pairA?.id !== "bye" && m.pairB?.id !== "bye";

// ¿Se jugó ya algún partido real del cuadro? (los pasa directo resueltos solos no cuentan)
export function hasPlayedRealMatch(bracket) {
  return (bracket || []).some(isRealPlayed);
}

// Un resultado se puede corregir mientras ningún partido que dependa de él se haya jugado: ni el
// siguiente del cuadro ni el de revancha, y tampoco los que cuelgan de un pasa directo resuelto solo.
export function canEditBracketMatch(matches, matchId) {
  const byId = new Map((matches || []).map((m) => [m.id, m]));
  const start = byId.get(matchId);
  if (!start) return false;
  const seen = new Set();
  function dependsOnPlayed(m) {
    return [m.nextMatchId, m.loserMatchId].filter(Boolean).some((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      const d = byId.get(id);
      if (!d) return false;
      if (isRealPlayed(d)) return true;
      // resuelto solo por un pasa directo: lo que viene detrás también depende de este resultado
      return d.saved ? dependsOnPlayed(d) : false;
    });
  }
  return !dependsOnPlayed(start);
}

// Deshace un resultado guardado: saca a sus participantes de los partidos siguientes y de la
// consolación, y deshace también los pasa directo que se resolvieron solos a raíz de él.
export function unadvanceBracket(matches, matchId) {
  const updated = matches.map((m) => ({ ...m }));
  const byId = (id) => updated.find((m) => m.id === id);

  function clearSlot(target, slot) {
    if (!target) return;
    const wasAuto = target.saved && (target.pairA?.id === "bye" || target.pairB?.id === "bye");
    if (slot === "A") target.pairA = null;
    else target.pairB = null;
    if (wasAuto) resetAuto(target);
  }

  function release(m) {
    if (m.nextMatchId && m.winner) clearSlot(byId(m.nextMatchId), m.nextMatchSlot);
    if (m.loserMatchId) clearSlot(byId(m.loserMatchId), m.loserMatchSlot);
  }

  function resetAuto(m) {
    release(m);
    m.saved = false;
    m.winner = null;
    m.loser = null;
    m.scoreA = "";
    m.scoreB = "";
  }

  const match = byId(matchId);
  if (!match) return updated;
  release(match);
  match.saved = false;
  return updated;
}

function rippleByes(matches) {
  let changed = true;
  while (changed) {
    changed = false;
    matches.forEach((m) => {
      if (!m.saved && m.pairA && m.pairB) {
        let matchChanged = false;
        if (m.pairA.id === "bye" && m.pairB.id === "bye") {
          m.saved = true;
          m.winner = m.pairA;
          m.loser = m.pairB;
          matchChanged = true;
        } else if (m.pairA.id === "bye") {
          m.saved = true;
          m.scoreA = "0";
          m.scoreB = "1";
          m.winner = m.pairB;
          m.loser = m.pairA;
          matchChanged = true;
        } else if (m.pairB.id === "bye") {
          m.saved = true;
          m.scoreA = "1";
          m.scoreB = "0";
          m.winner = m.pairA;
          m.loser = m.pairB;
          matchChanged = true;
        }

        if (matchChanged) {
          changed = true;
          if (m.nextMatchId) {
            const next = matches.find((nx) => nx.id === m.nextMatchId);
            if (next) {
              if (m.nextMatchSlot === "A") next.pairA = m.winner;
              else next.pairB = m.winner;
            }
          }
          if (m.loserMatchId && m.loser && m.loser.id !== "bye") {
            const cons = matches.find((nx) => nx.id === m.loserMatchId);
            if (cons) {
              if (m.loserMatchSlot === "A") cons.pairA = m.loser;
              else cons.pairB = m.loser;
            }
          }
        }
      }
    });
  }
}

// Cuenta los partidos guardados en los que participa la pareja (los BYE no cuentan).
export function countPlayed(bracket, pairId) {
  return (bracket || []).filter(
    (m) =>
      m.saved &&
      m.pairA?.id !== "bye" &&
      m.pairB?.id !== "bye" &&
      (m.pairA?.id === pairId || m.pairB?.id === pairId),
  ).length;
}
