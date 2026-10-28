// ── Parejas repetidas ────────────────────────────────────────
// Una pareja es la misma aunque se escriba en otro orden o con otras mayúsculas.
import { normalizeName } from "./americano";

export const pairKey = (p1, p2) => [normalizeName(p1), normalizeName(p2)].sort().join("|");

// ¿Ya hay una pareja igual? Sirve para avisar al cargarla, sin bloquear.
export function isDuplicatePair(p1, p2, pairs) {
  if (normalizeName(p1) === "" || normalizeName(p2) === "") return false;
  const key = pairKey(p1, p2);
  return (pairs || []).some((p) => pairKey(p.p1, p.p2) === key);
}

// Claves de las parejas que aparecen más de una vez, para marcarlas en la lista.
export function duplicatePairKeys(pairs) {
  const seen = new Set();
  const dup = new Set();
  (pairs || []).forEach((p) => {
    if (normalizeName(p.p1) === "" || normalizeName(p.p2) === "") return;
    const key = pairKey(p.p1, p.p2);
    if (seen.has(key)) dup.add(key);
    seen.add(key);
  });
  return dup;
}

// Jugadores de una pareja nueva que ya están en otra pareja distinta (la misma persona en dos equipos).
// Sirve para avisar al cargarla, sin bloquear. Si la pareja entera se repite, ese caso ya tiene su aviso.
export function repeatedPlayersInNewPair(p1, p2, pairs) {
  if (isDuplicatePair(p1, p2, pairs)) return [];
  const found = [];
  const seen = new Set();
  [p1, p2].forEach((name) => {
    const key = normalizeName(name);
    if (key === "" || seen.has(key)) return;
    seen.add(key);
    const other = (pairs || []).find((p) => normalizeName(p.p1) === key || normalizeName(p.p2) === key);
    if (other) found.push({ name: String(name).trim(), pair: `${other.p1} / ${other.p2}` });
  });
  return found;
}

// Nombres (normalizados) que están en más de una pareja de la lista, para marcarlos.
export function duplicatePlayerKeys(pairs) {
  const count = new Map();
  (pairs || []).forEach((p) => {
    new Set([normalizeName(p.p1), normalizeName(p.p2)]).forEach((key) => {
      if (key) count.set(key, (count.get(key) || 0) + 1);
    });
  });
  return new Set([...count].filter(([, n]) => n > 1).map(([key]) => key));
}
