/**
 * Torneo por grupos terminado: la pestaña Posiciones muestra el podio (campeón, subcampeón y 3.º si se
 * jugó ese partido), la tabla de cada grupo y los resultados de la fase final.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament } from "../helpers/seed.js";
import { buildGroups, buildKnockoutFromGroups } from "../../src/logic/mundialito.js";
import { advanceBracket } from "../../src/logic/relampago.js";

const CODE = "POSICIONESGRP";
const NAMES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"]];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

// Juega todos los partidos de grupo (gana siempre la pareja A) y recalcula las tablas
function gruposTerminados() {
  const pairs = NAMES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 }));
  const groups = buildGroups(pairs, 2);
  groups.forEach((g) => {
    g.matches.forEach((m, i) => { m.saved = true; m.scoreA = "6"; m.scoreB = String(i % 4); });
    g.standings = g.standings.map((s) => {
      const mine = g.matches.filter((m) => m.pairA.id === s.id || m.pairB.id === s.id);
      const gf = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreA : m.scoreB), 0);
      const gc = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreB : m.scoreA), 0);
      const wins = mine.filter((m) => m.pairA.id === s.id).length;
      return { ...s, played: mine.length, wins, pts: wins, gf, gc, gamesFor: gf, gamesAgainst: gc };
    });
  });
  return { pairs, groups };
}

function torneo({ thirdPlace, jugarFinal = true }) {
  const { pairs, groups } = gruposTerminados();
  let bracket = buildKnockoutFromGroups(groups, 2, { thirdPlace });
  if (jugarFinal) {
    for (const m of bracket.filter((x) => x.round === 1 && x.bracket === "winners")) bracket = advanceBracket(bracket, m.id, 6, 3);
    bracket = advanceBracket(bracket, "w_r2_m0", 6, 4);
    if (thirdPlace) bracket = advanceBracket(bracket, "w_third", 6, 2);
  }
  return {
    type: "mundialito",
    status: jugarFinal ? "finished" : "playing",
    phase: "knockout",
    scoringStarted: true,
    config: { name: "Grupos terminado", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games", thirdPlace },
    pairInputs: pairs,
    pairs,
    groups,
    knockoutBracket: bracket,
  };
}

test("con 3.º puesto: podio completo, una tabla por grupo y la fase final", async ({ page }) => {
  await seedTournament(CODE, torneo({ thirdPlace: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Posiciones/ }).click();

  // El torneo está sembrado como finalizado: el podio lo indica en su título
  await expect(page.getByText("🏁 Torneo finalizado")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Campeón", { exact: true })).toBeVisible();
  await expect(page.getByText("Subcampeón", { exact: true })).toBeVisible();
  await expect(page.getByText("Tercer puesto", { exact: true })).toBeVisible();
  // Una tabla por grupo, no una general
  await expect(page.getByText("🏆 Grupo A")).toBeVisible();
  await expect(page.getByText("🏆 Grupo B")).toBeVisible();
  await expect(page.getByText("🏆 Posiciones")).toHaveCount(0);
  // Los 4 clasificados llevan ⚡ y no hay medallas en las tablas de grupo
  await expect(page.locator('span[title="Pasó a la fase final"]')).toHaveCount(4);
  await expect(page.locator("td", { hasText: "🥇" })).toHaveCount(0);
  // Resultados de la fase final
  await expect(page.getByText("⚡ Fase final")).toBeVisible();
  await expect(page.getByText("Semifinales", { exact: true })).toBeVisible();
  // El partido por el 3.º puesto va en su propia sección, no dentro de la final
  await expect(page.getByText("3.º y 4.º puesto", { exact: true })).toBeVisible();
  await expect(page.locator("div.px-4.pb-3", { has: page.getByText("Final", { exact: true }) }).locator("div.flex.items-center")).toHaveCount(1);
  await page.screenshot({ path: "test-results/posiciones-grupos-390.png", fullPage: true });
});

test("sin partido por el 3.º puesto el podio solo tiene campeón y subcampeón", async ({ page }) => {
  await seedTournament(CODE, torneo({ thirdPlace: false }));
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("Subcampeón", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Tercer puesto", { exact: true })).toHaveCount(0);
  // Sin partido por el 3.º no se inventa un tercero: se muestran los dos semifinalistas
  await expect(page.getByText("Semifinalistas", { exact: true })).toBeVisible();
});

test("mientras la final no se juega no hay podio, pero sí las tablas de grupo", async ({ page }) => {
  await seedTournament(CODE, torneo({ thirdPlace: true, jugarFinal: false }));
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("🏆 Grupo A")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Resultado final")).toHaveCount(0);
});
