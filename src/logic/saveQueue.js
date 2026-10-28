// ── Cola de guardado ─────────────────────────────────────────
// Escribe el estado del torneo de uno en uno y sin perder cambios: lo que se pida mientras hay una
// escritura en curso espera y se junta en un único guardado posterior con el estado MÁS RECIENTE
// (cada estado ya contiene los anteriores, porque se arma sobre el estado en pantalla).
// Antes un guardado pedido durante otro se descartaba en silencio y la pareja, el resultado o el ajuste
// se perdían sin aviso.
//
// write(state)  → Promise que guarda ese estado (setDoc).
// onFailure(lastSaved, err) → se llama una vez por fallo; lastSaved es el último estado confirmado, al
//                que hay que volver porque los cambios pendientes partían del que falló.
export function createSaveQueue({ write, onFailure = () => {} }) {
  let confirmed = null;
  let current = null; // lote que se está escribiendo: { state, resolvers }
  let next = null; // lote en espera

  async function run() {
    while (current) {
      const batch = current;
      try {
        await write(batch.state);
      } catch (err) {
        const dropped = [batch, next].filter(Boolean);
        current = null;
        next = null;
        onFailure(confirmed, err);
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
      if (!current) {
        current = { state, resolvers: [resolve] };
        run();
      } else if (!next) {
        next = { state, resolvers: [resolve] };
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
