/**
 * Editar abre las casillas con lo GUARDADO, no con lo que hubiera quedado escrito sin guardar (por ejemplo
 * cuando otra pantalla guardó antes ese partido). Y en Relámpago, si Guardar falla la tarjeta sigue abierta
 * con el marcador puesto.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "CASILLASOBS";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function abrir(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  return page;
}

test("Liga: tras guardar otra pantalla el mismo partido, Editar abre con lo guardado", async ({ browser }) => {
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Obsoletas", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: pairs, pairs, rounds: [{ round: 1, date: null }],
    matches: [
      { id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "", scoreB: "", saved: false, sets: null },
      { id: "r1_m1", round: 1, pairA: pairs[2], pairB: pairs[3], scoreA: "", scoreB: "", saved: false, sets: null },
    ],
    knockoutBracket: null,
  });
  const context = await browser.newContext();
  const A = await abrir(context);
  const B = await abrir(context);
  await expect(A.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
  await expect(B.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });

  // A escribe 6-1 y NO guarda; B escribe y guarda 2-6 en el mismo partido
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("1");
  await B.locator('input[type="number"]').nth(0).fill("2");
  await B.locator('input[type="number"]').nth(1).fill("6");
  await B.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).matches[0].saved, { timeout: 8000 }).toBe(true);

  // A ve el partido guardado por B y, al pulsar Editar, las casillas traen 2 y 6 (no su 6-1)
  await A.getByRole("button", { name: /Editar/ }).first().click({ timeout: 8000 });
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("2");
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("6");
});

test("Liga: si B abre Editar sobre un partido que guardó, la pantalla A no trae su marcador viejo sin guardar", async ({ browser }) => {
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Obsoletas B", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
    pairInputs: pairs, pairs, rounds: [{ round: 1, date: null }],
    matches: [
      { id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "", scoreB: "", saved: false, sets: null },
      { id: "r1_m1", round: 1, pairA: pairs[2], pairB: pairs[3], scoreA: "", scoreB: "", saved: false, sets: null },
    ],
    knockoutBracket: null,
  });
  const context = await browser.newContext();
  const A = await abrir(context);
  const B = await abrir(context);
  await expect(A.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
  await expect(B.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });

  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("1");
  await B.locator('input[type="number"]').nth(0).fill("2");
  await B.locator('input[type="number"]').nth(1).fill("6");
  await B.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).matches[0].saved, { timeout: 8000 }).toBe(true);

  // B pulsa Editar; A no toca nada y sus casillas se abren con lo guardado (2-6), no con su 6-1
  await B.getByRole("button", { name: /Editar/ }).first().click({ timeout: 8000 });
  await expect.poll(async () => (await getTournamentData(CODE)).matches[0].editing, { timeout: 8000 }).toBe(true);
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("2", { timeout: 8000 });
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("6");
});

test("Relámpago: si otra pantalla guarda el partido, la tarjeta abierta aquí no sigue mostrando casillas", async ({ browser }) => {
  await seedTournament(CODE, {
    type: "relampago", status: "setup", phase: "setup",
    config: { name: "Rel misma", courts: 2, scoringSystem: "timed" },
    pairInputs: pairs, pairs: [], bracket: null,
  });
  const context = await browser.newContext();
  const A = await abrir(context);
  await A.getByTestId("btn-open-modal").or(A.getByRole("button", { name: /Iniciar Torneo/i })).first().waitFor({ timeout: 8000 });
  if (await A.getByTestId("btn-open-modal").count()) { await A.getByTestId("btn-open-modal").click(); await A.getByTestId("btn-iniciar").click(); }
  else await A.getByRole("button", { name: /Iniciar Torneo/i }).click();
  const B = await abrir(context);
  const nombres = A.getByText(/^\S+ \/ \S+$/).first();
  await nombres.waitFor({ timeout: 8000 });
  await B.getByText(/^\S+ \/ \S+$/).first().waitFor({ timeout: 8000 });

  // Las dos abren el mismo partido; A escribe sin guardar y B guarda
  await A.getByText(/^\S+ \/ \S+$/).first().click();
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("2");
  await B.getByText(/^\S+ \/ \S+$/).first().click();
  await B.locator('input[type="number"]').nth(0).fill("3");
  await B.locator('input[type="number"]').nth(1).fill("6");
  await B.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(async () => ((await getTournamentData(CODE))?.bracket ?? []).some((m) => m.saved), { timeout: 8000 }).toBe(true);

  // En A el partido ya figura guardado: sin casillas ni Guardar abiertos
  await expect(A.getByText("✏️ Editar").first()).toBeVisible({ timeout: 8000 });
  await expect(A.locator('input[type="number"]')).toHaveCount(0);
  await expect(A.getByRole("button", { name: /Guardar/ })).toHaveCount(0);
});

test("Relámpago: si Guardar falla la tarjeta sigue abierta con el marcador", async ({ page, context }) => {
  await seedTournament(CODE, {
    type: "relampago", status: "setup", phase: "setup",
    config: { name: "Rel falla", courts: 2, scoringSystem: "timed" },
    pairInputs: pairs, pairs: [], bracket: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  const abrirModal = page.getByTestId("btn-open-modal");
  const directo = page.getByRole("button", { name: /Iniciar Torneo/i });
  await expect(abrirModal.or(directo)).toBeVisible({ timeout: 8000 });
  if (await abrirModal.count()) { await abrirModal.click(); await page.getByTestId("btn-iniciar").click(); } else { await directo.click(); }
  await page.getByText(/^\S+ \/ \S+$/).first().click();
  const casillas = page.locator('input[type="number"]');
  await casillas.nth(0).fill("6");
  await casillas.nth(1).fill("2");

  await context.setOffline(true);
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect(page.getByText(/sin conexión/i).first()).toBeVisible();
  // La tarjeta sigue abierta con el marcador, no queda cerrada con "–"
  await expect(casillas.nth(0)).toHaveValue("6");
  await expect(casillas.nth(1)).toHaveValue("2");

  await context.setOffline(false);
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect.poll(async () => ((await getTournamentData(CODE))?.bracket ?? []).some((m) => m.saved), { timeout: 15000 }).toBe(true);
});
