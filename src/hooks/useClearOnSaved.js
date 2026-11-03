// src/hooks/useClearOnSaved.js
// Las casillas de marcador (ls) son del dispositivo: si OTRA pantalla guarda, corrige o abre la corrección de un
// partido, lo que aquí se había escrito para él queda obsoleto y no debe reaparecer (ni dejarse guardar encima).
// Se mira el estado CONFIRMADO por el servidor (`serverT`, incluidos los guardados de esta pantalla), no el
// optimista, para no borrar lo escrito mientras un guardado propio está en curso o falla.
// items: [{ key, sig }] con la misma clave que usan las casillas (`${key}_A`, `${key}_set0_B`...) y la firma
// del partido (matchSig). ownWrite: la confirmación viene de esta misma pantalla; entonces no se borra nada
// (lo hace el propio guardado al entrar) porque ya se pudo empezar a escribir otra corrección.
import { useEffect, useRef } from "react";
import { clearScoreInputs } from "../logic/sets";

// Lo que identifica el estado de un partido para las casillas: guardado, en corrección, marcador y sets
export const matchSig = (m) => [m.saved ? 1 : 0, m.editing ? 1 : 0, m.scoreA ?? "", m.scoreB ?? "", JSON.stringify(m.sets ?? null)].join("|");

export function useClearOnSaved(items, setLs, ownWrite = false) {
  const previous = useRef(null);
  const signature = items.map((i) => `${i.key}:${i.sig}`).join("#");

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(items.map((i) => [String(i.key), i.sig]));
    if (!before || ownWrite) return;
    const changed = items.filter((i) => before.has(String(i.key)) && before.get(String(i.key)) !== i.sig).map((i) => i.key);
    if (changed.length) setLs((ls) => changed.reduce((acc, key) => clearScoreInputs(acc, key), ls));
    // items se recalcula en cada render; la firma resume lo que importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
