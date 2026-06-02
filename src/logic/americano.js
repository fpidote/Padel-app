// ── Americano Logic ──────────────────────────────────────────
import { shuffle, pk } from "./utils";

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

function levelPenalty(pair) {
  return Math.abs((pair[0].level || 0) - (pair[1].level || 0));
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
  opts.forEach((s) => {
    const sc = s.reduce(
      (acc, pair) =>
        acc +
        (ph[pk(pair[0].id, pair[1].id)] || 0) * 10 +
        levelPenalty(pair) * 3,
      0,
    );
    if (sc < bs) {
      bs = sc;
      best = s;
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

  // Individual: sort by level desc, then pair 1st+4th vs 2nd+3rd per court
  const sorted = [...entities].sort((a, b) => (b.level || 0) - (a.level || 0));
  const act = sorted.slice(0, activeCourts * units);
  const sit = sorted.slice(activeCourts * units);
  for (let c = 0; c < activeCourts; c++) {
    const g = act.slice(c * 4, c * 4 + 4);
    cs.push({ pairA: [g[0], g[3]], pairB: [g[1], g[2]], scoreA: "", scoreB: "", saved: false });
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
      .sort((a, b) => a.ss - b.ss);
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
    for (let c = 0; c < activeCourts; c++) {
      const [pA, pB] = bestSplit(active.slice(c * 4, c * 4 + 4), ph);
      cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
    }
  }
  return { courts: cs, sittingOut };
}
