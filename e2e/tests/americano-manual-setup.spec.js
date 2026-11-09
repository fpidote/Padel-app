/**
 * Setup del Americano: un cambio hecho justo después de otro no se deshace, el selector de
 * emparejamiento está a la vista, y las rondas armadas a mano no se borran sin confirmar.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMMANSET";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];
const P = (i) => ({ id: i, name: NOMBRES[i], level: 0, pts: 0, gf: 0, gc: 0 });
const cancha = (a, b, c, d) => ({ pairA: [P(a), P(b)], pairB: [P(c), P(d)], scoreA: "", scoreB: "", saved: false });
const RONDAS = [
  { courts: [cancha(0, 1, 2, 3), cancha(4, 5, 6, 7)], sittingOut: [] },
  { courts: [cancha(0, 4, 1, 5), cancha(2, 6, 3, 7)], sittingOut: [] },
];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function abrir(page, { matchmaking = "americano", jugadores = NOMBRES, courts = 2, rondas } = {}) {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Setup", courts, matchmaking, mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true, ...(rondas ? { manualRoundsConfig: rondas } : {}) },
    playerInputs: jugadores.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("agregar un jugador justo después de nombrar una pista no deshace ninguno de los dos", async ({ page }) => {
  await abrir(page);
  await page.getByTestId("nombrar-pistas").click();
  await page.getByTestId("nombre-pista-2").fill("Cristal");
  await page.getByPlaceholder("Nombre del jugador...").fill("Ines");
  await page.getByPlaceholder("Nombre del jugador...").press("Enter");
  await page.waitForTimeout(2000);
  const d = await getTournamentData(CODE);
  expect(d.playerInputs).toHaveLength(9);
  expect(d.config.courtNames?.[1]).toBe("Cristal");
});

test("el selector de emparejamiento está a la vista y volver desde Manual pide confirmar", async ({ page }) => {
  await abrir(page, { matchmaking: "manual", rondas: RONDAS });
  const selector = page.getByTestId("selector-emparejamiento");
  await expect(selector).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("2 de 2 rondas completas").or(page.getByText("2 rondas listas"))).toBeVisible();

  // Cancelar: se queda en Manual con sus rondas
  await selector.getByRole("button", { name: "Americano" }).click();
  await expect(page.getByText(/borrará 2 rondas armadas a mano/)).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect((await getTournamentData(CODE)).config.matchmaking).toBe("manual");
  expect((await getTournamentData(CODE)).config.manualRoundsConfig).toHaveLength(2);

  // Confirmar: pasa a Americano y borra
  await selector.getByRole("button", { name: "Americano" }).click();
  await page.getByRole("button", { name: "Borrar rondas" }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.matchmaking, { timeout: 8000 }).toBe("americano");
  expect((await getTournamentData(CODE)).config.manualRoundsConfig ?? []).toHaveLength(0);
});

test("agregar jugador, quitar jugador o cambiar pistas piden confirmar si hay rondas armadas", async ({ page }) => {
  await abrir(page, { matchmaking: "manual", rondas: RONDAS });
  await page.getByPlaceholder("Nombre del jugador...").fill("Ines");
  await page.getByPlaceholder("Nombre del jugador...").press("Enter");
  await expect(page.getByText(/Agregar a Ines borrará 2 rondas armadas a mano/)).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect((await getTournamentData(CODE)).playerInputs).toHaveLength(8);

  await page.getByRole("button", { name: "3", exact: true }).first().click();
  await expect(page.getByText(/Cambiar el número de pistas borrará/)).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect((await getTournamentData(CODE)).config.courts).toBe(2);
  expect((await getTournamentData(CODE)).config.manualRoundsConfig).toHaveLength(2);
});

test("con 9 jugadores y 3 pistas, '+' crea solo 2 pistas", async ({ page }) => {
  await abrir(page, { matchmaking: "manual", jugadores: [...NOMBRES, "Judy"], courts: 3 });
  await expect(page.getByTestId("falta-armar-rondas")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /Armar rondas/ }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.getByText("PISTA 2", { exact: true })).toBeVisible();
  await expect(page.getByText("PISTA 3", { exact: true })).toHaveCount(0);
});
