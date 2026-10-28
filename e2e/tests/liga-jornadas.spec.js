/**
 * Liga: se ve una jornada a la vez con un selector (como las rondas del Americano). Abre en la primera jornada
 * con partidos pendientes, y "Todas" muestra el calendario completo.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament } from "../helpers/seed.js";

const CODE = "LIGAJORN1";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
const match = (id, round, a, b, saved) => ({
  id, round, pairA: pairs[a], pairB: pairs[b], scoreA: saved ? "6" : "", scoreB: saved ? "2" : "", saved, sets: null,
});
const liga = (savedRounds) => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: savedRounds.length > 0,
  config: { name: "Jornadas", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
  pairInputs: pairs, pairs,
  rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
  matches: [
    match("r1_m0", 1, 0, 1, savedRounds.includes(1)), match("r1_m1", 1, 2, 3, savedRounds.includes(1)),
    match("r2_m0", 2, 0, 2, savedRounds.includes(2)), match("r2_m1", 2, 1, 3, savedRounds.includes(2)),
    match("r3_m0", 3, 0, 3, savedRounds.includes(3)), match("r3_m1", 3, 1, 2, savedRounds.includes(3)),
  ],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function verComoEspectador(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
}

test("abre en la primera jornada con partidos pendientes y muestra solo esa", async ({ page }) => {
  await seedTournament(CODE, liga([1]));
  await verComoEspectador(page);
  await expect(page.getByText("Jornada 2", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Jornada 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Jornada 3", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("chip-jornada-1")).toContainText("✓");
  await expect(page.getByTestId("chip-jornada-2")).not.toContainText("✓");
});

test("el selector cambia de jornada y 'Todas' muestra el calendario completo", async ({ page }) => {
  await seedTournament(CODE, liga([1]));
  await verComoEspectador(page);
  await expect(page.getByText("Jornada 2", { exact: true })).toBeVisible({ timeout: 8000 });
  await page.getByTestId("chip-jornada-3").click();
  await expect(page.getByText("Jornada 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Jornada 2", { exact: true })).toHaveCount(0);
  await page.getByTestId("chip-jornada-todas").click();
  await expect(page.getByText("Jornada 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Jornada 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Jornada 3", { exact: true })).toBeVisible();
});

test("con una jornada completa aparece 'Siguiente jornada' y lleva a la que sigue", async ({ page }) => {
  await seedTournament(CODE, liga([1]));
  await verComoEspectador(page);
  await page.getByTestId("chip-jornada-1").click();
  await expect(page.getByText("Jornada 1", { exact: true })).toBeVisible({ timeout: 8000 });
  await page.getByTestId("btn-siguiente-jornada").click();
  await expect(page.getByText("Jornada 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("btn-siguiente-jornada")).toHaveCount(0);
});

test("con toda la liga jugada abre en la última jornada", async ({ page }) => {
  await seedTournament(CODE, liga([1, 2, 3]));
  await verComoEspectador(page);
  await expect(page.getByText("Jornada 3", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Jornada 1", { exact: true })).toHaveCount(0);
});
