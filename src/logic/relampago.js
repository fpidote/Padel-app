// ── Relámpago Logic ──────────────────────────────────────────
export function buildBracket(pairs) {
  const n = pairs.length;
  let size = 1;
  while (size < n) size *= 2;

  const BYE = { id: "bye", p1: "BYE", p2: "BYE" };
  const distributed = Array(size).fill(null).map((_, i) => (i < n ? pairs[i] : BYE));
  // Interleave seeds so no two BYEs face each other in R1
  const interleaved = [];
  let lo = 0, hi = size - 1;
  while (lo <= hi) {
    interleaved.push(distributed[lo++]);
    if (lo <= hi) interleaved.push(distributed[hi--]);
  }
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
  const real_r1_count = realMatchList.length;

  // Calcular estructura de consolación
  const consol_r1_match_count = Math.floor(real_r1_count / 2);
  const has_odd_r1 = real_r1_count % 2 === 1;

  // W_R2 que son garantizados bye-loser (ambos lados bye-avanzados)
  const guaranteed_bye_r2 = [];
  // W_R2 con solo un lado bye-avanzado (loser condicional)
  const conditional_bye_r2 = [];
  for (let i = 0; i < Math.floor(size / 4); i++) {
    const feedA = 2 * i;     // índice W_R1 que alimenta slot A de W_R2[i]
    const feedB = 2 * i + 1; // índice W_R1 que alimenta slot B de W_R2[i]
    const aIsBye = byeMatchIndices.has(feedA);
    const bIsBye = byeMatchIndices.has(feedB);
    if (aIsBye && bIsBye) guaranteed_bye_r2.push(i);
    else if (aIsBye || bIsBye) conditional_bye_r2.push({ matchIdx: i, byeSlot: aIsBye ? "A" : "B" });
  }

  // Mapa: índice W_R1 real → { consolMatchId, consolSlot }
  const loserRouting = {};
  realMatchList.forEach((matchIdx, k) => {
    const consolMatchId = `c_r1_m${Math.floor(k / 2)}`;
    const consolSlot = k % 2 === 0 ? "A" : "B";
    loserRouting[matchIdx] = { consolMatchId, consolSlot };
  });

  // Si hay impar de R1 reales y hay condicionales: el último condicional ocupa el slot B del match impar
  let conditionalRoutedToR1 = null;
  if (has_odd_r1 && conditional_bye_r2.length > 0) {
    const cond = conditional_bye_r2[0];
    const lastR1MatchId = `c_r1_m${Math.floor(real_r1_count / 2)}`;
    conditionalRoutedToR1 = { w2MatchIdx: cond.matchIdx, consolMatchId: lastR1MatchId, consolSlot: "B" };
  }

  // Total de matches de consolación R1 = consol_r1_match_count + (1 si hay impar o condicional)
  const total_consol_r1 = consol_r1_match_count + (has_odd_r1 ? 1 : 0);

  // 1. Winners R1
  for (let i = 0; i < size / 2; i++) {
    const routing = loserRouting[i];
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
      loserMatchId: (routing && size > 2) ? routing.consolMatchId : null,
      loserMatchSlot: (routing && size > 2) ? routing.consolSlot : null,
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

      // Determinar si este W_R2 match tiene loserMatchId (para bye-losers)
      let loserMatchId = null;
      let loserMatchSlot = null;
      if (roundNum === 2) {
        const consR2Idx = guaranteed_bye_r2.indexOf(i);
        const isGuaranteed = consR2Idx !== -1;
        const isConditional = conditionalRoutedToR1 && conditionalRoutedToR1.w2MatchIdx === i;
        if (isGuaranteed) {
          loserMatchId = `c_r2_g${consR2Idx}`;
          loserMatchSlot = "B";
        } else if (isConditional) {
          loserMatchId = conditionalRoutedToR1.consolMatchId;
          loserMatchSlot = conditionalRoutedToR1.consolSlot;
        }
      }

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

  // 3. Consolation Bracket (2-pair tournaments have no consolation — single match is the final)
  if (total_consol_r1 > 0 && size > 2) {
    // Consolation R1
    for (let i = 0; i < total_consol_r1; i++) {
      const nextConsId = total_consol_r1 > 1 || guaranteed_bye_r2.length > 0
        ? `c_r2_m${Math.floor(i / 2)}`
        : null;
      matches.push({
        id: `c_r1_m${i}`,
        bracket: "consolation",
        round: 1,
        matchIndex: i,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: nextConsId,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId: null,
      });
    }

    // Consolation R2 — matches extra para guaranteed bye-losers de W_R2
    // Estos matches reciben: slot A del winner de consolación R1, slot B del bye-loser
    const consol_r2_regular = Math.floor(total_consol_r1 / 2);
    for (let gi = 0; gi < guaranteed_bye_r2.length; gi++) {
      // El winner de c_r1_m(gi*2) va al slot A de c_r2_g(gi)
      // El bye-loser de W_R2 va al slot B de c_r2_g(gi)
      const sourceR1MatchId = `c_r1_m${gi * 2}`;
      const sourceR1 = matches.find((m) => m.id === sourceR1MatchId);
      if (sourceR1) {
        sourceR1.nextMatchId = `c_r2_g${gi}`;
        sourceR1.nextMatchSlot = "A";
      }
      matches.push({
        id: `c_r2_g${gi}`,
        bracket: "consolation",
        round: 2,
        matchIndex: consol_r2_regular + gi,
        pairA: null,
        pairB: null,
        scoreA: "",
        scoreB: "",
        saved: false,
        winner: null,
        loser: null,
        nextMatchId: null,
        nextMatchSlot: null,
        loserMatchId: null,
      });
    }

    // Consolation R2 regular (si hay más de 1 match en R1)
    if (consol_r2_regular > 0) {
      for (let i = 0; i < consol_r2_regular; i++) {
        // Solo si no fue sobreescrito por un guaranteed bye (arriba)
        if (!matches.find((m) => m.id === `c_r2_m${i}`)) {
          matches.push({
            id: `c_r2_m${i}`,
            bracket: "consolation",
            round: 2,
            matchIndex: i,
            pairA: null,
            pairB: null,
            scoreA: "",
            scoreB: "",
            saved: false,
            winner: null,
            loser: null,
            nextMatchId: consol_r2_regular > 1 ? `c_r3_m${Math.floor(i / 2)}` : null,
            nextMatchSlot: i % 2 === 0 ? "A" : "B",
            loserMatchId: null,
          });
        }
      }

      // Consolation R3+ (si hay más rondas)
      let cPrev = consol_r2_regular;
      let cRound = 3;
      while (cPrev > 1) {
        const cNew = Math.floor(cPrev / 2);
        for (let i = 0; i < cNew; i++) {
          matches.push({
            id: `c_r${cRound}_m${i}`,
            bracket: "consolation",
            round: cRound,
            matchIndex: i,
            pairA: null,
            pairB: null,
            scoreA: "",
            scoreB: "",
            saved: false,
            winner: null,
            loser: null,
            nextMatchId: cNew > 1 ? `c_r${cRound + 1}_m${Math.floor(i / 2)}` : null,
            nextMatchSlot: i % 2 === 0 ? "A" : "B",
            loserMatchId: null,
          });
        }
        cPrev = cNew;
        cRound++;
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
    const shouldRoute = !hasByeTracking || loserHadBye;
    if (shouldRoute) {
      const cons = updated.find((m) => m.id === match.loserMatchId);
      if (cons) {
        if (match.loserMatchSlot === "A") cons.pairA = match.loser;
        else cons.pairB = match.loser;
      }
    }
  }

  rippleByes(updated);

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
