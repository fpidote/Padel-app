// ── Avisos en pantalla ───────────────────────────────────────
// Un emisor mínimo: cualquier parte de la app llama a showToast y el componente Toaster, montado
// una sola vez en App.jsx, los muestra. Sustituye a los alert() del navegador.
const listeners = new Set();
let nextId = 1;

// type: "error" (por defecto) o "ok"
export function showToast(message, type = "error") {
  const toast = { id: nextId++, message, type };
  listeners.forEach((listener) => listener(toast));
  return toast.id;
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
