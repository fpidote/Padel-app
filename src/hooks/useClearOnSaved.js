// src/hooks/useClearOnSaved.js
// Las casillas de marcador (ls) son del dispositivo: si otra pantalla guarda ese partido, lo que aquí se había
// escrito sin guardar queda obsoleto y no debe reaparecer al corregirlo (ni dejarse guardar encima).
// Se mira el estado CONFIRMADO por el servidor (`serverT`), no el optimista, para no borrar lo escrito cuando
// un guardado propio todavía está en curso o falla: solo cuando el servidor dice que el partido pasó a guardado.
// items: [{ key, saved }] con la misma clave que usan las casillas (`${key}_A`, `${key}_set0_B`...).
// ownWrite: la confirmación viene de un guardado de esta misma pantalla; entonces no se borra nada (lo hace el
// propio guardado al entrar) porque ya se pudo empezar a escribir otra corrección.
import { useEffect, useRef } from "react";
import { clearScoreInputs } from "../logic/sets";

export function useClearOnSaved(items, setLs, ownWrite = false) {
  const previous = useRef(null);
  const signature = items.map((i) => `${i.key}:${i.saved ? 1 : 0}`).join("|");

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(items.map((i) => [String(i.key), !!i.saved]));
    if (!before || ownWrite) return;
    const nowSaved = items.filter((i) => i.saved && before.get(String(i.key)) === false).map((i) => i.key);
    if (nowSaved.length) setLs((ls) => nowSaved.reduce((acc, key) => clearScoreInputs(acc, key), ls));
    // items se recalcula en cada render; la firma resume lo que importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
