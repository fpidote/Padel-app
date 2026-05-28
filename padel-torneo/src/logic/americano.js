// ── Americano Logic ──────────────────────────────────────────
import { shuffle, pk } from "./utils";

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
      (acc, p) =>
        acc +
        (ph[pk(p[0].id, p[1].id)] || 0) * 10 +
        (p[0].level === p[1].level ? 5 : 0),
      0,
    );
    if (sc < bs) {
      bs = sc;
      best = s;
    }
  });
  return best;
}

export function buildFirstRoundAmericano(players, courts) {
  const all = shuffle(players),
    act = all.slice(0, courts * 4),
    sit = all.slice(courts * 4);
  let l1 = shuffle(act.filter((p) => p.level === 1)),
    l2 = shuffle(act.filter((p) => p.level === 2));
  const cs = [];
  for (let c = 0; c < courts; c++) {
    const g = [];
    g.push(...l1.splice(0, Math.min(2, l1.length)));
    g.push(...l2.splice(0, Math.min(4 - g.length, l2.length)));
    while (g.length < 4) {
      if (l1.length) g.push(l1.shift());
      else if (l2.length) g.push(l2.shift());
      else break;
    }
    const [pA, pB] = bestSplit(g, {});
    cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
  }
  return { courts: cs, sittingOut: sit };
}

export function buildRoundAmericano(players, n, ph, soh) {
  const sorted = [...players].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  let active = sorted,
    sittingOut = [];
  if (sorted.length > n * 4) {
    const cnt = sorted.length - n * 4;
    const pool = sorted
      .slice(-Math.max(cnt * 2, cnt + 2))
      .map((p) => ({ ...p, ss: soh[p.id] || 0 }))
      .sort((a, b) => a.ss - b.ss);
    const ids = new Set(pool.slice(0, cnt).map((p) => p.id));
    sittingOut = sorted.filter((p) => ids.has(p.id));
    active = sorted.filter((p) => !ids.has(p.id));
  }
  const cs = [];
  for (let c = 0; c < n; c++) {
    if (c * 4 + 3 >= active.length) break;
    const [pA, pB] = bestSplit(active.slice(c * 4, c * 4 + 4), ph);
    cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
  }
  return { courts: cs, sittingOut };
}
