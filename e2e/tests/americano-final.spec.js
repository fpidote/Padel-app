/**
 * Americano: al finalizar queda un estado real, con podio visible para todos, tabla final con partidos
 * jugados y sin el "Ronda 2 de 1" ni la pestaña vacía de antes.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { americanoStandings } from "../../src/logic/americano.js";

const CODE = "AMERICFINAL";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];

const base = (players) => ({
  type: "americano", status: "setup",
  config: { name: "Americano final", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
  playerInputs: players.map((name) => ({ name, level: 0 })),
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

async function jugarYFinalizar(page) {
  await entrarComoAdmin(page);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });
  const jugarRonda = async (resultados) => {
    for (const [a, b] of resultados) {
      await casillas.nth(0).fill(String(a));
      await casillas.nth(1).fill(String(b));
      await page.getByRole("button", { name: "Guardar resultado" }).first().click();
      await page.waitForTimeout(400);
    }
  };
  await jugarRonda([[9, 5], [4, 11]]);
  await page.getByRole("button", { name: /Siguiente Ronda/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Siguiente ronda", exact: true }).click();
  await expect(page.getByText("Ronda 2 de 2")).toBeVisible({ timeout: 8000 });
  await jugarRonda([[10, 6], [8, 12]]);
  await page.getByRole("button", { name: /Finalizar Torneo/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
}

test("al finalizar el torneo queda finalizado, con podio y tabla final que ve cualquier espectador", async ({ page, browser }) => {
  await seedTournament(CODE, base(NOMBRES));
  await jugarYFinalizar(page);

  const data = await getTournamentData(CODE);
  const [campeon, sub, tercero] = americanoStandings(data.players);

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("🏁 Torneo finalizado").first()).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByText(/Ronda \d+ de \d+/)).toHaveCount(0);
  const podio = espectador.locator("div.rounded-xl", { has: espectador.getByText("Campeón", { exact: true }) }).first();
  await expect(podio).toContainText(campeon.name);
  await expect(podio).toContainText("Subcampeón");
  await expect(podio).toContainText(sub.name);
  await expect(podio).toContainText("Tercer puesto");
  await expect(podio).toContainText(tercero.name);
  await expect(espectador.getByRole("button", { name: /Finalizar|Siguiente/ })).toHaveCount(0);
  await espectador.screenshot({ path: "test-results/americano-final-pistas-390.png", fullPage: true });

  await espectador.getByRole("button", { name: /Posiciones/ }).click();
  await expect(espectador.getByText("🏆 Tabla final")).toBeVisible();
  await expect(espectador.getByRole("columnheader", { name: "PJ" })).toBeVisible();
  // Con 8 jugadores y 2 pistas nadie descansa: cada uno jugó las 2 rondas
  const pj = await espectador.locator("tbody tr td:nth-child(3)").allTextContents();
  expect(pj).toHaveLength(8);
  pj.forEach((v) => expect(v.trim()).toBe("2"));
  await espectador.screenshot({ path: "test-results/americano-final-tabla-390.png", fullPage: true });
});

test("un torneo terminado con el criterio antiguo (sin estado finalizado) también se ve finalizado", async ({ page, browser }) => {
  await seedTournament(CODE, base(NOMBRES));
  await jugarYFinalizar(page);
  const data = await getTournamentData(CODE);
  await seedTournament(CODE, { ...data, status: "playing" });   // como los que ya existían

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("🏁 Torneo finalizado").first()).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByText("Campeón", { exact: true })).toBeVisible();
});
