/**
 * Americano manual con 24 jugadores (8 avanzados, 8 medios, 8 principiantes), 6 pistas y 8 rondas:
 * Autocompletar deja pocas repeticiones, nadie se enfrenta tres veces al mismo rival, la lista de repeticiones
 * se puede abrir entera. Orden de prioridades: pareja primero, niveles igualados y, dentro de eso, pocos rivales repetidos.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "AM24MAN1";
const nivel = (i) => (i < 8 ? 3 : i < 16 ? 2 : 1);

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("24 jugadores, 6 pistas y 8 rondas: pocas repeticiones, ningún rival tres veces y lista desplegable", async ({ page }) => {
  test.setTimeout(90000);
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Veinticuatro", courts: 6, matchmaking: "manual", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 8, useLevels: true, goldenPoint: true },
    playerInputs: Array.from({ length: 24 }, (_, i) => ({ name: `Jugador ${String(i + 1).padStart(2, "0")}`, level: nivel(i) })),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Armar rondas/ }).click();

  // Autocompletar con 8 rondas
  await expect(page.getByTestId("completar-rondas")).toBeVisible({ timeout: 8000 });
  await page.getByTestId("completar-rondas").click();
  await expect(page.getByText("R8 ✓")).toBeVisible({ timeout: 30000 });

  // Guardar y comprobar en el servidor: nadie se enfrenta 3 veces y las repeticiones son pocas
  await page.getByRole("button", { name: /✓ Guardar y volver/ }).click();
  await expect.poll(async () => (await getTournamentData(CODE))?.config?.manualRoundsConfig?.length, { timeout: 10000 }).toBe(8);
  const rondas = (await getTournamentData(CODE)).config.manualRoundsConfig;
  const veces = {};
  const compañeros = {};
  for (const r of rondas) for (const c of r.courts) {
    for (const [x, y] of [c.pairA, c.pairB]) { const k = [x.id, y.id].sort().join("_"); compañeros[k] = (compañeros[k] || 0) + 1; }
    for (const x of c.pairA) for (const y of c.pairB) { const k = [x.id, y.id].sort().join("_"); veces[k] = (veces[k] || 0) + 1; }
  }
  expect(Math.max(...Object.values(compañeros))).toBe(1);   // nadie repite compañero
  expect(Math.max(...Object.values(veces))).toBeLessThanOrEqual(2); // nadie se enfrenta 3 veces
  expect(Object.values(veces).filter((n) => n >= 2).length).toBeLessThan(25); // antes salían ~29

  // Si hay más de 5 repeticiones, la lista se abre entera
  await page.getByRole("button", { name: /Armar rondas/ }).click();
  const ver = page.getByTestId("ver-todas-repeticiones");
  if (await ver.count()) {
    const antes = await page.getByTestId("aviso-repetidos").locator("li").count();
    expect(antes).toBe(5);
    await ver.click();
    expect(await page.getByTestId("aviso-repetidos").locator("li").count()).toBeGreaterThan(5);
    await ver.click();
    expect(await page.getByTestId("aviso-repetidos").locator("li").count()).toBe(5);
  }
});
