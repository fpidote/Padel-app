/**
 * Relámpago: corregir un resultado no lo borra. Sigue publicado para el espectador hasta guardar la
 * corrección, se puede cancelar, y el marcador por games explica por qué no guarda.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { buildBracket, advanceBracket } from "../../src/logic/relampago.js";

const CODE = "RELEDITAR";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"], ["Mara", "Nico"], ["Olga", "Pepe"]];
const pairs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

const partido = async () => {
  const d = await getTournamentData(CODE);
  return d.bracket.find((m) => m.id === "w_r1_m0");
};

test("corregir mantiene el resultado para el espectador, valida el marcador, cancela y guarda la corrección", async ({ page, browser }) => {
  let b = buildBracket(pairs);
  b = advanceBracket(b, "w_r1_m0", 6, 2);
  await seedTournament(CODE, {
    type: "relampago", status: "playing", phase: "bracket", scoringStarted: true,
    config: { name: "Editar", courts: 2, scoringFormat: "games", matchMinutes: 10 },
    pairInputs: pairs, pairs, bracket: b,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  await page.getByText("✏️ Corregir resultado").first().click();
  await expect.poll(async () => (await partido()).editing, { timeout: 8000 }).toBe(true);
  expect(await partido()).toMatchObject({ saved: true, scoreA: "6", scoreB: "2" });

  // El espectador sigue viendo el partido jugado
  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("6", { exact: true }).first()).toBeVisible({ timeout: 8000 });

  // La tarjeta se abre con el marcador anterior y el empate explica por qué no guarda
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.nth(0)).toHaveValue("6");
  await expect(casillas.nth(1)).toHaveValue("2");
  await casillas.nth(1).fill("6");
  await expect(page.getByTestId("games-error")).toContainText("no puede terminar empatado");
  await expect(page.getByRole("button", { name: /Guardar/ })).toHaveCount(0);

  // Cancelar deja todo como estaba
  await page.getByTestId("btn-cancelar-edicion").click();
  await expect.poll(async () => (await partido()).editing, { timeout: 8000 }).toBe(false);
  expect(await partido()).toMatchObject({ saved: true, scoreA: "6", scoreB: "2" });

  // Corregir a favor de la otra pareja y guardar con Enter
  await page.getByText("✏️ Corregir resultado").first().click();
  await expect.poll(async () => (await partido()).editing, { timeout: 8000 }).toBe(true);
  await casillas.nth(0).fill("3");
  await casillas.nth(1).fill("6");
  await casillas.nth(1).press("Enter");
  await expect.poll(async () => (await partido()).editing, { timeout: 8000 }).toBe(false);
  const corregido = await partido();
  expect(corregido).toMatchObject({ saved: true, scoreA: "3", scoreB: "6" });
  expect(corregido.winner.id).toBe(corregido.pairB.id);
});
