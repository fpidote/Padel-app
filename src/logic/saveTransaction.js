// ── Guardado con control de versión ──────────────────────────
// El torneo es un único documento y cada guardado lo reemplaza entero: si dos pantallas parten del mismo
// estado, la última pisaría a la primera sin aviso. Dentro de una transacción se comprueba que el servidor
// siga en la versión (`ver`) sobre la que se armó este cambio; si no, se lanza VersionConflictError con el
// estado del servidor y no se escribe nada.
import { VersionConflictError } from "./saveQueue";

// tx: transacción de Firestore (get/set). baseVer: versión del último estado que esta pantalla sabe guardado.
export async function applyVersionedWrite(tx, ref, state, baseVer) {
  const snap = await tx.get(ref);
  if (snap.exists()) {
    let server = null;
    try {
      server = JSON.parse(snap.data().data);
    } catch {
      server = null;
    }
    if (server) {
      // Un reintento de un guardado que sí había entrado no es un conflicto
      if (state.writeId && server.writeId === state.writeId) return;
      if ((server.ver ?? 0) !== (baseVer ?? 0)) throw new VersionConflictError(server);
    }
  }
  tx.set(ref, { data: JSON.stringify(state) }, { merge: true });
}
