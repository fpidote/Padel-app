/**
 * Parejas (Liga y demás): una persona repetida en parejas distintas avisa al cargarla y se marca en la lista,
 * sin impedir agregarla.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";

const CODE = "JUGREPE1";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("Liga: un jugador en dos parejas distintas avisa al cargarla y se marca en la lista, sin impedirlo", async ({ page }) => {
  await seedTournament(CODE, {
    type: "liga", status: "setup", phase: "setup",
    config: { name: "Repetido", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario")], playerInputs: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByPlaceholder("Jugador 1").fill("  ana ");
  await expect(page.getByTestId("aviso-jugador-repetido")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("aviso-jugador-repetido")).toContainText("Ana / Beto");
  await page.getByPlaceholder("Jugador 2").fill("Eva");
  await page.getByRole("button", { name: /Agregar pareja/ }).click();
  // Se agregó igualmente y los dos «Ana» quedan marcados; el resto no
  await expect(page.getByText("⚠️ repetido")).toHaveCount(2);
  await expect(page.getByTestId("aviso-jugador-repetido")).toHaveCount(0);
});

test("una pareja completa repetida sigue con su aviso propio y no suma el de jugador", async ({ page }) => {
  await seedTournament(CODE, {
    type: "liga", status: "setup", phase: "setup",
    config: { name: "Repetido", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: [pair(0, "Ana", "Beto")], playerInputs: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByPlaceholder("Jugador 1").fill("beto");
  await page.getByPlaceholder("Jugador 2").fill("ANA");
  await expect(page.getByTestId("aviso-pareja-repetida")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("aviso-jugador-repetido")).toHaveCount(0);
});
