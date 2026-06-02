// ── Utilities ────────────────────────────────────────────────
export function buildShareMessage(t, code) {
  const lines = [];
  const formatEmoji = { americano: "🔄", relampago: "⚡", mundialito: "🌍", pozo: "👑" };
  lines.push(`${formatEmoji[t.type] || "🎾"} *${t.config.name}*`);
  lines.push("");

  if (t.config.datetime) {
    const d = new Date(t.config.datetime);
    const fecha = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    const hora  = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    lines.push(`📅 ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`);
    lines.push(`🕐 ${hora}`);
  }
  if (t.config.location?.trim()) {
    lines.push(`📍 ${t.config.location.trim()}`);
  }

  const scoringLabels = {
    timed: `⏱️ ${t.config.matchMinutes || 10} min por partido · ${t.config.timedMetric === "points" ? "puntos acumulados" : "games ganados"}`,
    rally: `🎯 Rally scoring · ${t.config.rallyPoints || 24} puntos por partido`,
    games: `🏆 Al mejor de ${t.config.targetGames || 6} games`,
  };
  lines.push(scoringLabels[t.config.scoringSystem || "timed"]);
  lines.push(`🏓 ${t.config.courts} pista${t.config.courts > 1 ? "s" : ""}`);

  if (t.config.description?.trim()) {
    lines.push("");
    lines.push(`📝 ${t.config.description.trim()}`);
  }

  lines.push("");
  lines.push(`👉 Síguelo en vivo: https://padeldesk.app/torneo/${code}`);
  return lines.join("\n");
}

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const pk = (a, b) => String(a) <= String(b) ? `${a}_${b}` : `${b}_${a}`;
export const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();



