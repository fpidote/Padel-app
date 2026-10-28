/**
 * Americano con jugadores de sobra: el setup avisa de quién jugará un partido más, sugiere las rondas con
 * las que todos juegan lo mismo y el resumen de lanzamiento dice las rondas reales.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";

const CODE = "AMERREPARTO";
const NOMBRES = ["Ana", "Beto", "Caro", "Dani", "Eva", "Fede", "Gus", "Hugo", "Iris", "Juan"];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page, maxRounds) {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Reparto", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds, useLevels: false, goldenPoint: true },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await expect(page.getByTestId("btn-open-modal")).toBeEnabled({ timeout: 8000 });
}

test("con 4 rondas avisa de la desigualdad y sugiere 5; al elegirlas todos juegan lo mismo", async ({ page }) => {
  await entrar(page, 4);
  await expect(page.getByTestId("aviso-descansos")).toContainText("2 jugadores jugarán 4 partidos y 8 jugarán 3.");
  await expect(page.getByTestId("rondas-parejas")).toContainText("5 rondas (4 partidos)");

  await page.getByTestId("rondas-parejas").getByRole("button", { name: /^5 rondas/ }).click();
  await expect(page.getByTestId("aviso-descansos")).toContainText("Todos juegan 4 partidos.");
  await expect(page.getByTestId("rondas-parejas")).toHaveCount(0);
});

test("con Ilimitadas el resumen dice las rondas reales y el reparto", async ({ page }) => {
  await entrar(page, null);
  await page.getByTestId("btn-open-modal").click();
  const modal = page.locator(".fixed.inset-0");
  await modal.getByRole("button", { name: /Resumen/ }).click();
  await expect(modal.getByText("Ilimitadas")).toHaveCount(0);
  await expect(modal.getByText("Rondas", { exact: true })).toBeVisible();
  await expect(modal.getByText("Partidos por jugador")).toBeVisible();
});
