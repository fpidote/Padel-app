/**
 * Al cargar un marcador, Enter (o "Siguiente" en el teclado del móvil) pasa a la casilla siguiente
 * en lugar de no hacer nada; en la última se cierra el teclado.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";

const CODE = "ENTERSIG1";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
const match = (id, a, b) => ({ id, round: 1, pairA: a, pairB: b, scoreA: "", scoreB: "", saved: false, sets: null });

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("Liga: Enter en la casilla A pasa a la B, y de la B al siguiente partido; la última cierra el teclado", async ({ page }) => {
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Enter", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: pairs, pairs, rounds: [{ round: 1, date: null }],
    matches: [match("r1_m0", pairs[0], pairs[1]), match("r1_m1", pairs[2], pairs[3])],
    knockoutBracket: null,
  });
  await entrar(page);
  const c = page.locator('input[type="number"]');
  await expect(c.first()).toBeVisible({ timeout: 8000 });
  await c.nth(0).focus();
  await page.keyboard.type("6");
  await page.keyboard.press("Enter");
  await expect(c.nth(1)).toBeFocused();
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(c.nth(2)).toBeFocused();
  await c.nth(3).focus();
  await page.keyboard.press("Enter");
  await expect(c.nth(3)).not.toBeFocused();
});

test("Americano: Enter en la casilla A pasa a la B", async ({ page }) => {
  await seedTournament(CODE, {});
  await entrar(page);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const c = page.locator('input[type="number"]');
  await expect(c.first()).toBeVisible({ timeout: 8000 });
  await c.nth(0).focus();
  await page.keyboard.type("9");
  await page.keyboard.press("Enter");
  await expect(c.nth(1)).toBeFocused();
});
