// ── Mundialito Logic ─────────────────────────────────────────
import { shuffle } from "./utils";
export function buildGroups(pairs, groupCount) {
  const shuffled = shuffle(pairs);
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i,
    name: `Grupo ${String.fromCharCode(65 + i)}`,
    pairs: [],
    matches: [],
    standings: [],
  }));
  shuffled.forEach((p, i) => {
    groups[i % groupCount].pairs.push(p);
  });
  // Build round-robin matches within each group
  groups.forEach((g) => {
    g.standings = g.pairs.map((p) => ({
      ...p,
      pts: 0,
      gf: 0,
      gc: 0,
      played: 0,
      wins: 0,
    }));
    const ms = [];
    for (let i = 0; i < g.pairs.length; i++) {
      for (let j = i + 1; j < g.pairs.length; j++) {
        ms.push({
          id: `g${g.id}_m${ms.length}`,
          groupId: g.id,
          pairA: g.pairs[i],
          pairB: g.pairs[j],
          scoreA: "",
          scoreB: "",
          saved: false,
        });
      }
    }
    g.matches = ms;
  });
  return groups;
}

export function buildKnockoutFromGroups(groups, advancePerGroup) {
  const qualifiers = [];
  groups.forEach((g) => {
    const sorted = [...g.standings].sort((a, b) =>
      b.pts !== a.pts
        ? b.pts - a.pts
        : b.gf - b.gc !== a.gf - a.gc
          ? b.gf - b.gc - (a.gf - a.gc)
          : 0,
    );
    qualifiers.push(...sorted.slice(0, advancePerGroup));
  });
  return buildBracket(qualifiers);
}
