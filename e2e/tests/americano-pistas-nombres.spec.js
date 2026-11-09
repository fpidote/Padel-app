/**
 * Americano: la pestaña Descansos solo existe si alguien descansa, y las pistas se pueden nombrar
 * (en Setup y con el torneo en marcha) viéndose el nombre también el espectador.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMPISTAS";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan", "Judy"];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function crear(page, jugadores) {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Pistas", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true },
    playerInputs: jugadores.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("nadie descansa: no hay pestaña Descansos; nombrar pistas en Setup y en juego", async ({ page, browser }) => {
  await crear(page, NOMBRES.slice(0, 8));

  // Setup: nombrar la pista 1
  await page.getByTestId("nombrar-pistas").click();
  await page.getByTestId("nombre-pista-1").fill("Pajarito");
  await expect.poll(async () => (await getTournamentData(CODE))?.config?.courtNames?.[0], { timeout: 8000 }).toBe("Pajarito");

  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect(page.getByText("Ronda 1 de 3")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("PAJARITO", { exact: true })).toBeVisible();
  await expect(page.getByText("PISTA 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Descansos/ })).toHaveCount(0);

  // En juego: nombrar la pista 2
  await page.getByTestId("nombrar-pistas").click();
  await page.getByTestId("nombre-pista-2").fill("La 7");
  await page.getByTestId("guardar-nombres-pistas").click();
  await expect.poll(async () => (await getTournamentData(CODE))?.config?.courtNames?.[1], { timeout: 8000 }).toBe("La 7");
  await expect(page.getByText("LA 7", { exact: true })).toBeVisible();

  // El espectador ve los nombres
  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("PAJARITO", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByText("LA 7", { exact: true })).toBeVisible();
});

test("si alguien descansa, la pestaña Descansos sí aparece", async ({ page }) => {
  await crear(page, NOMBRES);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect(page.getByRole("button", { name: /Descansos/ })).toBeVisible({ timeout: 8000 });
});
