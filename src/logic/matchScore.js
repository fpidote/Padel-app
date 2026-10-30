import { analyzeSets, validateGamesScore } from "./sets";

export const isSetsFormat = (scoringFormat) => scoringFormat === "sets3" || scoringFormat === "sets5";

// Estado de un marcador a partir de lo escrito en las casillas. Lo comparten MatchCard y la tarjeta de
// Relámpago para decidir si se puede guardar y qué se muestra mientras se escribe.
//   setRows: [{ a: "6", b: "4" }, ...] (una por set posible; solo se usa por sets)
//   gamesA / gamesB: lo escrito en las casillas de games (solo se usa por games)
export function matchScoreState(scoringFormat, { setRows = [], gamesA = "", gamesB = "" } = {}) {
  const bySets = isSetsFormat(scoringFormat);
  const maxSets = scoringFormat === "sets5" ? 5 : 3;
  const setsNeeded = maxSets === 5 ? 3 : 2;
  const rows = Array.from({ length: maxSets }, (_, i) => ({ a: setRows[i]?.a ?? "", b: setRows[i]?.b ?? "" }));
  const live = analyzeSets(rows, setsNeeded);

  const gA = parseInt(gamesA);
  const gB = parseInt(gamesB);
  const gamesError = bySets ? null : validateGamesScore(gamesA, gamesB);
  const gamesValid = !gamesError && !isNaN(gA) && !isNaN(gB) && gA >= 0 && gB >= 0 && gA !== gB;

  const isValid = bySets ? live.finished : gamesValid;
  return {
    bySets,
    maxSets,
    setsNeeded,
    live,
    // Filas de set a mostrar: los sets ya cargados y el siguiente pendiente
    visibleSetRows: live.finished ? live.sets.length : Math.min(live.sets.length + 1, maxSets),
    gamesError,
    isValid,
    scoreA: bySets ? live.setsA : gA,
    scoreB: bySets ? live.setsB : gB,
  };
}
