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
