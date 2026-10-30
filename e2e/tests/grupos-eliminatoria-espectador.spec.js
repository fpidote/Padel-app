/**
 * Torneo por grupos: la marca ⚡ de clasificado solo sale cuando el grupo ya tiene partidos guardados, y el
 * espectador que mira Grupos pasa a Eliminatoria cuando el organizador la inicia (si está en otra pestaña, no).
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "GRUPESPEC";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"]];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("⚡ solo tras jugar y el espectador pasa a Eliminatoria al iniciarla", async ({ page, browser }) => {
  await seedTournament(CODE, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Grupos", courts: 2, scoringSystem: "timed", groupCount: 2, advancePerGroup: 2 },
    pairInputs: NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 })),
    pairs: [], groups: null, bracket: null, knockoutBracket: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });

  // Un espectador en Grupos y otro en Reglas
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const espectador = await ctx.newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("GRUPO A").first().or(espectador.getByText("Grupo A").first())).toBeVisible({ timeout: 8000 });
  // Sin partidos guardados nadie está clasificado
  await expect(espectador.getByText("⚡ ", { exact: false }).filter({ hasText: " / " })).toHaveCount(0);
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const otra = await ctx2.newPage();
  await otra.goto(`/torneo/${CODE}`);
  await otra.getByRole("button", { name: /Reglas/ }).click();

  const total = (await getTournamentData(CODE)).groups.reduce((n, g) => n + g.matches.length, 0);
  const saved = async () => (await getTournamentData(CODE)).groups.reduce((n, g) => n + g.matches.filter((m) => m.saved).length, 0);
  for (let i = 0; i < total; i++) {
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill("6");
    await inputs.nth(1).fill("2");
    await page.getByRole("button", { name: "Guardar resultado" }).first().click();
    await expect.poll(saved).toBe(i + 1);
    if (i === 0) await expect(page.getByText("⚡ ", { exact: false }).filter({ hasText: " / " }).first()).toBeVisible();
  }

  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");

  // Quien estaba en Grupos pasa a Eliminatoria; quien estaba en Reglas se queda
  await expect(espectador.getByText(/SEMIFINAL 1/)).toBeVisible({ timeout: 8000 });
  await expect(otra.getByText(/SEMIFINAL 1/)).toHaveCount(0);
});
