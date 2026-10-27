/**
 * Sin conexión: se avisa con un banner, los cambios no se intentan guardar a ciegas y todo vuelve
 * a funcionar al reconectar.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "SINCONEXION";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("sin conexión aparece un aviso, no se guarda a ciegas y al volver todo se recupera", async ({ page, context }) => {
  await seedTournament(CODE);
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  const nombre = page.getByTestId("input-tournament-name");
  await expect(nombre).toBeVisible({ timeout: 8000 });

  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión/).first()).toBeVisible({ timeout: 5000 });

  await page.setViewportSize({ width: 390, height: 700 });
  await page.screenshot({ path: "test-results/sin-conexion-390.png" });
  await nombre.fill("Cambio sin red");
  await expect(page.getByText(/No se guardaron los cambios: sin conexión/)).toBeVisible({ timeout: 5000 });
  expect((await getTournamentData(CODE)).config.name).not.toBe("Cambio sin red");

  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión/)).toHaveCount(0, { timeout: 8000 });
  await nombre.fill("Cambio con red");
  await expect.poll(async () => (await getTournamentData(CODE)).config.name, { timeout: 8000 }).toBe("Cambio con red");
});
