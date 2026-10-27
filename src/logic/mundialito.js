// ── Mundialito Logic ─────────────────────────────────────────
import { shuffle } from "./utils";
import { buildBracket, firstRoundSeedPairs, hasPlayedRealMatch } from "./relampago";
import { sortStandings, winsOf } from "./standings";
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

// Rendimiento por partido jugado, para poder comparar a clasificados de grupos de distinto tamaño.
const perMatch = (value, p) => (p.played > 0 ? value / p.played : 0);
function byPerformance(a, b) {
  const rate = (p) => (p.played > 0 ? winsOf(p) / p.played : 0);
  return (
    rate(b) - rate(a) ||
    perMatch(b.gf - b.gc, b) - perMatch(a.gf - a.gc, a) ||
    perMatch((b.gamesFor || 0) - (b.gamesAgainst || 0), b) - perMatch((a.gamesFor || 0) - (a.gamesAgainst || 0), a)
  );
}

// Evita que dos parejas del mismo grupo se enfrenten en la primera ronda cuando hay alternativa:
// intercambia al peor sembrado del cruce con otro participante cercano de la misma categoría.
// Nunca toca a quienes pasan directo.
function avoidFirstRoundClashes(entries) {
  const n = entries.length;
  const opponent = new Map();
  firstRoundSeedPairs(n).forEach(([a, b]) => {
    if (a < n && b < n) {
      opponent.set(a, b);
      opponent.set(b, a);
    }
  });
  opponent.forEach((b, a) => {
    if (a > b || entries[a].gi !== entries[b].gi) return;
    const candidates = [...opponent.keys()]
      .filter((k) => k !== a && k !== b && Math.abs(entries[k].pos - entries[b].pos) <= 1)
      .sort((x, y) => Math.abs(x - b) - Math.abs(y - b));
    const k = candidates.find(
      (c) => entries[c].gi !== entries[a].gi && entries[b].gi !== entries[opponent.get(c)].gi
    );
    if (k !== undefined) [entries[b], entries[k]] = [entries[k], entries[b]];
  });
}

// Orden de siembra de los clasificados: primero los primeros de grupo, luego los segundos, etc.;
// dentro de cada puesto, por rendimiento. Así los pasa directo van a los mejores y no al grupo A.
export function seedQualifiers(groups, advancePerGroup) {
  const entries = [];
  groups.forEach((g, gi) => {
    sortStandings(g.standings, g.matches || [])
      .slice(0, advancePerGroup)
      .forEach((pair, pos) => entries.push({ pair, gi, pos }));
  });
  entries.sort((a, b) => a.pos - b.pos || byPerformance(a.pair, b.pair) || a.gi - b.gi);
  avoidFirstRoundClashes(entries);
  return entries.map((e) => e.pair);
}

// Cuántos clasifican, de qué tamaño es el cuadro y cuántos pasan directo a la segunda ronda.
export function knockoutInfo(groupCount, advancePerGroup) {
  const groups = groupCount ?? 2;
  const qualifiers = groups * (advancePerGroup ?? 2);
  let size = 1;
  while (size < qualifiers) size *= 2;
  return { qualifiers, size, byes: size - qualifiers, groups };
}

const POSITIONS = [
  ["primero", "primeros"],
  ["segundo", "segundos"],
  ["tercero", "terceros"],
  ["cuarto", "cuartos"],
  ["quinto", "quintos"],
  ["sexto", "sextos"],
];

// Quiénes pasan directo: la siembra reparte los lugares libres primero entre los primeros de grupo,
// luego entre los segundos, etc. (dentro de cada puesto, los de mejor rendimiento).
function byePositionsText(byes, groups) {
  const parts = [];
  let left = byes;
  let partial = false;
  for (let pos = 0; left > 0; pos++) {
    const take = Math.min(left, groups);
    const [one, many] = POSITIONS[pos] || [`${pos + 1}.º`, `${pos + 1}.º`];
    if (take === groups) parts.push(`todos los ${many}${pos === 0 ? " de grupo" : ""}`);
    else {
      partial = true;
      parts.push(take === 1 ? `el mejor ${one}${pos === 0 ? " de grupo" : ""}` : `los ${take} mejores ${many}${pos === 0 ? " de grupo" : ""}`);
    }
    left -= take;
  }
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0];
  return { text, partial };
}

// Frase para el organizador cuando el cuadro necesita pasa directo (null si es exacto).
export function knockoutByesText({ qualifiers, byes, groups = 2 }) {
  if (byes <= 0) return null;
  const { text, partial } = byePositionsText(byes, groups);
  const verb = byes === 1 ? "pasa" : "pasan";
  const base = `Con ${qualifiers} parejas clasificadas, ${verb} directo a la segunda ronda ${text}.`;
  return partial ? `${base} Entre los de un mismo puesto, se ordenan por victorias y diferencia.` : base;
}

// Los resultados de grupos se cierran al iniciar la eliminatoria: el cuadro sale de esas tablas y
// modificarlas lo dejaría incoherente.
export function mundialitoGroupsLocked(t) {
  return t?.phase === "knockout";
}

// Se puede volver a la fase de grupos mientras no se haya jugado ningún partido real de la eliminatoria.
export function canReopenMundialito(t) {
  return t?.phase === "knockout" && !hasPlayedRealMatch(t.knockoutBracket);
}

export function reopenMundialitoPatch() {
  return { knockoutBracket: null, phase: "groups" };
}

export function buildKnockoutFromGroups(groups, advancePerGroup) {
  return buildBracket(seedQualifiers(groups, advancePerGroup), { consolation: false });
}
