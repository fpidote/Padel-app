/**
 * Entrada rápida de parejas: ningún cambio se pierde aunque se añada una pareja mientras la
 * anterior todavía se está guardando (red lenta o escritura rápida).
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "GUARDADORAPIDO";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("añadir 8 parejas sin pausas no pierde ninguna", async ({ page }) => {
  await seedTournament(CODE, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Rápido", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: [], groups: null, knockoutBracket: null,
  });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByPlaceholder("Jugador 1").click();

  const nombres = ["Ana", "Beto", "Caro", "Dario", "Eva", "Fede", "Gus", "Hugo", "Iris", "Juan", "Kali", "Leo", "Mia", "Nico", "Olga", "Pablo"];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.type(nombres[i * 2]);
    await page.keyboard.press("Tab");
    await page.keyboard.type(nombres[i * 2 + 1]);
    await page.keyboard.press("Enter");
  }

  await expect.poll(async () => (await getTournamentData(CODE)).pairInputs.length, { timeout: 10_000 }).toBe(8);
  const guardadas = (await getTournamentData(CODE)).pairInputs.map((p) => `${p.p1}/${p.p2}`);
  expect(guardadas).toEqual(nombres.reduce((acc, n, i) => (i % 2 ? acc : [...acc, `${n}/${nombres[i + 1]}`]), []));
  await expect(page.getByText("8 parejas")).toBeVisible();
});

test("el estado en pantalla y el guardado coinciden tras muchas ediciones seguidas", async ({ page }) => {
  await seedTournament(CODE, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Rápido", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: [], groups: null, knockoutBracket: null,
  });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByPlaceholder("Jugador 1").click();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.type(`A${i}`);
    await page.keyboard.press("Tab");
    await page.keyboard.type(`B${i}`);
    await page.keyboard.press("Enter");
  }
  await expect.poll(async () => (await getTournamentData(CODE)).pairInputs.length, { timeout: 10_000 }).toBe(6);
  await page.reload();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await expect(page.getByText("6 parejas")).toBeVisible({ timeout: 8000 });
});
