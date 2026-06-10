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
    tagline: "Todos mezclados",
    landingDesc: "Individual o por parejas, Clásico o Mexicano. Los cruces se organizan solos buscando variedad de rivales.",
    tags: ["Individual o parejas", "Rotativo"],
    color: "#0284c7",
  },
  {
    id: "relampago",
    name: "Relámpago",
    icon: "⚡",
    desc: "Eliminación directa con cuadro de revancha. El que pierde sigue jugando.",
    tagline: "Acción rápida y revancha",
    landingDesc: "Eliminación directa con cuadro de consolación. Perdés una vez y seguís jugando.",
    tags: ["Bracket", "Con consolación"],
    color: "#7c3aed",
  },
  {
    id: "mundialito",
    name: "Mundialito",
    icon: "🌍",
    desc: "Fase de grupos estilo FIFA seguida de eliminatorias directas.",
    tagline: "Como el Mundial, en tu cancha",
    landingDesc: "Fase de grupos y eliminatorias directas. Todos juegan, los mejores se clasifican.",
    tags: ["Grupos + KO", "8+ jugadores"],
    color: "#059669",
  },
  {
    id: "pozo",
    name: "El Pozo",
    icon: "👑",
    desc: "Rey de la pista. Los ganadores suben, los perdedores bajan cada ronda.",
    tagline: "Solo queda el rey",
    landingDesc: "Ganadores suben de pista, perdedores bajan. La presión y la dificultad aumentan ronda a ronda.",
    tags: ["King of the Hill", "Sin eliminados"],
    color: "#d97706",
  },
];

export function generateRules(type, config, context = {}) {
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
      const matchmaking = config.matchmaking || "americano";
      const numRounds = context.numRounds;
      let rotationDesc;
      if (matchmaking === "manual") {
        const s = config.scoringSystem || "timed";
        const metric = s === "games" ? "juegos"
          : s === "rally" ? "puntos"
          : (config.timedMetric ?? "games") === "games" ? "juegos" : "puntos";
        rotationDesc = (config.mode === "parejas")
          ? `La pareja que acumule más ${metric} al final del torneo gana.`
          : `El jugador que acumule más ${metric} al final del torneo gana.`;
      } else if (config.mode === "individual" || !config.mode) {
        rotationDesc = matchmaking === "mexicano"
          ? "Emparejamiento Mexicano: desde ronda 2 los mejores juegan entre sí."
          : "Americano: parejas aleatorias cada ronda según clasificación.";
      } else {
        rotationDesc = "Modo parejas: las parejas rotan juntas según su clasificación.";
      }
      const roundsDesc = numRounds
        ? `El torneo tiene ${numRounds} rondas en total.`
        : config.maxRounds
          ? `El torneo tiene ${config.maxRounds} rondas en total.`
          : "Sin límite de rondas fijo; el organizador decide cuándo terminar.";
      const rules = [
        scoringDesc(),
        goldenPointDesc(),
        rotationDesc,
        roundsDesc,
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego simultáneamente.`,
      ];
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
