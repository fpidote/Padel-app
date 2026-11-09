/**
 * Si otra pantalla (un ayudante) carga el primer resultado mientras el dueño tiene abierto «Editar torneo»,
 * la edición se cierra y no se puede relanzar el torneo: relanzar borraría esos resultados.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "EDITBLOQ1";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("«Editar torneo» se cierra si otra pantalla guarda el primer resultado, y los resultados se conservan", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Bloqueo", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect(page.getByText("Ronda 1 de 3")).toBeVisible({ timeout: 8000 });

  // El dueño abre «Editar torneo»
  await page.getByRole("button", { name: /Editar torneo/ }).click();
  await expect(page.getByTestId("btn-open-modal")).toBeVisible();

  // Un ayudante guarda el primer resultado desde otra pantalla
  const actual = await getTournamentData(CODE);
  const courts = actual.currentRound.map((c, i) => (i === 0 ? { ...c, scoreA: "7", scoreB: "2", saved: true } : c));
  await seedTournament(CODE, { ...actual, ver: (actual.ver || 1) + 5, scoringStarted: true, currentRound: courts });

  // La edición se cierra con un aviso: no queda el botón de relanzar
  await expect(page.getByText("Ya se cargó un resultado")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("btn-open-modal")).toHaveCount(0);
  const d = await getTournamentData(CODE);
  expect(d.currentRound[0]).toMatchObject({ scoreA: "7", scoreB: "2", saved: true });
});
