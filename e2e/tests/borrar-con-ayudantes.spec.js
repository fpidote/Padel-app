/**
 * Borrar un torneo desde "Mis torneos" también borra sus ayudantes: la subcolección no se borra sola y, sin
 * el documento del torneo, nadie podría quitar esos correos después (las reglas piden ser el dueño).
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken, addHelper, listHelpers, tournamentExists } from "../helpers/seed.js";

const CODE = "BORRAYUDA1";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("borrar el torneo borra también los correos de sus ayudantes", async ({ page }) => {
  await seedTournament(CODE, { config: { name: "Para borrar" } });
  await addHelper(CODE, "profe@gmail.com");
  await page.goto("/");
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  await page.getByRole("button", { name: /Mis torneos/ }).click();
  await expect(page.getByText("Para borrar")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /Eliminar|🗑/ }).first().click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: /Eliminar|Confirmar|Sí/ }).last().click();
  await expect.poll(() => tournamentExists(CODE), { timeout: 8000 }).toBe(false);
  expect(await listHelpers(CODE)).toEqual([]);
});
