// ── Americano Logic ──────────────────────────────────────────
import { shuffle, pk } from "./utils";

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
  const all = shuffle(entities);
  const activeCourts = Math.min(courts, Math.floor(all.length / units));
  const act = all.slice(0, activeCourts * units);
  const sit = all.slice(activeCourts * units);
  const cs = [];

  if (isPairs) {
    for (let c = 0; c < activeCourts; c++) {
      cs.push({
        pairA: act[c * 2],
        pairB: act[c * 2 + 1],
        scoreA: "",
        scoreB: "",
        saved: false,
      });
    }
  } else {
    for (let c = 0; c < activeCourts; c++) {
      const g = act.slice(c * 4, c * 4 + 4);
      const [pA, pB] = bestSplit(g, {});
      cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
    }
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
