// ── Americano Logic ──────────────────────────────────────────
import { shuffle, pk } from "./utils";

// ── Penalty weights ───────────────────────────────────────────
// REST_IMBALANCE is enforced at sitting-out selection (selectSittingOut),
// NOT inside scoredSplit — applying it twice would double-count rest pressure.
export const PENALTY = {
  PARTNER_REPEAT: 1000,
  ADVANCED_PAIR: 5000,
  COURT_REPEAT: 500,
  REST_IMBALANCE: 2000,
};

// ── Relaxation thresholds ─────────────────────────────────────
// Index 0 = strict, index 1 = relax court repeat,
// index 2 = relax partner repeat, attempt 3 uses Infinity (always accept).
export const RELAX_THRESHOLDS = [2000, 6000, 15000];

// ── scoredSplit ───────────────────────────────────────────────
// Evaluates the 3 possible pair-splits for a group of 4 players and
// returns the split with the lowest penalty score given current state and weights.
// REST_IMBALANCE is NOT in this formula — enforced at selectSittingOut, not here.
function scoredSplit(group, courtIndex, state, weights) {
  const { ph, courtHistory } = state;

  const opts = [
    [[group[0], group[1]], [group[2], group[3]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[3]], [group[1], group[2]]],
  ];

  let best = null;
  let bestScore = Infinity;

  opts.forEach(([pA, pB]) => {
    let score = 0;

    // Partner repeat penalty
    score += (ph[pk(pA[0].id, pA[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);
    score += (ph[pk(pB[0].id, pB[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);

    // Advanced+Advanced pair penalty
    // Skipped when ADVANCED_PAIR weight is 0 (unsatisfiable constraint or attempt 3)
    const apWeight = weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR;
    if (apWeight > 0) {
      if (highLevelClash(pA)) score += apWeight;
      if (highLevelClash(pB)) score += apWeight;
    }

    // Court repeat penalty (for all 4 players on this court)
    // Court keys use format "${id}_c${courtIndex}" — safe because player IDs are integers 0..N
    // and no integer formatted as string contains "_c".
    const crWeight = weights.COURT_REPEAT ?? PENALTY.COURT_REPEAT;
    [...pA, ...pB].forEach((p) => {
      score += (courtHistory[`${p.id}_c${courtIndex}`] || 0) * crWeight;
    });

    if (score < bestScore) {
      bestScore = score;
      best = [pA, pB];
    }
  });

  return { pairs: best, score: bestScore };
}

// ── selectSittingOut ──────────────────────────────────────────
// Selects which players sit out each round, preferring those who have
// rested least. Tiebreaker: player ID ascending (NOT pts — all pts=0 during pre-calc, per D-05).
function selectSittingOut(entities, courts, soh) {
  const activeCourts = Math.min(courts, Math.floor(entities.length / 4));
  const cnt = entities.length - activeCourts * 4;

  if (cnt <= 0) return { active: entities, sittingOut: [] };

  const pool = [...entities]
    .map((p) => ({ ...p, _soh: soh[p.id] || 0 }))
    .sort((a, b) => (a._soh !== b._soh ? a._soh - b._soh : a.id - b.id));

  const sittingOutIds = new Set(pool.slice(0, cnt).map((p) => p.id));
  return {
    sittingOut: entities.filter((p) => sittingOutIds.has(p.id)),
    active: entities.filter((p) => !sittingOutIds.has(p.id)),
  };
}

// ── levelSortedWithShuffle ────────────────────────────────────
// Groups active players by level descending, shuffles within each level group,
// then concatenates — gives the penalty engine variety while keeping level separation.
function levelSortedWithShuffle(active) {
  const byLevel = {};
  active.forEach((p) => {
    const l = p.level || 0;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(p);
  });

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);
  return levels.flatMap((l) => shuffle(byLevel[l]));
}

export function precomputeAllRounds(entities, config) {
  const { courts, mode = "individual", maxRounds } = config;
  const isPairs = mode === "pairs";
  const totalRounds = maxRounds ?? Math.min(entities.length - 1, 12);

  const rounds = [];
  let ph = {};
  let soh = {};

  const first = buildFirstRoundAmericano(entities, courts, mode);
  rounds.push({ courts: first.courts, sittingOut: first.sittingOut });

  for (let r = 1; r < totalRounds; r++) {
    const prev = rounds[r - 1];
    prev.sittingOut.forEach((p) => {
      soh[p.id] = (soh[p.id] || 0) + 1;
    });
    if (!isPairs) {
      prev.courts.forEach((court) => {
        const kA = pk(court.pairA[0].id, court.pairA[1].id);
        const kB = pk(court.pairB[0].id, court.pairB[1].id);
        ph[kA] = (ph[kA] || 0) + 1;
        ph[kB] = (ph[kB] || 0) + 1;
      });
    }
    const round = buildRoundAmericano(entities, courts, ph, soh, mode);
    rounds.push({ courts: round.courts, sittingOut: round.sittingOut });
  }

  return rounds;
}

function highLevelClash(pair) {
  return pair.every((p) => (p.level || 0) >= 3) ? 1 : 0;
}

function matchBalance(pA, pB) {
  const sumA = pA.reduce((s, p) => s + (p.level || 0), 0);
  const sumB = pB.reduce((s, p) => s + (p.level || 0), 0);
  return Math.abs(sumA - sumB);
}

function bestSplit(g, ph) {
  const opts = [
    [
      [g[0], g[1]],
      [g[2], g[3]],
    ],
    [
      [g[0], g[2]],
      [g[1], g[3]],
    ],
    [
      [g[0], g[3]],
      [g[1], g[2]],
    ],
  ];
  let best = opts[0],
    bs = Infinity;
  opts.forEach(([pA, pB]) => {
    const sc =
      (ph[pk(pA[0].id, pA[1].id)] || 0) * 12 +
      (ph[pk(pB[0].id, pB[1].id)] || 0) * 12 +
      highLevelClash(pA) * 15 +
      highLevelClash(pB) * 15 +
      matchBalance(pA, pB) * 2;
    if (sc < bs) {
      bs = sc;
      best = [pA, pB];
    }
  });
  return best;
}

export function buildFirstRoundAmericano(
  entities,
  courts,
  mode = "individual",
) {
  const isPairs = mode === "pairs";
  const units = isPairs ? 2 : 4;
  const activeCourts = Math.min(courts, Math.floor(entities.length / units));
  const cs = [];

  if (isPairs) {
    const all = shuffle(entities);
    const act = all.slice(0, activeCourts * units);
    const sit = all.slice(activeCourts * units);
    for (let c = 0; c < activeCourts; c++) {
      cs.push({
        pairA: act[c * 2],
        pairB: act[c * 2 + 1],
        scoreA: "",
        scoreB: "",
        saved: false,
      });
    }
    return { courts: cs, sittingOut: sit };
  }

  // Individual: sort by level desc, split into top half + bottom half so each
  // court gets 2 from each half — ensures advanced players are spread across courts
  const sorted = [...entities].sort((a, b) => (b.level || 0) - (a.level || 0));
  const act = sorted.slice(0, activeCourts * units);
  const sit = sorted.slice(activeCourts * units);
  const topH = act.slice(0, activeCourts * 2);
  const botH = act.slice(activeCourts * 2);
  for (let c = 0; c < activeCourts; c++) {
    const g = [topH[c * 2], topH[c * 2 + 1], botH[c * 2], botH[c * 2 + 1]];
    const [pA, pB] = bestSplit(g, {});
    cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
  }
  return { courts: cs, sittingOut: sit };
}

export function buildRoundAmericano(entities, n, ph, soh, mode = "individual") {
  const isPairs = mode === "pairs";
  const units = isPairs ? 2 : 4;
  const sorted = [...entities].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  const activeCourts = Math.min(n, Math.floor(sorted.length / units));
  const cnt = sorted.length - activeCourts * units;
  let active = sorted, sittingOut = [];
  if (cnt > 0) {
    const pool = sorted
      .slice(-Math.max(cnt * 2, cnt + 2))
      .map((p) => ({ ...p, ss: soh[p.id] || 0 }))
      .sort((a, b) => a.ss !== b.ss ? a.ss - b.ss : a.pts - b.pts);
    const ids = new Set(pool.slice(0, cnt).map((p) => p.id));
    sittingOut = sorted.filter((p) => ids.has(p.id));
    active = sorted.filter((p) => !ids.has(p.id));
  }
  const cs = [];
  if (isPairs) {
    for (let c = 0; c < activeCourts; c++) {
      cs.push({
        pairA: active[c * 2],
        pairB: active[c * 2 + 1],
        scoreA: "",
        scoreB: "",
        saved: false,
      });
    }
  } else {
    const topH = active.slice(0, activeCourts * 2);
    const botH = active.slice(activeCourts * 2);
    for (let c = 0; c < activeCourts; c++) {
      const g = [topH[c * 2], topH[c * 2 + 1], botH[c * 2], botH[c * 2 + 1]];
      const [pA, pB] = bestSplit(g, ph);
      cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
    }
  }
  return { courts: cs, sittingOut };
}
