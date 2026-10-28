/**
 * Guardado con control de versión: dos pantallas del mismo organizador guardando a la vez no pierden
 * resultados en silencio. Una de las dos recibe un aviso y ve la versión del servidor; las que guardan en
 * orden, o una sola pantalla guardando varias veces seguidas, nunca dan conflicto.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "GUARDACONC";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
const match = (id, round, a, b) => ({ id, round, pairA: a, pairB: b, scoreA: "", scoreB: "", saved: false, sets: null });

const liga = () => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
  config: { name: "Concurrente", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
  pairInputs: pairs, pairs,
  rounds: [{ round: 1, date: null }],
  matches: [match("r1_m0", 1, pairs[0], pairs[1]), match("r1_m1", 1, pairs[2], pairs[3])],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function abrirComoDueno(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
  return page;
}

const guardados = async () => (await getTournamentData(CODE)).matches.filter((m) => m.saved).length;

test("dos pantallas guardando a la vez: nunca se muestra un guardado que el servidor no tiene", async ({ browser }) => {
  let hubConflicto = false;
  for (let intento = 0; intento < 8 && !hubConflicto; intento++) {
    await seedTournament(CODE, liga());
    const context = await browser.newContext();
    const A = await abrirComoDueno(context);
    const B = await abrirComoDueno(context);

    const cA = A.locator('input[type="number"]');
    const cB = B.locator('input[type="number"]');
    await cA.nth(0).fill("6"); await cA.nth(1).fill("2");
    await cB.nth(2).fill("6"); await cB.nth(3).fill("3");
    await Promise.all([
      A.getByRole("button", { name: "Guardar resultado" }).first().click(),
      B.getByRole("button", { name: "Guardar resultado" }).last().click(),
    ]);
    await A.waitForTimeout(1500);

    const enServidor = await guardados();
    expect(enServidor).toBeGreaterThanOrEqual(1);
    // Cada pantalla enseña exactamente lo que hay en el servidor
    for (const page of [A, B]) {
      await expect(page.getByText("✅ Guardado")).toHaveCount(enServidor);
    }
    if (enServidor === 1) {
      hubConflicto = true;
      const avisos = await Promise.all([A, B].map((p) => p.getByText(/Otro organizador guardó a la vez/).count()));
      expect(avisos.reduce((a, b) => a + b, 0)).toBe(1);
    }
    await context.close();
  }
  expect(hubConflicto).toBe(true);
});

test("guardados en orden de dos pantallas: ambos quedan y no hay aviso", async ({ browser }) => {
  await seedTournament(CODE, liga());
  const context = await browser.newContext();
  const A = await abrirComoDueno(context);
  const B = await abrirComoDueno(context);

  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("2");
  await A.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(guardados, { timeout: 8000 }).toBe(1);
  await expect(B.getByText("✅ Guardado")).toHaveCount(1, { timeout: 8000 }); // B ya recibió lo de A

  await B.locator('input[type="number"]').nth(0).fill("6");
  await B.locator('input[type="number"]').nth(1).fill("3");
  await B.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(guardados, { timeout: 8000 }).toBe(2);
  await expect(A.getByText(/Otro organizador guardó a la vez/)).toHaveCount(0);
  await expect(B.getByText(/Otro organizador guardó a la vez/)).toHaveCount(0);
});

test("una sola pantalla guardando varios resultados seguidos no da conflicto", async ({ page }) => {
  await seedTournament(CODE, liga());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  const c = page.locator('input[type="number"]');
  await expect(c.first()).toBeVisible({ timeout: 8000 });
  await c.nth(0).fill("6"); await c.nth(1).fill("2");
  await c.nth(2).fill("6"); await c.nth(3).fill("3");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await page.getByRole("button", { name: "Guardar resultado" }).last().click();
  await expect.poll(guardados, { timeout: 8000 }).toBe(2);
  await expect(page.getByText(/Otro organizador guardó a la vez/)).toHaveCount(0);
});
