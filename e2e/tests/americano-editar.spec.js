/**
 * Americano: al corregir un resultado de la ronda en curso el espectador sigue viendo el anterior, se puede
 * cancelar la edición, y la tabla de la ronda 1 no reparte medallas con todos a cero.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMEREDITAR";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

const pista = async (code, i = 0) => (await getTournamentData(code)).currentRound[i];

test("editar mantiene el resultado para el espectador, se puede cancelar y guardar la corrección", async ({ page, browser }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Editar", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });

  await casillas.nth(0).fill("7");
  await casillas.nth(1).fill("2");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista(CODE)).saved, { timeout: 8000 }).toBe(true);

  // Tabla de la ronda 1: sin medallas con todos a cero y con título claro
  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("🏆 Tabla (se actualiza al cerrar cada ronda)")).toBeVisible();
  await expect(page.getByText("🥇")).toHaveCount(0);
  await page.getByRole("button", { name: /Pistas/ }).click();

  // Editar: sigue guardado y marcado como en edición
  await page.getByText("7", { exact: true }).first().click();
  await expect.poll(async () => (await pista(CODE)).editing, { timeout: 8000 }).toBe(true);
  expect(await pista(CODE)).toMatchObject({ saved: true, scoreA: "7", scoreB: "2" });

  // El espectador sigue viendo el 7-2
  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("7", { exact: true }).first()).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByText("2", { exact: true }).first()).toBeVisible();

  // Cancelar restaura todo
  await page.getByTestId("btn-cancelar-edicion").click();
  await expect.poll(async () => (await pista(CODE)).editing, { timeout: 8000 }).toBe(false);
  expect(await pista(CODE)).toMatchObject({ saved: true, scoreA: "7", scoreB: "2" });

  // Editar otra vez, corregir y guardar
  await page.getByText("7", { exact: true }).first().click();
  await expect.poll(async () => (await pista(CODE)).editing, { timeout: 8000 }).toBe(true);
  await casillas.nth(0).fill("9");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista(CODE)).editing, { timeout: 8000 }).toBe(false);
  expect(await pista(CODE)).toMatchObject({ saved: true, scoreA: "9", scoreB: "2" });
});
