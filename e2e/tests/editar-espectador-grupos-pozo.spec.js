/**
 * Corregir un resultado en Torneo por grupos y en el Pozo: el partido sigue guardado para el espectador
 * (ve el resultado anterior y la tabla no cambia) hasta que el organizador guarda la corrección o cancela.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "EDITARESP";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"]];
const pairInputs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 }));

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function lanzar(page, seed) {
  await seedTournament(CODE, seed);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
}

test("Torneo por grupos: mientras se corrige un partido el espectador sigue viendo el resultado", async ({ page, browser }) => {
  await lanzar(page, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Grupos", courts: 2, scoringSystem: "timed", groupCount: 2, advancePerGroup: 2 },
    pairInputs, pairs: [], groups: null, bracket: null, knockoutBracket: null,
  });
  const primero = async () => ((await getTournamentData(CODE))?.groups ?? []).flatMap((g) => g.matches).find((m) => m.saved);

  await page.locator('input[type="number"]').nth(0).fill("6");
  await page.locator('input[type="number"]').nth(1).fill("2");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(primero).toBeTruthy();

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1, { timeout: 8000 });

  await page.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await primero())?.editing).toBe(true);
  expect(await primero()).toMatchObject({ saved: true, scoreA: "6", scoreB: "2" });
  // El espectador sigue viendo el partido guardado, sin casillas
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1);
  await expect(espectador.locator('input[type="number"]')).toHaveCount(0);

  // Cancelar deja todo como estaba
  await page.getByTestId("btn-cancelar-edicion").click();
  await expect.poll(async () => (await primero())?.editing).toBe(false);
  expect(await primero()).toMatchObject({ saved: true, scoreA: "6", scoreB: "2" });

  // Corregir y guardar
  await page.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await primero())?.editing).toBe(true);
  await page.locator('input[type="number"]').nth(0).fill("3");
  await page.locator('input[type="number"]').nth(1).fill("6");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await primero())?.editing).toBe(false);
  expect(await primero()).toMatchObject({ saved: true, scoreA: "3", scoreB: "6" });
});

test("Pozo: mientras se corrige una pista el espectador sigue viendo el resultado", async ({ page, browser }) => {
  await lanzar(page, {
    type: "pozo", status: "setup", phase: "setup",
    config: { name: "Pozo", courts: 2, pozoMode: "fixed", targetRounds: null },
    pairInputs: pairInputs.slice(0, 4), playerInputs: [],
  });
  const pista = async () => (await getTournamentData(CODE))?.currentPozoRound?.[0] ?? {};

  await page.locator('input[type="number"]').nth(0).fill("6");
  await page.locator('input[type="number"]').nth(1).fill("3");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista()).saved).toBe(true);

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1, { timeout: 8000 });

  await page.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await pista()).editing).toBe(true);
  expect(await pista()).toMatchObject({ saved: true, scoreA: "6", scoreB: "3" });
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1);
  await expect(espectador.locator('input[type="number"]')).toHaveCount(0);

  await page.getByTestId("btn-cancelar-edicion").click();
  await expect.poll(async () => (await pista()).editing).toBe(false);
  expect(await pista()).toMatchObject({ saved: true, scoreA: "6", scoreB: "3" });

  await page.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await pista()).editing).toBe(true);
  await page.locator('input[type="number"]').nth(0).fill("2");
  await page.locator('input[type="number"]').nth(1).fill("6");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista()).editing).toBe(false);
  expect(await pista()).toMatchObject({ saved: true, scoreA: "2", scoreB: "6" });
});

test("Liga: mientras se corrige un partido el espectador sigue viendo el resultado", async ({ page, browser }) => {
  const par = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
  const pairs = [par(0, "Ana", "Beto"), par(1, "Caro", "Dario"), par(2, "Eva", "Fede"), par(3, "Gus", "Hugo")];
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: true,
    config: { name: "Liga", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: pairs, pairs,
    rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
    matches: [
      { id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "6", scoreB: "2", saved: true, sets: null },
      { id: "r1_m1", round: 1, pairA: pairs[2], pairB: pairs[3], scoreA: "", scoreB: "", saved: false, sets: null },
    ],
    knockoutBracket: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1, { timeout: 8000 });

  await page.getByRole("button", { name: /Editar/ }).first().click({ timeout: 8000 });
  await expect.poll(async () => (await getTournamentData(CODE)).matches[0].editing).toBe(true);
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1);
  await expect(espectador.locator('input[type="number"]')).toHaveCount(0);
});
