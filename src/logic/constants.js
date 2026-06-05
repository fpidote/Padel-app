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

export function generateRules(type, config) {
  function scoringDesc() {
    const s = config.scoringSystem || "timed";
    if (s === "rally") return `Partidos en rally scoring a ${config.rallyPoints ?? 24} puntos.`;
    if (s === "games") return `Partidos al primero en llegar a ${config.targetGames ?? 6} juegos.`;
    const metric = (config.timedMetric ?? "games") === "games" ? "juegos" : "puntos acumulados";
    return `Partidos de ${config.matchMinutes ?? 10} minutos. Se cuentan ${metric}.`;
  }

  function goldenPointDesc() {
    return config.goldenPoint !== false
      ? "En caso de empate se define con un Punto de Oro."
      : "Los empates cuentan como 1 punto para cada participante.";
  }

  switch (type) {
    case "americano": {
      const rules = [
        scoringDesc(),
        goldenPointDesc(),
        (config.mode === "individual" || !config.mode)
          ? "Modo individual: cada jugador rota solo según su clasificación."
          : "Modo parejas: las parejas rotan juntas según su clasificación.",
        config.maxRounds
          ? `El torneo tiene ${config.maxRounds} rondas en total.`
          : "Sin límite de rondas fijo; el organizador decide cuándo terminar.",
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego simultáneamente.`,
      ];
      if (config.useLevels) {
        rules.push("Los jugadores están divididos por nivel (N1/N2). Las rotaciones respetan los niveles.");
      }
      return rules;
    }
    case "relampago":
      return [
        "Eliminación directa. El que pierde pasa al cuadro de revancha y sigue jugando.",
        scoringDesc(),
        goldenPointDesc(),
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego. El cuadro se genera automáticamente.`,
      ];
    case "mundialito":
      return [
        `${config.groupCount ?? 2} ${(config.groupCount ?? 2) === 1 ? "grupo" : "grupos"} en fase inicial. Los ${config.advancePerGroup ?? 2} mejores de cada grupo avanzan a eliminatorias.`,
        "Victoria = 3 puntos · Empate = 1 punto · Derrota = 0 puntos.",
        "El desempate en tabla se define por diferencia de juegos (GF − GC).",
        scoringDesc(),
        goldenPointDesc(),
      ];
    case "pozo": {
      const courts = config.courts ?? 2;
      const rules = [
        `${courts} ${courts === 1 ? "pista" : "pistas"} en juego. La Pista 1 es El Pozo — el objetivo es llegar y mantenerse ahí.`,
        scoringDesc(),
        "Al sonar la campana: ganadores suben una pista, perdedores bajan una pista.",
      ];
      if (config.pozoMode === "fixed" && config.targetRounds) {
        rules.push(`El torneo tiene ${config.targetRounds} rondas en total.`);
      } else {
        rules.push("Sin límite de rondas fijo; el organizador para el torneo cuando lo decide.");
      }
      return rules;
    }
    default:
      return [];
  }
}
