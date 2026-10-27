/**
 * Americano: pasar a la siguiente ronda avisa de que los resultados de la ronda se cierran.
 * Cancelar no cambia nada; confirmar avanza a la ronda siguiente.
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
} from "../helpers/seed.js";

const CODE = "NEXTRND";

function torneoEnRonda1() {
  const players = [
    { id: 0, name: "Alice", level: 0, pts: 0, gf: 0, gc: 0 },
    { id: 1, name: "Bob", level: 0, pts: 0, gf: 0, gc: 0 },
    { id: 2, name: "Carol", level: 0, pts: 0, gf: 0, gc: 0 },
    { id: 3, name: "Dave", level: 0, pts: 0, gf: 0, gc: 0 },
  ];
  const guardada = {
    pairA: [players[0], players[1]],
    pairB: [players[2], players[3]],
    scoreA: "10", scoreB: "8", saved: true,
  };
  const pendiente = {
    pairA: [players[0], players[2]],
    pairB: [players[1], players[3]],
    scoreA: "", scoreB: "", saved: false,
  };
  return {
    status: "playing",
    roundNum: 1,
    players,
    currentRound: [guardada],
    sittingOut: [],
    precomputedRounds: [
      { courts: [guardada], sittingOut: [] },
      { courts: [pendiente], sittingOut: [] },
      { courts: [pendiente], sittingOut: [] },
    ],
    rounds: [],
    partnerHistory: {},
    sitOutHistory: {},
    config: {
      name: "Test siguiente ronda",
      courts: 1,
      matchmaking: "americano",
      mode: "individual",
      scoringSystem: "timed",
      matchMinutes: 10,
      maxRounds: 3,
      useLevels: false,
      goldenPoint: true,
    },
  };
}

test.beforeEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
}

test("Siguiente Ronda avisa y cancelar no avanza", async ({ page }) => {
  await seedTournament(CODE, torneoEnRonda1());
  await entrarComoAdmin(page);

  await page.getByRole("button", { name: /Siguiente Ronda/ }).click();
  const modal = page.locator(".fixed.inset-0");
  await expect(modal.getByText(/ya no se podrán modificar/)).toBeVisible();
  await modal.getByRole("button", { name: "Cancelar" }).click();
  await expect(modal).toHaveCount(0);

  const data = await getTournamentData(CODE);
  expect(data.roundNum).toBe(1);
  expect(data.rounds).toHaveLength(0);
});

test("Siguiente Ronda confirmada cierra la ronda y pasa a la siguiente", async ({ page }) => {
  await seedTournament(CODE, torneoEnRonda1());
  await entrarComoAdmin(page);

  await page.getByRole("button", { name: /Siguiente Ronda/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Siguiente ronda", exact: true }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).roundNum, { timeout: 8000 }).toBe(2);
  const data = await getTournamentData(CODE);
  expect(data.rounds).toHaveLength(1);
  // Los puntos de la ronda 1 se aplicaron a quienes ganaron
  expect(data.players.find((p) => p.id === 0).pts).toBe(1);
});
