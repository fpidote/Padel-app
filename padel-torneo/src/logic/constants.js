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

export const TOURNAMENT_RULES = {
  americano: [
    "Todos los partidos se juegan a un número fijo de puntos (ej. 24 o 32 puntos) o por tiempo.",
    "Cada punto que gana la pareja, suma directamente a la clasificación individual de ambos jugadores.",
    "Al terminar la ronda, los jugadores cambian de pista y de pareja según su clasificación (los mejores suben, los de abajo bajan).",
    "Gana el jugador que más puntos individuales acumule al final de todas las rondas."
  ],
  relampago: [
    "Eliminación directa. El que gana avanza, el que pierde queda eliminado (o pasa al cuadro de consolación).",
    "En caso de empate al límite de tiempo, se juega un Punto de Oro.",
    "El cuadro se genera automáticamente."
  ],
  mundialito: [
    "Fase de grupos inicial: Todos juegan contra todos dentro de su grupo.",
    "Victoria suma 3 puntos, empate suma 1 punto, derrota 0 puntos.",
    "Los mejores de cada grupo avanzan a la fase eliminatoria (cuadro final).",
    "El desempate en la tabla se define por la diferencia de juegos (GF - GC)."
  ],
  pozo: [
    "La Pista 1 es la 'Pista Rey' o 'El Pozo'. Las demás van en orden descendente.",
    "Partidos por tiempo estricto. Al sonar la campana, se anota el resultado y se detiene el juego.",
    "Los ganadores de cada pista SUBEN una pista (hacia la Pista 1).",
    "Los perdedores de cada pista BAJAN una pista.",
    "El objetivo es terminar en la Pista 1 al final del tiempo total del torneo."
  ]
};