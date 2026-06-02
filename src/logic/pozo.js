// ── El Pozo Logic ────────────────────────────────────────────
export function buildPozoRound(pairs, courts) {
  // Assign pairs to courts by current ranking
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
