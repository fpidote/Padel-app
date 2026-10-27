/**
 * El Pozo: "Revisar y lanzar" muestra las canchas de la primera ronda y esas mismas canchas son las
 * que quedan guardadas al iniciar.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "POZOPREVIA";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page, overrides) {
  await seedTournament(CODE, { type: "pozo", pairInputs: [], playerInputs: [], phase: "setup", ...overrides });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  await expect(page.getByTestId("btn-open-modal")).toBeEnabled({ timeout: 8000 });
}

test("parejas fijas: la vista previa muestra las canchas y quién descansa, y se guardan tal cual", async ({ page }) => {
  const pairInputs = ["Ana", "Beto", "Caro", "Dario", "Eva"].map((n, i) => ({ id: i, p1: `${n}1`, p2: `${n}2`, pts: 0, gf: 0, gc: 0 }));
  await entrar(page, { config: { name: "Pozo E2E", courts: 2, pozoMode: "fixed", targetRounds: null }, pairInputs });

  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByText("Cancha 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Cancha 2", { exact: true })).toBeVisible();
  await expect(page.getByText(/Descansan:/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Re-sortear/ })).toHaveCount(1);
  await page.screenshot({ path: "test-results/pozo-previa-390.png" });
  const mostrado = (await page.getByText("Cancha 1", { exact: true }).locator("xpath=..").innerText()).replace(/\s+/g, " ");

  await page.getByTestId("btn-iniciar").click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("playing");
  const d = await getTournamentData(CODE);
  expect(d.currentPozoRound).toHaveLength(2);
  const c1 = d.currentPozoRound[0];
  expect(mostrado).toContain(`${c1.pairA.p1} / ${c1.pairA.p2}`);
  expect(mostrado).toContain(`${c1.pairB.p1} / ${c1.pairB.p2}`);
});

test("mixer: muestra los equipos de la primera ronda y quién descansa", async ({ page }) => {
  const playerInputs = Array.from({ length: 9 }, (_, i) => ({ id: i, name: `Jug${i}` }));
  await entrar(page, { config: { name: "Pozo mixer", courts: 2, pozoMode: "mixer", targetRounds: null }, playerInputs });

  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByText("Cancha 1", { exact: true })).toBeVisible();
  await expect(page.getByText(/Descansan:/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Re-sortear/ })).toHaveCount(0);

  await page.getByTestId("btn-iniciar").click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("playing");
  const d = await getTournamentData(CODE);
  expect(d.currentPozoRound).toHaveLength(2);
  expect(d.sittingOut).toHaveLength(1);
});
