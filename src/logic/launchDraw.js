// ── Sorteo previo al inicio ──────────────────────────────────
// El sorteo se genera una vez para mostrarlo en "Revisar y lanzar" y ese mismo resultado es el
// que se guarda al iniciar (startPatch recibe el sorteo en vez de volver a generarlo).
import { buildGroups } from "./mundialito";
import { buildLigaFixture } from "./liga";

const TYPES_WITH_DRAW = ["mundialito", "liga"];

export function hasDraw(type) {
  return TYPES_WITH_DRAW.includes(type);
}

export function pairsForStart(pairInputs) {
  return (pairInputs || []).map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
}

// Identifica los datos de los que depende el sorteo. Si cambia, el sorteo guardado ya no vale.
export function drawKey(t) {
  return JSON.stringify([t.type, t.pairInputs, t.config?.groupCount, t.config?.idaYVuelta]);
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
  return {};
}
