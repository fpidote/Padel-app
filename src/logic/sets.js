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
