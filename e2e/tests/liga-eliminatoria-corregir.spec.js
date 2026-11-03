/**
 * Liga, fase final: corregir un resultado mantiene el partido guardado para el espectador (como en Torneo por
 * grupos) y no deja volver a la fase de liga con una corrección a medias.
 * Además: las casillas de Editar parten de lo guardado aunque hubiera algo escrito sin guardar.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "LIGAKOCORR";
const par = (id, p1, p2, pts) => ({ id, p1, p2, pts, gf: pts, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 2, wins: pts });
const ana = par(0, "Ana", "Beto", 2), caro = par(1, "Caro", "Dario", 1), eva = par(2, "Eva", "Fede", 0);
const hecho = (id, round, a, b) => ({ id, round, pairA: a, pairB: b, scoreA: "6", scoreB: "2", saved: true, sets: null });

const liga = () => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: true,
  config: { name: "Liga KO", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: true, advanceQualifiers: 2, seasonMode: "single" },
  pairInputs: [ana, caro, eva], pairs: [ana, caro, eva],
  rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
  matches: [hecho("r1_m0", 1, ana, caro), hecho("r2_m0", 2, ana, eva), hecho("r3_m0", 3, caro, eva)],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("corregir la final no la borra para el espectador ni deja volver a la fase de liga", async ({ page, browser }) => {
  await seedTournament(CODE, liga());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Iniciar Fase Final/ }).click({ timeout: 8000 });
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar" }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase, { timeout: 8000 }).toBe("playoff");
  // La app lleva sola a la pestaña Eliminatoria

  const final = async () => ((await getTournamentData(CODE))?.knockoutBracket ?? []).find((m) => !m.nextMatchId && m.bracket !== "third");
  await page.locator('input[type="number"]').nth(0).fill("6");
  await page.locator('input[type="number"]').nth(1).fill("3");
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await final())?.saved, { timeout: 8000 }).toBe(true);

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await espectador.getByRole("button", { name: /Eliminatoria/ }).click({ timeout: 8000 });
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1, { timeout: 8000 });

  await page.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await final())?.editing, { timeout: 8000 }).toBe(true);
  expect(await final()).toMatchObject({ saved: true, scoreA: "6", scoreB: "3" });
  // El espectador sigue viendo el resultado y el organizador no puede descartar el cuadro a medias
  await expect(espectador.getByText("✅ Guardado")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Volver a la fase de liga/ })).toHaveCount(0);

  await page.getByTestId("btn-cancelar-edicion").click();
  await expect.poll(async () => (await final())?.editing, { timeout: 8000 }).toBe(false);
  expect(await final()).toMatchObject({ saved: true, scoreA: "6", scoreB: "3" });
});
