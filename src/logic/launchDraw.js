// ── Sorteo previo al inicio ──────────────────────────────────
// El sorteo se genera una vez para mostrarlo en "Revisar y lanzar" y ese mismo resultado es el
// que se guarda al iniciar (startPatch recibe el sorteo en vez de volver a generarlo).
import { buildGroups } from "./mundialito";
import { buildLigaFixture } from "./liga";
import { buildBracket } from "./relampago";
import { shuffle } from "./utils";

const TYPES_WITH_DRAW = ["mundialito", "liga", "relampago"];

export function hasDraw(type) {
  return TYPES_WITH_DRAW.includes(type);
}

// ¿Re-sortear da un resultado distinto? El Relámpago con orden de carga es siempre el mismo cuadro.
export function drawIsRandom(t) {
  if (!hasDraw(t.type)) return false;
  return t.type === "relampago" ? !t.config?.seedByOrder : true;
}

export function pairsForStart(pairInputs) {
  return (pairInputs || []).map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
}

// Identifica los datos de los que depende el sorteo. Si cambia, el sorteo guardado ya no vale.
export function drawKey(t) {
  return JSON.stringify([t.type, t.pairInputs, t.config?.groupCount, t.config?.idaYVuelta, !!t.config?.seedByOrder]);
}

export function buildStartDraw(t) {
  const pairs = pairsForStart(t.pairInputs);
  if (t.type === "mundialito") {
    return { groups: buildGroups(pairs, t.config?.groupCount || 2) };
  }
  if (t.type === "liga") {
    const { rounds, matches, pairs: standings } = buildLigaFixture(pairs, t.config?.idaYVuelta || false);
    return { rounds, matches, standings };
  }
  if (t.type === "relampago") {
    // Sin orden de carga el cuadro se sortea. Las parejas conservan su numeración (el sorteo
    // solo reordena el cuadro), igual que antes de que existiera el sorteo.
    const seeding = t.config?.seedByOrder ? pairs : shuffle(pairs);
    return { bracket: buildBracket(seeding) };
  }
  return null;
}

// Campos del torneo que cambian al iniciar, usando el sorteo recibido (o generando uno).
export function startPatch(t, draw) {
  const d = draw || buildStartDraw(t);
  if (t.type === "mundialito") {
    return { groups: d.groups, pairs: pairsForStart(t.pairInputs), phase: "groups" };
  }
  if (t.type === "liga") {
    return { rounds: d.rounds, matches: d.matches, pairs: d.standings, phase: "fixture" };
  }
  if (t.type === "relampago") {
    return { bracket: d.bracket, pairs: pairsForStart(t.pairInputs), phase: "bracket" };
  }
  return {};
}
