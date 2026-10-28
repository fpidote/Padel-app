// ── Reglas de un set de pádel ────────────────────────────────
// Válidos: 6-0 … 6-4, 7-5 y 7-6 (en cualquier sentido).
export function validateSet(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return "Ingresa games válidos";
  }
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === lo) return "Un set no puede terminar empatado";
  const ok = (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
  return ok ? null : "Set inválido. Válidos: 6-0 a 6-4, 7-5 o 7-6";
}

// Marcador por games (un solo resultado, sin sets) tal como está en los inputs. Devuelve el motivo por el
// que no se puede guardar, o null si es válido o todavía falta escribir un lado.
export const MAX_GAMES_SCORE = 99;

export function validateGamesScore(rawA, rawB) {
  const a = String(rawA ?? "").trim();
  const b = String(rawB ?? "").trim();
  if (a === "" || b === "") return null;
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return "Usa números enteros, sin decimales ni negativos";
  if (Number(a) > MAX_GAMES_SCORE || Number(b) > MAX_GAMES_SCORE) return `El máximo es ${MAX_GAMES_SCORE}`;
  if (Number(a) === Number(b)) return "Un partido no puede terminar empatado";
  return null;
}

// Quita de `ls` (los inputs en pantalla) todo lo escrito para un partido: games y casillas de sets.
export function clearScoreInputs(ls, matchId) {
  const prefix = `${matchId}_`;
  const isOwn = (key) => key.startsWith(prefix) && /^(A|B|set\d+_[AB])$/.test(key.slice(prefix.length));
  return Object.fromEntries(Object.entries(ls).filter(([key]) => !isOwn(key)));
}

// rows: [{a: "6", b: "4"}, ...] tal como están en los inputs.
// Recorre en orden y se detiene en el primer set incompleto, inválido o cuando alguien ya ganó.
export function analyzeSets(rows, setsNeeded) {
  const sets = [];
  let setsA = 0;
  let setsB = 0;
  let error = null;
  let errorIndex = null;

  for (let i = 0; i < rows.length && setsA < setsNeeded && setsB < setsNeeded; i++) {
    const rawA = rows[i]?.a ?? "";
    const rawB = rows[i]?.b ?? "";
    if (rawA === "" || rawB === "") break;
    const a = parseInt(rawA, 10);
    const b = parseInt(rawB, 10);
    const msg = validateSet(a, b);
    if (msg) {
      error = msg;
      errorIndex = i;
      break;
    }
    sets.push({ a, b });
    if (a > b) setsA++;
    else setsB++;
  }

  return { sets, setsA, setsB, finished: setsA === setsNeeded || setsB === setsNeeded, error, errorIndex };
}
