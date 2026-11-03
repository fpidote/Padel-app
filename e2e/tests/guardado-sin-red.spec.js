/**
 * Sin conexión, Guardar avisa y NO borra lo escrito: con la red de vuelta se repite y se guarda.
 * Antes las casillas se vaciaban al pulsar Guardar y el organizador tenía que reescribir el marcador.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "SINREDGUARD";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("Liga: sin red, Guardar avisa y conserva el marcador; con red se guarda", async ({ page, context }) => {
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Sin red", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: pairs, pairs,
    rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
    matches: [
      { id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "", scoreB: "", saved: false, sets: null },
      { id: "r1_m1", round: 1, pairA: pairs[2], pairB: pairs[3], scoreA: "", scoreB: "", saved: false, sets: null },
    ],
    knockoutBracket: null,
  });
  await entrar(page);
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });
  await casillas.nth(0).fill("6");
  await casillas.nth(1).fill("2");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect(page.getByText(/sin conexión/i).first()).toBeVisible();
  // El marcador sigue en las casillas
  await expect(casillas.nth(0)).toHaveValue("6");
  await expect(casillas.nth(1)).toHaveValue("2");

  await context.setOffline(false);
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).matches[0].saved, { timeout: 15000 }).toBe(true);
  expect((await getTournamentData(CODE)).matches[0]).toMatchObject({ scoreA: "6", scoreB: "2" });
});

test("Americano: sin red, Guardar conserva el marcador de la pista", async ({ page, context }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Sin red", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
    playerInputs: ["Ana", "Beto", "Caro", "Dani", "Eva", "Fede", "Gus", "Hugo"].map((name) => ({ name, level: 0 })),
  });
  await entrar(page);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });
  await casillas.nth(0).fill("7");
  await casillas.nth(1).fill("3");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect(page.getByText(/sin conexión/i).first()).toBeVisible();
  await expect(casillas.nth(0)).toHaveValue("7");
  await expect(casillas.nth(1)).toHaveValue("3");

  await context.setOffline(false);
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).currentRound?.[0]?.saved, { timeout: 15000 }).toBe(true);
});
