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
