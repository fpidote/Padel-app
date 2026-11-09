/**
 * Americano manual: al armar rondas avisa de compañeros/rivales repetidos entre rondas y
 * "Re-optimizar" regenera las rondas sin fijar respetando las fijadas.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AMMANREP";
const NOMBRES = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Heidi", "Ivan"];
const P = (i) => ({ id: i, name: NOMBRES[i], level: 0, pts: 0, gf: 0, gc: 0 });
const cancha = (a, b, c, d) => ({ pairA: [P(a), P(b)], pairB: [P(c), P(d)], scoreA: "", scoreB: "", saved: false });
// R1: Alice vs Carol; R2: Alice vs Carol otra vez (repetido). R3 sin repetidos.
const RONDAS = [
  { courts: [cancha(0, 1, 2, 3), cancha(4, 5, 6, 7)], sittingOut: [] },
  { courts: [cancha(0, 4, 2, 6), cancha(1, 5, 3, 7)], sittingOut: [] },
  { courts: [cancha(0, 7, 1, 6), cancha(2, 5, 3, 4)], sittingOut: [] },
];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("avisa del repetido y Re-optimizar lo resuelve sin tocar la ronda fijada", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Manual", courts: 2, matchmaking: "manual", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true, manualRoundsConfig: RONDAS },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  await page.getByRole("button", { name: /Armar rondas/ }).click();
  const aviso = page.getByTestId("aviso-repetidos");
  await expect(aviso).toBeVisible({ timeout: 8000 });
  await expect(aviso).toContainText("Alice y Carol: rivales en R1, R2");

  // Fijar R1 y re-optimizar
  await page.getByTestId("candado-ronda-1").click();
  await page.getByTestId("reoptimizar").click();
  await page.getByTestId("confirmar-reoptimizar").click();
  await expect(page.getByTestId("aviso-repetidos")).toHaveCount(0);
  await expect(page.getByTestId("msg-reoptimizar")).toContainText("Sin repetidos");

  // La ronda fijada no cambió
  await expect.poll(async () => {
    const r1 = (await getTournamentData(CODE))?.config?.manualRoundsConfig?.[0];
    return r1?.courts?.map((c) => [...c.pairA, ...c.pairB].map((p) => p.id).join(",")).join("|");
  }, { timeout: 8000 }).toBe("0,1,2,3|4,5,6,7");
});
