// src/logic/constants.js

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
    desc: "Rotativo por nivel. Las parejas cambian cada ronda según la clasificación.",
    color: "#0284c7",
  },
  {
    id: "relampago",
    name: "Relámpago",
    icon: "⚡",
    desc: "Eliminación directa con cuadro de revancha. El que pierde sigue jugando.",
    color: "#7c3aed",
  },
  {
    id: "mundialito",
    name: "Mundialito",
    icon: "🌍",
    desc: "Fase de grupos estilo FIFA seguida de eliminatorias directas.",
    color: "#059669",
  },
  {
    id: "pozo",
    name: "El Pozo",
    icon: "👑",
    desc: "Rey de la pista. Los ganadores suben, los perdedores bajan cada ronda.",
    color: "#d97706",
  },
];

export const TOURNAMENT_RULES = {
  americano: [
    "Los partidos se juegan por minijuegos cortos (ej. a terminar 2-1 o 3-2).",
    "En caso de llegar a un empate en juegos (ej. 2-2), se define con un Punto de Oro.",
    "El jugador o pareja que gana suma 1 punto en la tabla general, además de acumular la diferencia de juegos (GF y GC).",
    "Al terminar la ronda, los jugadores cambian de pista y de pareja según su clasificación (los mejores suben, los de abajo bajan).",
  ],
  relampago: [
    "Eliminación directa. El que gana avanza, el que pierde queda eliminado (o pasa al cuadro de Revancha).",
    "En caso de empate al límite de tiempo, se juega un Punto de Oro.",
    "El cuadro se genera automáticamente.",
  ],
  mundialito: [
    "Fase de grupos inicial: Todos juegan contra todos dentro de su grupo.",
    "Victoria suma 3 puntos, empate suma 1 punto, derrota 0 puntos.",
    "Los mejores de cada grupo avanzan a la fase eliminatoria (cuadro final).",
    "El desempate en la tabla se define por la diferencia de juegos (GF - GC).",
  ],
  pozo: [
    "La Pista 1 es la 'Pista Rey' o 'El Pozo'. Las demás van en orden descendente.",
    "Partidos por tiempo estricto. Al sonar la campana, se anota el resultado y se detiene el juego.",
    "Los ganadores de cada pista SUBEN una pista (hacia la Pista 1).",
    "Los perdedores de cada pista BAJAN una pista.",
    "El objetivo es terminar en la Pista 1 al final del tiempo total del torneo.",
  ],
};
