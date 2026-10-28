// src/logic/constants.js
import { knockoutInfo, knockoutByesText, mundialitoThirdPlace, extraQualifiersText, crossingMode } from "./mundialito";
import { ligaQualifiers, ligaThirdPlace } from "./liga";

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
    desc: "Eliminación directa con cuadro de revancha. Quien pierde su primer partido sigue jugando.",
    tagline: "Acción rápida y revancha",
    landingDesc: "Eliminación directa con cuadro de consolación. Perdés una vez y seguís jugando.",
    tags: ["Bracket", "Con consolación"],
    color: "#7c3aed",
  },
  {
    id: "mundialito",
    name: "Torneo por grupos",
    icon: "👥",
    desc: "Fase de grupos y cuadro final. Los mejores de cada grupo pasan a las eliminatorias.",
    tagline: "Grupos y cuadro final",
    landingDesc: "Todos juegan en su grupo y los mejores pasan al cuadro final.",
    tags: ["Grupos + cuadro final", "8+ jugadores"],
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
    // Oculto al crear: sus parejas que descansan casi no rotan y la regla subir/bajar solo se cumple a medias.
    // Los Pozos ya creados siguen abriéndose con normalidad.
    hidden: true,
  },
  {
    id: "liga",
    name: "Liga",
    icon: "📅",
    desc: "Todos contra todos en una tabla única, a lo largo de varias jornadas.",
    tagline: "Una tabla, muchas fechas",
    landingDesc: "Parejas fijas que juegan todas contra todas. Ideal para competencias de varias semanas con tabla de posiciones.",
    tags: ["Todos vs todos", "Ida o ida y vuelta"],
    color: "#db2777",
  },
];

// Formatos que se ofrecen al crear un torneo (landing y modal de Home).
export const CREATABLE_TYPES = TOURNAMENT_TYPES.filter((t) => !t.hidden);

const THIRD_PLACE_RULE = "Los perdedores de las semifinales juegan el partido por el 3.º y 4.º puesto.";

export function generateRules(type, config, context = {}) {
  function scoringDesc() {
    return scoringDescFor(config);
  }

  function scoringDescFor(config) {
    if (config.scoringFormat === "sets3") return "Partidos al mejor de 3 sets. Se carga el resultado set por set.";
    if (config.scoringFormat === "sets5") return "Partidos al mejor de 5 sets. Se carga el resultado set por set.";
    const s = config.scoringSystem || "timed";
    if (s === "rally") return `Partidos en rally scoring a ${config.rallyPoints ?? 24} puntos.`;
    if (s === "games") return `Partidos al primero en llegar a ${config.targetGames ?? 6} juegos.`;
    const metric = (config.timedMetric ?? "games") === "games" ? "juegos" : "puntos";
    return `Partidos de ${config.matchMinutes ?? 10} minutos. El resultado se anota en ${metric}.`;
  }

  function goldenPointDesc() {
    return config.goldenPoint !== false
      ? "En el 40-40 de un game se juega un único punto decisivo (punto de oro)."
      : "En el 40-40 de un game se juega con ventaja.";
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
        rotationDesc = `${config.mode === "pairs" ? "Gana la pareja" : "Gana el jugador"} con más partidos ganados; si empatan, decide la diferencia de ${metric}.`;
      } else if (config.mode === "individual" || !config.mode) {
        rotationDesc = matchmaking === "mexicano"
          ? "Emparejamiento Mexicano: desde ronda 2 los mejores juegan entre sí, por eso pueden repetirse compañeros y rivales. Para máxima variedad, usa el Clásico."
          : "Americano: parejas aleatorias cada ronda según clasificación.";
      } else {
        rotationDesc = "Modo parejas: las parejas rotan juntas según su clasificación.";
      }
      const roundsDesc = numRounds
        ? `El torneo tiene ${numRounds} rondas en total.`
        : config.maxRounds
          ? `El torneo tiene ${config.maxRounds} rondas en total.`
          : "Sin límite de rondas fijo; el organizador decide cuándo terminar.";
      const timedTiebreak = !config.scoringFormat?.startsWith("sets") && (config.scoringSystem || "timed") === "timed"
        ? ["Si al terminar el tiempo van igualados en el marcador, se decide cerrando el game en juego o con un punto de oro, según defina el organizador."]
        : [];
      const rankMetric = (config.scoringSystem || "timed") === "games" || ((config.scoringSystem || "timed") === "timed" && (config.timedMetric ?? "games") === "games") ? "juegos" : "puntos";
      const rules = [
        scoringDesc(),
        `Clasificación: partidos ganados y, si empatan, diferencia de ${rankMetric} a favor y en contra.`,
        ...timedTiebreak,
        goldenPointDesc(),
        rotationDesc,
        roundsDesc,
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego simultáneamente.`,
      ];
      return rules;
    }
    case "relampago":
      return [
        "Eliminación directa. Quien pierde su primer partido pasa al cuadro de revancha y sigue jugando; quien pierde después queda eliminado.",
        scoringDesc(),
        goldenPointDesc(),
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego. El cuadro se genera automáticamente.`,
      ];
    case "mundialito":
      return [
        `${config.groupCount ?? 2} ${(config.groupCount ?? 2) === 1 ? "grupo" : "grupos"} en fase inicial. Los ${config.advancePerGroup ?? 2} mejores de cada grupo avanzan a eliminatorias.`,
        "Clasifica quien gane más partidos. No hay empates.",
        ...(config.extraQualifiers > 0
          ? [`Además pasan ${extraQualifiersText(config.advancePerGroup ?? 2, config.extraQualifiers)} de todos los grupos. Se comparan por victorias por partido jugado y, si empatan, por diferencia.`]
          : []),
        ...[knockoutByesText(knockoutInfo(config.groupCount, config.advancePerGroup, config.extraQualifiers))].filter(Boolean),
        crossingMode(config) === "classic"
          ? "Cruces de la fase final: el 1º del Grupo A contra el 2º del Grupo B, el 1º del Grupo B contra el 2º del Grupo A, y así con el resto de los grupos. Dos parejas del mismo grupo solo se reencuentran en la final."
          : "Cruces de la fase final: los clasificados se ordenan por puesto en el grupo y por rendimiento por partido, y se enfrenta al mejor clasificado contra el peor (sin repetir grupo en la primera ronda cuando se puede).",
        ...(mundialitoThirdPlace(config) ? [THIRD_PLACE_RULE] : []),
        "Desempate: 1º el resultado del partido entre las parejas igualadas, 2º diferencia entre lo que anotan a favor y en contra, 3º diferencia de games.",
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
    case "liga": {
      const ligaConfig = { ...config, scoringFormat: config.scoringFormat || "sets3" };
      const bySets = ligaConfig.scoringFormat === "sets3" || ligaConfig.scoringFormat === "sets5";
      const rules = [
        config.idaYVuelta
          ? "Todas las parejas juegan entre sí a doble vuelta (ida y vuelta)."
          : "Todas las parejas juegan entre sí una vez (ida).",
        "Victoria = 1 punto · Derrota = 0 puntos (no hay empates).",
        scoringDescFor(ligaConfig),
        ...(bySets ? ["Si un set llega a 6-6 se juega tie-break y el set se anota 7-6 para quien lo gana."] : []),
        goldenPointDesc(),
        bySets
          ? "Desempate: 1º el resultado del partido entre las parejas igualadas, 2º diferencia de sets, 3º diferencia de games."
          : "Desempate: 1º el resultado del partido entre las parejas igualadas, 2º diferencia entre lo anotado a favor y en contra.",
      ];
      if (config.playoffEnabled) {
        rules.push(`Al terminar la tabla, los ${context.pairCount ? ligaQualifiers(config, context.pairCount) : (config.advanceQualifiers ?? 4)} mejores clasificados juegan una fase eliminatoria.`);
        if (ligaThirdPlace(config, context.pairCount ?? 99)) rules.push(THIRD_PLACE_RULE);
      } else {
        rules.push("Sin fase final: el campeón es quien queda primero en la tabla.");
      }
      return rules;
    }
    default:
      return [];
  }
}
