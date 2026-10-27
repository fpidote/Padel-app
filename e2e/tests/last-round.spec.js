/**
 * Regression test: con 2 rondas precomputadas, la última ronda muestra
 * "Finalizar Torneo" (no "Siguiente Ronda"); al pulsarlo el torneo queda como
 * "Torneo Finalizado" sin crear una ronda fantasma.
 *
 * Bug original: la condición usaba `roundNum > length` en vez de `roundNum >= length`,
 * lo que permitía clickear "Siguiente Ronda" al finalizar la última ronda.
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
  TEST_UID,
} from "../helpers/seed.js";

const CODE = "LRTEST";

// Torneo en ronda 2 (última de 2) con scores ya guardados — allSaved = true
function playingTournament() {
  const players = [
    { id: 0, name: "Alice", level: 2, pts: 10, gf: 10, gc: 8 },
    { id: 1, name: "Bob",   level: 1, pts: 10, gf: 10, gc: 8 },
    { id: 2, name: "Carol", level: 2, pts: 0,  gf: 8,  gc: 10 },
    { id: 3, name: "Dave",  level: 1, pts: 0,  gf: 8,  gc: 10 },
  ];
  const courtDone = {
    pairA: [players[0], players[1]],
    pairB: [players[2], players[3]],
    scoreA: "10", scoreB: "8", saved: true,
  };
  const courtTemplate = {
    pairA: [players[0], players[1]],
    pairB: [players[2], players[3]],
    scoreA: "", scoreB: "", saved: false,
  };
  return {
    status: "playing",
    roundNum: 2,
    players,
    currentRound: [courtDone],   // scores guardados → allSaved = true
    sittingOut: [],
    precomputedRounds: [
      { courts: [courtTemplate], sittingOut: [] },
      { courts: [courtTemplate], sittingOut: [] },
    ],
    rounds: [{ num: 1, courts: [courtDone], sittingOut: [] }],
    partnerHistory: {},
    sitOutHistory: {},
    config: {
      name: "Test 2 rondas",
      courts: 1,
      matchmaking: "americano",
      mode: "individual",
      scoringSystem: "timed",
      matchMinutes: 10,
      maxRounds: 2,
      useLevels: true,
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

async function signInAsAdmin(page) {
  const token = await getTestToken();
  await page.evaluate(async (t) => {
    await window.__e2eSignIn(t);
  }, token);
}

test("en la última ronda el botón dice Finalizar Torneo y al pulsarlo termina sin crear ronda extra", async ({ page }) => {
  await seedTournament(CODE, playingTournament());
  await page.goto(`/torneo/${CODE}`);

  // Loguearse como admin para que el botón sea visible (requiere allSaved && isAdmin)
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);

  // En la última ronda el botón es "Finalizar Torneo" (no "Siguiente Ronda") y se puede pulsar
  const finish = page.getByRole("button", { name: /Finalizar Torneo/i });
  await expect(finish).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: /Siguiente Ronda/i })).toHaveCount(0);
  await finish.click();
  // Al finalizar se avisa de que los resultados de la ronda se cierran
  const modal = page.locator(".fixed.inset-0");
  await expect(modal.getByText(/ya no se podrán modificar/)).toBeVisible();
  await modal.getByRole("button", { name: "Finalizar", exact: true }).click();

  // Al finalizar queda "Torneo Finalizado" (deshabilitado) y el historial tiene solo las 2 rondas jugadas
  await expect(page.getByRole("button", { name: /Torneo Finalizado/i })).toBeVisible({ timeout: 8000 });
  // La escritura a Firestore es asíncrona: esperar a que llegue en vez de leer una sola vez
  await expect.poll(async () => (await getTournamentData(CODE)).rounds.length, { timeout: 8000 }).toBe(2);
  const data = await getTournamentData(CODE);
  expect(data.currentRound).toEqual([]);
  expect(data.status).toBe("playing");
});
