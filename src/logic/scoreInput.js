// ── Casillas de marcador ─────────────────────────────────────
// Los marcadores son enteros: se bloquean la coma, el punto, el menos y la e, y se avisa por qué, en
// lugar de descartar la tecla en silencio ("6,5" quedaba como 65).
import { showToast } from "./toast";

const BLOCKED_KEYS = ["-", "e", ".", ","];

export function blockNonIntegerKey(e) {
  if (!BLOCKED_KEYS.includes(e.key)) return;
  e.preventDefault();
  showToast("Escribe solo números enteros, sin coma ni punto.");
}

// Enter (o "Siguiente" en el teclado del móvil) pasa a la casilla de marcador siguiente; en la última se
// cierra el teclado para que se vea el botón de guardar.
export function goToNextScore(el) {
  const all = [...el.ownerDocument.querySelectorAll("input[data-score]")].filter((i) => !i.disabled && i.offsetParent !== null);
  const next = all[all.indexOf(el) + 1];
  if (next) {
    next.focus();
    next.select?.();
  } else {
    el.blur();
  }
}

export function onScoreKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    goToNextScore(e.currentTarget);
    return;
  }
  blockNonIntegerKey(e);
}

// Para esparcir en cada <input> de marcador
export const scoreInputProps = { "data-score": "", enterKeyHint: "next", onKeyDown: onScoreKeyDown };
