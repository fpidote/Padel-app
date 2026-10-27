/**
 * Torneo por grupos: el organizador ve los formatos posibles según sus parejas, elige uno
 * y puede personalizar grupos y clasificados a mano.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "FORMATOSGRUPOS";

function parejas(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i, p1: `Jugador${i}A`, p2: `Jugador${i}B`, pts: 0, gf: 0, gc: 0,
  }));
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page, n) {
  await seedTournament(CODE, {
    type: "mundialito",
    config: { name: "Grupos E2E", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: parejas(n),
    groups: null,
    knockoutBracket: null,
    phase: "setup",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  await expect(page.getByText("Formato de grupos")).toBeVisible({ timeout: 8000 });
}

test("con 12 parejas sugiere 4 grupos de 3 y al elegirlo guarda la configuración", async ({ page }) => {
  await entrar(page, 12);
  const tarjeta = page.getByRole("button", { name: /4 grupos de 3 · pasa 1 de cada grupo/ });
  await expect(tarjeta).toContainText("Cada pareja juega 2 partidos");
  await expect(tarjeta).toContainText("Clasifican 4: semifinales y final");
  await page.screenshot({ path: "test-results/formatos-12-390.png", fullPage: true });

  await tarjeta.click();
  await expect.poll(async () => {
    const d = await getTournamentData(CODE);
    return `${d.config.groupCount}-${d.config.advancePerGroup}`;
  }).toBe("4-1");
});

test("con 10 parejas ofrece 2 grupos de 5 y Personalizar abre los selectores manuales", async ({ page }) => {
  await entrar(page, 10);
  await expect(page.getByRole("button", { name: /2 grupos de 5 · pasan 2 de cada grupo/ })).toBeVisible();
  await page.getByRole("button", { name: /Personalizar/ }).click();
  await expect(page.getByText("Número de grupos")).toBeVisible();
  const bloque = page.locator("div", { has: page.getByText("Número de grupos", { exact: true }) }).last();
  await bloque.getByRole("button", { name: "3", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.groupCount).toBe(3);
});
