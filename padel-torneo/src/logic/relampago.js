// ── Relámpago Logic ──────────────────────────────────────────
export function buildBracket(pairs) {
  // Power of 2 bracket with byes
  const n = pairs.length;
  let size = 1;
  while (size < n) size *= 2;

  const BYE = { id: "bye", p1: "BYE", p2: "BYE" };
  const seeds = [...pairs, ...Array(size - n).fill(BYE)];
  const matches = [];

  // 1. Winners R1
  for (let i = 0; i < size / 2; i++) {
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
      loserMatchId: size > 2 ? `c_r1_m${Math.floor(i / 2)}` : null,
    });
  }

  // 2. Winners Subsequent Rounds
  let prevRoundSize = size / 2;
  let roundNum = 2;
  while (prevRoundSize > 1) {
    const newSize = prevRoundSize / 2;
    for (let i = 0; i < newSize; i++) {
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
        nextMatchId:
          newSize > 1 ? `w_r${roundNum + 1}_m${Math.floor(i / 2)}` : null,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId: null,
      });
    }
    prevRoundSize = newSize;
    roundNum++;
  }

  // 3. Consolation Bracket
  if (size > 2) {
    const cSize = size / 2;

    // Consolation R1
    for (let i = 0; i < Math.floor(cSize / 2); i++) {
      const cId = `c_r1_m${i}`;
      matches.push({
        id: cId,
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
        nextMatchId: cSize > 2 ? `c_r2_m${Math.floor(i / 2)}` : null,
        nextMatchSlot: i % 2 === 0 ? "A" : "B",
        loserMatchId: null,
      });
    }

    // Consolation subsequent rounds
    let cPrev = Math.floor(cSize / 2);
    let cRound = 2;
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
          nextMatchId:
            cNew > 1 ? `c_r${cRound + 1}_m${Math.floor(i / 2)}` : null,
          nextMatchSlot: i % 2 === 0 ? "A" : "B",
          loserMatchId: null,
        });
      }
      cPrev = cNew;
      cRound++;
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
  if (match.loserMatchId && match.loser) {
    const cons = updated.find((m) => m.id === match.loserMatchId);
    if (cons) {
      if (!cons.pairA) cons.pairA = match.loser;
      else cons.pairB = match.loser;
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
        if (m.pairA.id === "bye" && m.pairB.id === "bye") {
          m.saved = true;
          m.winner = m.pairA;
          m.loser = m.pairB;
          changed = true;
        } else if (m.pairA.id === "bye") {
          m.saved = true;
          m.scoreA = "0";
          m.scoreB = "1";
          m.winner = m.pairB;
          m.loser = m.pairA;
          changed = true;
        } else if (m.pairB.id === "bye") {
          m.saved = true;
          m.scoreA = "1";
          m.scoreB = "0";
          m.winner = m.pairA;
          m.loser = m.pairB;
          changed = true;
        }

        if (changed) {
          if (m.nextMatchId) {
            const next = matches.find((nx) => nx.id === m.nextMatchId);
            if (next) {
              if (m.nextMatchSlot === "A") next.pairA = m.winner;
              else next.pairB = m.winner;
            }
          }
          if (m.loserMatchId && m.loser) {
            const cons = matches.find((nx) => nx.id === m.loserMatchId);
            if (cons) {
              if (!cons.pairA) cons.pairA = m.loser;
              else cons.pairB = m.loser;
            }
          }
        }
      }
    });
  }
}
