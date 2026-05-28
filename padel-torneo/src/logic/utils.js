// ── Utilities ────────────────────────────────────────────────
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const pk = (a, b) => `${Math.min(a, b)}_${Math.max(a, b)}`;
export const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();



