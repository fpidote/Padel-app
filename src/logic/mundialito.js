// ── Mundialito Logic ─────────────────────────────────────────
import { shuffle } from "./utils";
import { buildBracket, firstRoundSeedPairs, hasPlayedRealMatch, bracketComplete } from "./relampago";
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
export const MIN_PAIRS = 6;
export const MIN_GROUP_SIZE = 3;

// Un torneo por grupos necesita al menos 2 grupos de 3 parejas; con menos es una liga o un relámpago.
// Dentro de eso decide el organizador, salvo que pase todo un grupo (no habría eliminados).
export function validateMundialitoConfig(pairCount, groupCount, advancePerGroup, extraQualifiers = 0) {
  const maxGroups = Math.floor(pairCount / MIN_GROUP_SIZE);
  // Los grupos quedan parejos salvo por una pareja: el más chico tiene floor(parejas ÷ grupos)
  const maxAdvance = groupCount >= 1 ? Math.max(0, Math.floor(pairCount / groupCount) - 1) : 0;
  // Los extra son los mejores del siguiente puesto: menos que los grupos (si no pasaría todo ese puesto)
  const maxExtra = Math.max(0, groupCount - 1);
  let error = null;
  if (pairCount < MIN_PAIRS) {
    error = `Necesitas al menos ${MIN_PAIRS} parejas (2 grupos de 3). Con menos, usa Liga o Relámpago.`;
  } else if (groupCount < 2) {
    error = "Necesitas al menos 2 grupos";
  } else if (groupCount > maxGroups) {
    error = `Con ${pairCount} parejas el máximo es ${maxGroups} ${maxGroups === 1 ? "grupo" : "grupos"} (mínimo ${MIN_GROUP_SIZE} parejas por grupo)`;
  } else if (advancePerGroup < 1 || advancePerGroup > maxAdvance) {
    error = `Con ${groupCount} grupos pueden avanzar como máximo ${maxAdvance} por grupo (no puede pasar todo el grupo)`;
  } else if (extraQualifiers > maxExtra) {
    error = `Con ${groupCount} grupos pueden pasar como máximo ${maxExtra} ${positionName(advancePerGroup, maxExtra)} extra`;
  }
  return { ok: error === null, maxGroups, maxAdvance, maxExtra, error };
}

// Formatos sugeridos para el organizador según cuántas parejas tiene: cada uno dice cuántos grupos y de
// qué tamaño, cuántos partidos juega cada pareja, cuántos clasifican y si el cuadro necesita pasa directo.
// Grupos de 3 parejas o más, sin que pase todo el grupo y hasta 16 clasificados. Primero los
// recomendados (grupos parejos y cuadro exacto: 4, 8 o 16 clasificados).
function formatOption(pairCount, groupCount, advancePerGroup, extraQualifiers = 0) {
  const base = Math.floor(pairCount / groupCount);
  const extra = pairCount % groupCount;
  // buildGroups reparte por turnos: los primeros grupos quedan con una pareja más
  const groupSizes = Array.from({ length: groupCount }, (_, i) => (i < extra ? base + 1 : base));
  const { qualifiers, byes, size } = knockoutInfo(groupCount, advancePerGroup, extraQualifiers);
  return {
    groupCount,
    advancePerGroup,
    extraQualifiers,
    groupSizes,
    matchesPerPair: [base - 1, extra > 0 ? base : base - 1],
    groupMatches: groupSizes.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0),
    qualifiers,
    bracketSize: size,
    byes,
    recommended: extra === 0 && byes === 0 && qualifiers >= 4,
  };
}

// Resumen de cualquier configuración (la sugerida o la manual); null si no es válida para esas parejas.
export function describeFormat(pairCount, groupCount, advancePerGroup, extraQualifiers = 0) {
  if (!validateMundialitoConfig(pairCount, groupCount, advancePerGroup, extraQualifiers).ok) return null;
  return formatOption(pairCount, groupCount, advancePerGroup, extraQualifiers);
}

export function mundialitoFormatOptions(pairCount) {
  const options = [];
  for (let groupCount = 2; groupCount <= Math.floor(pairCount / 3); groupCount++) {
    for (let advancePerGroup = 1; advancePerGroup < Math.floor(pairCount / groupCount); advancePerGroup++) {
      // Sin extra siempre; con mejores del siguiente puesto solo si completan un cuadro exacto
      for (let extra = 0; extra < groupCount; extra++) {
        const { qualifiers, byes } = knockoutInfo(groupCount, advancePerGroup, extra);
        if (qualifiers > 16 || (extra > 0 && (byes > 0 || qualifiers < 4))) continue;
        options.push(formatOption(pairCount, groupCount, advancePerGroup, extra));
      }
    }
  }
  // Menos clasificados primero, los formatos sin extra antes que sus variantes con extra y, a igualdad,
  // más grupos (menos partidos por pareja)
  const rank = (o) => [o.recommended ? 0 : 1, o.groupSizes[0] === o.groupSizes[o.groupSizes.length - 1] ? 0 : 1, o.byes, o.qualifiers, o.extraQualifiers > 0 ? 1 : 0];
  return options.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return b.groupCount - a.groupCount || a.advancePerGroup - b.advancePerGroup || a.extraQualifiers - b.extraQualifiers;
  });
}

const STAGE_LABELS = { 2: "Final", 4: "Semifinales", 8: "Cuartos", 16: "Octavos" };

// Etapa a la que llega un formato = tamaño del cuadro final (2 = final, 4 = semifinales...).
export const stageLabel = (size) => STAGE_LABELS[size] ?? `Cuadro de ${size}`;
// Texto del botón de filtro: "4 (semifinales)" = pasan 4 parejas y el cuadro empieza en semifinales.
export const stageChoiceLabel = (size) => `${size} (${stageLabel(size).toLowerCase().replace(" de final", "")})`;
export const availableStages = (options) => [...new Set(options.map((o) => o.bracketSize))].sort((a, b) => a - b);
export const optionsForStage = (options, size) => (size ? options.filter((o) => o.bracketSize === size) : options);

const KNOCKOUT_STAGE = { 2: "final", 4: "semifinales y final", 8: "cuartos de final", 16: "octavos de final", 32: "dieciseisavos de final" };

export function formatTitle(o) {
  const sizes = [...new Set(o.groupSizes)].sort((a, b) => b - a).join(" y ");
  const extra = extraQualifiersText(o.advancePerGroup, o.extraQualifiers);
  return `${o.groupCount} grupos de ${sizes} · ${o.advancePerGroup === 1 ? "pasa 1" : `pasan ${o.advancePerGroup}`} de cada grupo${extra ? ` + ${extra}` : ""}`;
}

export function formatDetail(o) {
  const [min, max] = o.matchesPerPair;
  const matches = min === max ? `${min} partidos` : `${min} o ${max} partidos`;
  const { size } = knockoutInfo(o.groupCount, o.advancePerGroup, o.extraQualifiers);
  const direct = o.byes > 0 ? `, ${o.byes} ${o.byes === 1 ? "pasa" : "pasan"} directo` : "";
  return `Cada pareja juega ${matches} · ${o.groupMatches} partidos en grupos · Clasifican ${o.qualifiers}: ${KNOCKOUT_STAGE[size] ?? "cuadro final"}${direct}`;
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
export function seedQualifiers(groups, advancePerGroup, extraQualifiers = 0, crossing = "performance") {
  if (crossing === "classic" && classicCrossingApplicable(groups.length, advancePerGroup, extraQualifiers)) {
    return classicSeedList(groups);
  }
  const entries = [];
  const candidates = [];
  groups.forEach((g, gi) => {
    const sorted = sortStandings(g.standings, g.matches || []);
    sorted.slice(0, advancePerGroup).forEach((pair, pos) => entries.push({ pair, gi, pos }));
    // Los extra salen del puesto siguiente de cada grupo, comparados por rendimiento por partido
    if (extraQualifiers > 0 && sorted[advancePerGroup]) candidates.push({ pair: sorted[advancePerGroup], gi, pos: advancePerGroup });
  });
  candidates
    .sort((a, b) => byPerformance(a.pair, b.pair) || a.gi - b.gi)
    .slice(0, extraQualifiers)
    .forEach((c) => entries.push(c));
  entries.sort((a, b) => a.pos - b.pos || byPerformance(a.pair, b.pair) || a.gi - b.gi);
  avoidFirstRoundClashes(entries);
  return entries.map((e) => e.pair);
}

// ── Cruce clásico por grupos: el 1º de un grupo contra el 2º del otro ─────────────────────────
// Solo está definido con 2, 4 u 8 grupos pasando 2 y sin extras (cuadro exacto, sin pasa directo).
// En los demás casos (3 grupos, pasa directo, mejores terceros, pasa 1...) manda el rendimiento.
export function classicCrossingApplicable(groupCount, advancePerGroup, extraQualifiers = 0) {
  return [2, 4, 8].includes(groupCount) && advancePerGroup === 2 && !extraQualifiers;
}

// "classic" por defecto cuando aplica; el organizador puede elegir "performance" (config.crossing).
export function crossingMode(config) {
  const applicable = classicCrossingApplicable(config?.groupCount ?? 2, config?.advancePerGroup ?? 2, config?.extraQualifiers || 0);
  return applicable && config?.crossing !== "performance" ? "classic" : "performance";
}

// Cruces de la primera ronda en el orden del cuadro, como { group, pos } (pos 1 = primero). La mitad
// de arriba enfrenta a los primeros de los grupos A, C, E... con los segundos de B, D, F...; la de
// abajo, al revés. Así dos parejas del mismo grupo solo pueden volver a verse en la final.
export function classicFirstRound(groupCount) {
  const top = [];
  const bottom = [];
  for (let g = 0; g < groupCount; g += 2) {
    top.push([{ group: g, pos: 1 }, { group: g + 1, pos: 2 }]);
    bottom.push([{ group: g + 1, pos: 1 }, { group: g, pos: 2 }]);
  }
  return [...top, ...bottom];
}

// Clasificados ordenados como siembra para que buildBracket forme exactamente esos cruces.
function classicSeedList(groups) {
  const ranked = groups.map((g) => sortStandings(g.standings, g.matches || []));
  const desired = classicFirstRound(groups.length).map(([a, b]) => [ranked[a.group][a.pos - 1], ranked[b.group][b.pos - 1]]);
  const list = Array(groups.length * 2);
  firstRoundSeedPairs(list.length).forEach(([x, y], i) => {
    list[x] = desired[i][0];
    list[y] = desired[i][1];
  });
  return list;
}

// Cruces de la primera ronda con las tablas de hoy (provisional). null hasta que cada grupo haya
// jugado algún partido: antes de eso las tablas están en cero y los cruces serían arbitrarios.
export function projectedFirstRound(groups, config) {
  if (!groups.length || !groups.every((g) => g.standings.some((s) => (s.played || 0) > 0))) return null;
  const bracket = buildKnockoutFromGroups(groups, config.advancePerGroup ?? 2, {
    extraQualifiers: config.extraQualifiers || 0,
    crossing: crossingMode(config),
  });
  return bracket.filter((m) => m.bracket === "winners" && m.round === 1).sort((a, b) => a.matchIndex - b.matchIndex);
}

// Cuántos clasifican, de qué tamaño es el cuadro y cuántos pasan directo a la segunda ronda.
export function knockoutInfo(groupCount, advancePerGroup, extraQualifiers = 0) {
  const groups = groupCount ?? 2;
  const qualifiers = groups * (advancePerGroup ?? 2) + (extraQualifiers || 0);
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

// "tercero" / "terceros" para el puesto que sigue a los que pasan directo (advancePerGroup + 1).
export function positionName(advancePerGroup, count) {
  const pos = advancePerGroup;
  const [one, many] = POSITIONS[pos] || [`${pos + 1}.º`, `${pos + 1}.º`];
  return count === 1 ? one : many;
}

// "los 2 mejores terceros" / "el mejor segundo" (null si no hay extra)
export function extraQualifiersText(advancePerGroup, extraQualifiers) {
  if (!extraQualifiers) return null;
  const name = positionName(advancePerGroup, extraQualifiers);
  return extraQualifiers === 1 ? `el mejor ${name}` : `los ${extraQualifiers} mejores ${name}`;
}

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
  return t?.phase === "knockout" || t?.status === "finished";
}

// Se puede volver a la fase de grupos mientras no se haya jugado ningún partido real de la eliminatoria.
export function canReopenMundialito(t) {
  return t?.status !== "finished" && t?.phase === "knockout" && !hasPlayedRealMatch(t.knockoutBracket);
}

// ¿Se puede cerrar el torneo? Con la fase final completa (final y, si hay, partido por el 3.º puesto).
export function mundialitoCanFinish(t) {
  return !!t && t.status !== "finished" && t.phase === "knockout" && bracketComplete(t.knockoutBracket);
}

export function reopenMundialitoPatch() {
  return { knockoutBracket: null, phase: "groups" };
}

export function buildKnockoutFromGroups(groups, advancePerGroup, { thirdPlace = false, extraQualifiers = 0, crossing = "performance" } = {}) {
  return buildBracket(seedQualifiers(groups, advancePerGroup, extraQualifiers, crossing), { consolation: false, thirdPlace });
}

// ¿Se juega el partido por el 3.º y 4.º puesto? Solo con la opción activada y semifinales
// (4 clasificados o más).
export function mundialitoThirdPlace(config) {
  return !!config?.thirdPlace && knockoutInfo(config.groupCount, config.advancePerGroup, config.extraQualifiers).qualifiers >= 4;
}
