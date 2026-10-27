// ── Sorteo previo al inicio ──────────────────────────────────
// El sorteo se genera una vez para mostrarlo en "Revisar y lanzar" y ese mismo resultado es el
// que se guarda al iniciar (startPatch recibe el sorteo en vez de volver a generarlo).
import { buildGroups } from "./mundialito";
import { buildLigaFixture } from "./liga";
import { buildBracket } from "./relampago";
import { buildPozoRound, shufflePlayers } from "./pozo";
import { shuffle } from "./utils";

const TYPES_WITH_DRAW = ["mundialito", "liga", "relampago", "pozo"];

export function hasDraw(type) {
  return TYPES_WITH_DRAW.includes(type);
}

// ¿Re-sortear da un resultado distinto? El Relámpago con orden de carga es siempre el mismo cuadro.
export function drawIsRandom(t) {
  if (!hasDraw(t.type)) return false;
  if (t.type === "relampago") return !t.config?.seedByOrder;
  // El Pozo mixer arma la primera ronda por orden de carga; con parejas fijas se sortean
  if (t.type === "pozo") return t.config?.pozoMode !== "mixer";
  return true;
}

export function pairsForStart(pairInputs) {
  return (pairInputs || []).map((p, i) => ({ ...p, id: i, pts: 0, gf: 0, gc: 0 }));
}

// Identifica los datos de los que depende el sorteo. Si cambia, el sorteo guardado ya no vale.
export function drawKey(t) {
  const pozo = t.type === "pozo" ? [t.config?.pozoMode, t.config?.courts, t.playerInputs] : null;
  return JSON.stringify([t.type, t.pairInputs, t.config?.groupCount, t.config?.idaYVuelta, !!t.config?.seedByOrder, pozo]);
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
  if (t.type === "pozo") return buildPozoDraw(t, pairs);
  return null;
}

// Primera ronda del Pozo. Con parejas fijas se sortean y quedan niveladas por orden; en mixer
// cada jugador arranca en la cancha que le toca por orden de carga y se arman equipos de dos.
function buildPozoDraw(t, pairs) {
  const courts = t.config?.courts;
  if (t.config?.pozoMode === "mixer") {
    const players = (t.playerInputs || []).map((p, i) => ({ ...p, courtLevel: i, pts: 0, gf: 0, gc: 0 }));
    const proposed = shufflePlayers(players, courts);
    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    const team = (ids) => {
      const [a, b] = ids.map((id) => byId[id]);
      return {
        id: `tmp_${a.id}_${b.id}`, _playerIds: [a.id, b.id],
        p1: a.name, p2: b.name, pts: 0, gf: 0, gc: 0,
        courtLevel: Math.round((a.courtLevel + b.courtLevel) / 2),
      };
    };
    const currentPozoRound = proposed.courts.map((court) => ({
      courtNum: court.courtNum,
      pairA: team(court.teamA.playerIds),
      pairB: team(court.teamB.playerIds),
      scoreA: "", scoreB: "", saved: false,
    }));
    return { mode: "mixer", players, currentPozoRound, sittingOut: proposed.unassigned || [] };
  }
  const sorted = shuffle(pairs).map((p, i) => ({ ...p, courtLevel: i }));
  return { mode: "fixed", pairs: sorted, currentPozoRound: buildPozoRound(sorted, courts) };
}

const POZO_RESET = {
  pozoRounds: [],
  roundNum: 1,
  phase: "playing",
  timerRunning: false,
  timerElapsed: 0,
  timerStartedAt: null,
};

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
  if (t.type === "pozo") {
    return d.mode === "mixer"
      ? { players: d.players, currentPozoRound: d.currentPozoRound, sittingOut: d.sittingOut, proposedRound: null, ...POZO_RESET }
      : { pairs: d.pairs, currentPozoRound: d.currentPozoRound, ...POZO_RESET };
  }
  return {};
}
