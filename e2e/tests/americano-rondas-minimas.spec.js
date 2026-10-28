/**
 * Americano: la cantidad de rondas escrita en "Otro" debe ser de al menos 2.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMERICRONDAS";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("escribir 1 ronda avisa y no se guarda; 2 rondas sí", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Americano rondas", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 6, useLevels: false, goldenPoint: true },
    playerInputs: ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  const otro = page.locator('input[placeholder="Otro"][min="2"]');
  await expect(otro).toBeVisible({ timeout: 8000 });
  await otro.fill("1");
  await expect(page.getByTestId("error-rondas")).toContainText("Mínimo 2 rondas");
  await page.waitForTimeout(900);   // más que el debounce de guardado
  expect((await getTournamentData(CODE)).config.maxRounds).toBe(6);

  await otro.fill("2");
  await expect(page.getByTestId("error-rondas")).toHaveCount(0);
  await expect.poll(async () => (await getTournamentData(CODE)).config.maxRounds).toBe(2);
});
