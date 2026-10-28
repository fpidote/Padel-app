/**
 * Americano: al cargar jugadores avisa de un nombre repetido (sin impedir agregarlo) y lo marca en la lista.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMERICNOMBRES";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("avisa de un nombre repetido sin impedir agregarlo, y lo marca en la lista", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Americano nombres", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 1, useLevels: false, goldenPoint: true },
    playerInputs: [{ name: "Alice", level: 0 }, { name: "Bob", level: 0 }],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  const campo = page.getByPlaceholder("Nombre del jugador...");
  await expect(campo).toBeVisible({ timeout: 8000 });

  await campo.fill("Bobby");
  await expect(page.getByTestId("aviso-nombre-repetido")).toHaveCount(0);

  await campo.fill("  alice ");
  const aviso = page.getByTestId("aviso-nombre-repetido");
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText("Ya hay un jugador llamado");

  await campo.press("Enter");   // se agrega igual
  await expect.poll(async () => (await getTournamentData(CODE)).playerInputs.length).toBe(3);
  await expect(page.getByText("⚠️ repetido")).toHaveCount(2);
  await expect(page.getByTestId("aviso-nombre-repetido")).toHaveCount(0);
});
