/**
 * Relámpago con un número de parejas que no es potencia de 2 (5): los pasa directo se resuelven solos,
 * el único partido real de la primera ronda se juega por la interfaz y su resultado enruta al ganador
 * al cuadro principal y al perdedor a la revancha; al editarlo todo vuelve a su lugar.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "CUADROBYES";
const NAMES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"]];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

const isReal = (p) => p && p.id !== "bye";
const slotsOf = (bracket, prefix) =>
  bracket.filter((m) => m.id.startsWith(prefix)).flatMap((m) => [m.pairA, m.pairB]).filter(isReal).map((p) => p.id);

test("con 5 parejas los pasa directo avanzan solos y el partido real enruta ganador y perdedor", async ({ page }) => {
  await seedTournament(CODE, {
    type: "relampago",
    status: "setup",
    phase: "setup",
    config: { name: "Cuadro con byes", courts: 2, scoringSystem: "timed", scoringFormat: "sets3", seedByOrder: true },
    pairInputs: NAMES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 })),
    pairs: [],
    bracket: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  // La vista previa avisa de los 3 pasa directo antes de iniciar
  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByText("Pasa directo")).toHaveCount(3);
  await page.getByTestId("btn-iniciar").click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("playing");

  let d = await getTournamentData(CODE);
  const real = d.bracket.find((m) => m.id.startsWith("w_r1") && isReal(m.pairA) && isReal(m.pairB));
  expect(real).toBeTruthy();
  // Los 3 pasa directo ya están en la segunda ronda sin haber jugado
  expect(slotsOf(d.bracket, "w_r2")).toHaveLength(3);
  expect(d.bracket.filter((m) => m.id.startsWith("w_r1") && m.saved && (m.pairA.id === "bye" || m.pairB.id === "bye"))).toHaveLength(3);

  // El partido real se carga por la interfaz: gana la pareja A
  await page.getByText(`${real.pairA.p1} / ${real.pairA.p2}`).first().click();
  const inputs = page.locator('input[type="number"]');
  for (const [i, v] of [["0", "6"], ["1", "4"], ["2", "6"], ["3", "3"]]) await inputs.nth(Number(i)).fill(v);
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((m) => m.id === real.id).saved).toBe(true);

  d = await getTournamentData(CODE);
  expect(slotsOf(d.bracket, "w_r2")).toContain(real.pairA.id);       // el ganador sigue en el cuadro principal
  expect(slotsOf(d.bracket, "w_r2")).not.toContain(real.pairB.id);
  expect(slotsOf(d.bracket, "c_")).toContain(real.pairB.id);         // el perdedor cae a la revancha
  expect(slotsOf(d.bracket, "c_")).not.toContain(real.pairA.id);
  await page.screenshot({ path: "test-results/cuadro-byes-390.png", fullPage: true });

  // Editar el resultado lo devuelve todo a su lugar
  await page.getByText("✏️ editar").first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((m) => m.id === real.id).saved).toBe(false);
  d = await getTournamentData(CODE);
  expect(slotsOf(d.bracket, "w_r2")).not.toContain(real.pairA.id);
  expect(slotsOf(d.bracket, "c_")).not.toContain(real.pairB.id);
  expect(slotsOf(d.bracket, "w_r2")).toHaveLength(3);                // los pasa directo siguen donde estaban
});
