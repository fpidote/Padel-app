// ── Cola de guardado ─────────────────────────────────────────
// Escribe el estado del torneo de uno en uno y sin perder cambios: lo que se pida mientras hay una
// escritura en curso espera y se junta en un único guardado posterior con el estado MÁS RECIENTE
// (cada estado ya contiene los anteriores, porque se arma sobre el estado en pantalla).
// Antes un guardado pedido durante otro se descartaba en silencio y la pareja, el resultado o el ajuste
// se perdían sin aviso.
//
// write(state, baseVer) → Promise que guarda ese estado; baseVer es la versión sobre la que se armó.
// onFailure(lastSaved, err) → se llama una vez por fallo; lastSaved es el último estado confirmado, al
//                que hay que volver porque los cambios pendientes partían del que falló.
// onConflict(serverState) → write lanzó VersionConflictError: se descartan los cambios pendientes, se da
//                por confirmado el estado del servidor y se avisa una vez.
// Otro organizador guardó antes: el guardado no se pisa y se devuelve el estado que hay en el servidor.
export class VersionConflictError extends Error {
  constructor(serverState) {
    super("Conflicto de versión");
    this.name = "VersionConflictError";
    this.serverState = serverState;
  }
}

export function createSaveQueue({ write, onFailure = () => {}, onConflict = () => {} }) {
  let confirmed = null;
  let current = null; // lote que se está escribiendo: { state, resolvers }
  let next = null; // lote en espera

  async function run() {
    while (current) {
      const batch = current;
      try {
        await write(batch.state, batch.baseVer);
      } catch (err) {
        const dropped = [batch, next].filter(Boolean);
        current = null;
        next = null;
        if (err instanceof VersionConflictError) {
          confirmed = err.serverState;
          onConflict(err.serverState);
        } else {
          onFailure(confirmed, err);
        }
        dropped.forEach((b) => b.resolvers.forEach((resolve) => resolve(false)));
        return;
      }
      confirmed = batch.state;
      current = next;
      next = null;
      batch.resolvers.forEach((resolve) => resolve(true));
    }
  }

  // Resuelve true cuando ese estado (o uno posterior que lo incluye) quedó guardado, false si falló.
  function save(state) {
    return new Promise((resolve) => {
      // baseVer: versión sobre la que se armó el lote. Se fija al pedirlo, no al escribir: si mientras tanto
      // llega por el listener lo que guardó otro organizador, este lote debe detectar el conflicto.
      if (!current) {
        current = { state, baseVer: confirmed?.ver, resolvers: [resolve] };
        run();
      } else if (!next) {
        next = { state, baseVer: current.state.ver, resolvers: [resolve] };
      } else {
        next.state = state;
        next.resolvers.push(resolve);
      }
    });
  }

  return {
    save,
    // Estado que se sabe guardado (el último escrito o el que llegó del servidor)
    confirm: (state) => { confirmed = state; },
    lastSaved: () => confirmed,
    isSaving: () => current !== null,
  };
}
