/**
 * Relámpago en el móvil: pista para deslizar el cuadro, Enter guarda el marcador y el aviso de
 * configuración habla de pases directos en lugar de pistas y descansos.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { buildBracket } from "../../src/logic/relampago.js";

const CODE = "RELMOVIL";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"]];
const pairs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));
const config = { name: "Relámpago móvil", courts: 2, scoringFormat: "games", matchMinutes: 10 };

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("el espectador ve una pista para deslizar el cuadro, que desaparece al llegar al final", async ({ page }) => {
  await seedTournament(CODE, { type: "relampago", status: "playing", phase: "bracket", config, pairInputs: pairs, pairs, bracket: buildBracket(pairs) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  const pista = page.getByTestId("bracket-scroll-hint").first();
  await expect(pista).toBeVisible({ timeout: 8000 });
  await expect(pista).toContainText("Desliza");
  await page.locator("div.overflow-x-auto").first().evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(pista).toBeHidden();
  await page.screenshot({ path: "test-results/relampago-final-390.png" });
});

test("Enter guarda un marcador válido y no guarda uno inválido", async ({ page }) => {
  const bracket = buildBracket(pairs);
  const m = bracket.find((x) => x.bracket === "winners" && x.round === 1 && x.pairA?.id !== "bye" && x.pairB?.id !== "bye" && x.pairA && x.pairB);
  await seedTournament(CODE, { type: "relampago", status: "playing", phase: "bracket", config, pairInputs: pairs, pairs, bracket });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  await page.getByText(`${m.pairA.p1} / ${m.pairA.p2}`).first().click();
  const casillas = page.locator('input[type="number"]');
  await casillas.nth(0).fill("4");
  await casillas.nth(1).fill("4");
  await casillas.nth(1).press("Enter");   // empate: no guarda
  await page.waitForTimeout(600);
  expect((await getTournamentData(CODE)).bracket.find((x) => x.id === m.id).saved).toBe(false);

  await casillas.nth(1).fill("2");
  await casillas.nth(1).press("Enter");
  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((x) => x.id === m.id).saved).toBe(true);
});

test("al armar el cuadro el aviso habla de pases directos, no de pistas ni de descansos", async ({ page }) => {
  await seedTournament(CODE, { type: "relampago", status: "setup", phase: "setup", config, pairInputs: pairs, pairs: [], bracket: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await expect(page.getByText("6 parejas · 2 pasan directo en la 1.ª ronda")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/descansan/)).toHaveCount(0);
  await expect(page.getByText(/juegan/)).toHaveCount(0);
});
