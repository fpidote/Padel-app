// ── Ayudantes de torneo ──────────────────────────────────────
// Un ayudante se identifica por el correo de su cuenta de Google. La coincidencia es exacta (en minúsculas):
// no se normalizan puntos ni alias, para no dar acceso a otra persona por error.

export const MAX_HELPERS = 5;

export const normalizeEmail = (raw) => String(raw ?? "").trim().toLowerCase();

export const isValidEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));

// Motivo por el que no se puede añadir ese correo, o null si se puede.
export function validateNewHelper(raw, currentEmails) {
  if (!isValidEmail(raw)) return "Escribe un correo válido";
  const email = normalizeEmail(raw);
  if ((currentEmails || []).some((e) => normalizeEmail(e) === email)) return "Ese correo ya es ayudante";
  if ((currentEmails || []).length >= MAX_HELPERS) return `Máximo ${MAX_HELPERS} ayudantes por torneo`;
  return null;
}

// Dueño del torneo: manda el campo de primer nivel del documento, que las reglas protegen. El ownerUid que
// va dentro de `data` lo puede reescribir un ayudante, así que solo se usa si el documento no trae el otro.
export function tournamentOwnerUid(docOwnerUid, data) {
  return docOwnerUid || data?.ownerUid || null;
}
