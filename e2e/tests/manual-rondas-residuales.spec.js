/**
 * Americano Manual: un número de rondas guardado de antes de elegir Manual no cierra el torneo antes de tiempo.
 * Con 3 rondas armadas y maxRounds=2 residual, la ronda 2 es la penúltima: ofrece «Siguiente Ronda», no «Finalizar».
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";

const CODE = "MANRESID1";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("con 3 rondas manuales y maxRounds=2 residual, la ronda 2 no es la última", async ({ page }) => {
  const players = [
    { id: 0, name: "Alice", level: 0, pts: 1, gf: 10, gc: 8 },
    { id: 1, name: "Bob", level: 0, pts: 1, gf: 10, gc: 8 },
    { id: 2, name: "Carol", level: 0, pts: 0, gf: 8, gc: 10 },
    { id: 3, name: "Dave", level: 0, pts: 0, gf: 8, gc: 10 },
  ];
  const hecha = { pairA: [players[0], players[1]], pairB: [players[2], players[3]], scoreA: "10", scoreB: "8", saved: true };
  const vacia = { ...hecha, scoreA: "", scoreB: "", saved: false };
  await seedTournament(CODE, {
    status: "playing", roundNum: 2, players,
    currentRound: [hecha], sittingOut: [],
    precomputedRounds: [{ courts: [vacia], sittingOut: [] }, { courts: [vacia], sittingOut: [] }, { courts: [vacia], sittingOut: [] }],
    rounds: [{ num: 1, courts: [hecha], sittingOut: [] }],
    config: { name: "Manual residual", courts: 1, matchmaking: "manual", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
  });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  await expect(page.getByText("Ronda 2 de 3")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: /Siguiente Ronda/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Finalizar Torneo/i })).toHaveCount(0);
});
