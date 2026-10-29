/**
 * Liga: el organizador avisa al pasar de jornada y puede renombrar jugadores con el torneo empezado.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "LIGARENOM";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
const match = (id, round, a, b, saved) => ({
  id, round, pairA: pairs[a], pairB: pairs[b], scoreA: saved ? "6" : "", scoreB: saved ? "2" : "", saved, sets: null,
});
const liga = () => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: true,
  config: { name: "Renombrar", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
  pairInputs: pairs, pairs,
  rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
  matches: [
    match("r1_m0", 1, 0, 1, true), match("r1_m1", 1, 2, 3, true),
    match("r2_m0", 2, 0, 2, false), match("r2_m1", 2, 1, 3, false),
    match("r3_m0", 3, 0, 3, false), match("r3_m1", 3, 1, 2, false),
  ],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
}

test("Siguiente jornada pide confirmación al organizador", async ({ page }) => {
  await seedTournament(CODE, liga());
  await entrarComoAdmin(page);
  await page.getByTestId("chip-jornada-1").click({ timeout: 8000 });
  await page.getByTestId("btn-siguiente-jornada").click();
  const modal = page.locator(".fixed.inset-0");
  await expect(modal.getByText(/Vas a pasar a la jornada 2/)).toBeVisible();
  await modal.getByRole("button", { name: "Siguiente jornada" }).click();
  await expect(page.getByText("Jornada 2", { exact: true })).toBeVisible();
});

test("el organizador renombra un jugador y el cambio llega a partidos y tabla", async ({ page }) => {
  await seedTournament(CODE, liga());
  await entrarComoAdmin(page);
  await page.getByRole("button", { name: /Posiciones/ }).click({ timeout: 8000 });
  await page.getByTestId("btn-renombrar").click();
  await page.getByLabel("Jugador 2 de Ana / Beto").fill("Bernardo");
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Ana / Bernardo").first()).toBeVisible();
  await expect.poll(async () => {
    const d = await getTournamentData(CODE);
    return [d.pairs[0].p2, d.matches[0].pairA.p2, d.matches[2].pairA.p2];
  }).toEqual(["Bernardo", "Bernardo", "Bernardo"]);
});
