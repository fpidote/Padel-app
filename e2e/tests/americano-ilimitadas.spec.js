/**
 * Americano Mexicano con "Ilimitadas" (sin rondas fijadas): el organizador puede finalizar el torneo
 * desde la ronda 2, con confirmación, y queda con podio.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMERILIMIT";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("Mexicano con rondas ilimitadas: se puede finalizar desde la ronda 2", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Ilimitadas", courts: 2, matchmaking: "mexicano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: null, useLevels: false, goldenPoint: true },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });

  const jugarRonda = async (resultados) => {
    for (const [a, b] of resultados) {
      await casillas.nth(0).fill(String(a));
      await casillas.nth(1).fill(String(b));
      await page.getByRole("button", { name: "Guardar resultado" }).first().click();
      await page.waitForTimeout(400);
    }
  };

  // Ronda 1: todavía no se ofrece finalizar (el mínimo es 2 rondas)
  await jugarRonda([[9, 5], [4, 11]]);
  await expect(page.getByRole("button", { name: /Siguiente Ronda/ })).toBeVisible();
  await expect(page.getByTestId("btn-finalizar-ahora")).toHaveCount(0);
  await page.getByRole("button", { name: /Siguiente Ronda/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Siguiente ronda", exact: true }).click();

  // Ronda 2: ya se puede finalizar sin esperar a una "última ronda"
  await expect(page.getByText(/Ronda 2/).first()).toBeVisible({ timeout: 8000 });
  await jugarRonda([[10, 6], [8, 12]]);
  await expect(page.getByTestId("btn-finalizar-ahora")).toBeVisible();
  await page.getByTestId("btn-finalizar-ahora").click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).status, { timeout: 8000 }).toBe("finished");
  await expect(page.getByText("🏁 Torneo finalizado").first()).toBeVisible();
  await expect(page.getByTestId("btn-finalizar-ahora")).toHaveCount(0);
});
