// ── Mundialito Logic ─────────────────────────────────────────
import { shuffle } from "./utils";
import { buildBracket } from "./relampago";
import { sortStandings } from "./standings";
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

// Cada grupo necesita al menos 2 parejas para tener partidos, y no pueden
// avanzar más parejas que las del grupo más chico.
export function validateMundialitoConfig(pairCount, groupCount, advancePerGroup) {
  const maxGroups = Math.floor(pairCount / 2);
  const maxAdvance = groupCount >= 1 ? Math.floor(pairCount / groupCount) : 0;
  let error = null;
  if (pairCount < 4) {
    error = "Necesitas al menos 4 parejas";
  } else if (groupCount < 1 || groupCount > maxGroups) {
    error = `Con ${pairCount} parejas el máximo es ${maxGroups} ${maxGroups === 1 ? "grupo" : "grupos"}`;
  } else if (advancePerGroup > maxAdvance) {
    error = `Con ${groupCount} grupos pueden avanzar como máximo ${maxAdvance} por grupo`;
  }
  return { ok: error === null, maxGroups, maxAdvance, error };
}

export function buildKnockoutFromGroups(groups, advancePerGroup) {
  const qualifiers = [];
  groups.forEach((g) => {
    const sorted = sortStandings(g.standings);
    qualifiers.push(...sorted.slice(0, advancePerGroup));
  });
  return buildBracket(qualifiers);
}
