// ── Formato de partido ───────────────────────────────────────
// Una sola lista para elegir cómo se juega cada partido. Por debajo se siguen guardando
// scoringFormat ("games" | "sets3" | "sets5") y scoringSystem ("timed" | "rally" | "games"),
// así que los torneos ya creados no necesitan migración.

export const MATCH_FORMATS = [
  { id: "timed",  icon: "⏱️", name: "Por tiempo",     desc: "Se anota al terminar el tiempo",   system: "timed" },
  { id: "points", icon: "🎯", name: "Por puntos",     desc: "Cada punto ganado cuenta",         system: "rally" },
  { id: "games",  icon: "🏆", name: "Por games",      desc: "Primero en llegar a X games",      system: "games" },
  { id: "sets3",  icon: "🎾", name: "Mejor de 3 sets", desc: "Se anota set por set (ej. 6-2, 6-4)", isSets: true },
  { id: "sets5",  icon: "🎾", name: "Mejor de 5 sets", desc: "Se anota set por set (ej. 6-2, 6-4)", isSets: true },
];

export function availableMatchFormats(allowSets) {
  return MATCH_FORMATS.filter((f) => allowSets || !f.isSets);
}

// Opción elegida según la configuración guardada.
export function matchFormatOf(config) {
  const cfg = config || {};
  if (cfg.scoringFormat === "sets3" || cfg.scoringFormat === "sets5") return cfg.scoringFormat;
  const system = cfg.scoringSystem || "timed";
  return MATCH_FORMATS.find((f) => f.system === system)?.id ?? "timed";
}

// Texto corto para el resumen previo al inicio: nombre del formato y su detalle.
export function matchFormatSummary(config) {
  const cfg = config || {};
  const id = matchFormatOf(cfg);
  const format = MATCH_FORMATS.find((f) => f.id === id);
  if (format.isSets) return { label: format.name, detail: "Se anota set por set" };
  if (id === "timed") {
    const metric = (cfg.timedMetric ?? "games") === "games" ? "Games ganados" : "Puntos acumulados";
    return { label: format.name, detail: `${cfg.matchMinutes ?? 10} min · ${metric}` };
  }
  if (id === "points") return { label: format.name, detail: `${cfg.rallyPoints ?? 24} puntos por partido` };
  return { label: format.name, detail: `${cfg.targetGames ?? 6} games para ganar` };
}

// Cambios de configuración al elegir una opción. En sets solo cambia el formato y se conserva
// el sistema anterior. El Americano no tiene scoringFormat: includeFormat=false.
export function matchFormatPatch(formatId, { includeFormat = true } = {}) {
  const format = MATCH_FORMATS.find((f) => f.id === formatId);
  if (!format) return {};
  if (format.isSets) return { scoringFormat: format.id };
  return includeFormat
    ? { scoringFormat: "games", scoringSystem: format.system }
    : { scoringSystem: format.system };
}
