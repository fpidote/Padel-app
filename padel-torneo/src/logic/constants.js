// src/logic/constants.js

// Definimos la función B aquí para que sea accesible desde cualquier archivo
export const B = (bg, ex = {}) => ({
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  ...ex,
});

export const TOURNAMENT_TYPES = [
  {
    id: "americano",
    name: "Americano",
    icon: "🔄",
    desc: "Individual, rotativo.",
    color: "#0284c7",
  },
  {
    id: "relampago",
    name: "Relámpago",
    icon: "⚡",
    desc: "Parejas fijas. Eliminación.",
    color: "#7c3aed",
  },
  {
    id: "mundialito",
    name: "Mundialito",
    icon: "🌍",
    desc: "Grupos + eliminatorias.",
    color: "#059669",
  },
  {
    id: "pozo",
    name: "El Pozo",
    icon: "👑",
    desc: "Rey de la pista.",
    color: "#d97706",
  },
];
