/**
 * Ayudantes de torneo: un ayudante (correo de Google añadido por el dueño) carga resultados, pasa de ronda y
 * finaliza, pero no edita, lanza ni gestiona ayudantes. Los demás siguen como espectadores.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken, addHelper, removeHelper } from "../helpers/seed.js";

const CODE = "AYUDANTES1";
const EMAIL = "profe@gmail.com";
const claims = (email) => ({ email, email_verified: true });
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
const match = (id, round, a, b) => ({ id, round, pairA: a, pairB: b, scoreA: "", scoreB: "", saved: false, sets: null });

const liga = () => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
  config: { name: "Ayudantes", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
  pairInputs: pairs, pairs,
  rounds: [{ round: 1, date: null }],
  matches: [match("r1_m0", 1, pairs[0], pairs[1]), match("r1_m1", 1, pairs[2], pairs[3])],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function abrir(browser, { uid, email, sesion = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`/torneo/${CODE}`);
  if (sesion) {
    const token = await getTestToken(uid, email ? claims(email) : undefined);
    await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  }
  return page;
}
const guardados = async () => (await getTournamentData(CODE)).matches.filter((m) => m.saved).length;

test("el ayudante carga resultados y finaliza el torneo; el dueño lo ve", async ({ browser }) => {
  await seedTournament(CODE, liga());
  await addHelper(CODE, EMAIL);
  const ayudante = await abrir(browser, { uid: "ayudante-1", email: EMAIL });
  await expect(ayudante.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
  const c = ayudante.locator('input[type="number"]');
  await expect(c.first()).toBeVisible();
  await c.nth(0).fill("6"); await c.nth(1).fill("2");
  await c.nth(2).fill("6"); await c.nth(3).fill("3");
  await ayudante.getByRole("button", { name: "Guardar resultado" }).first().click();
  await ayudante.getByRole("button", { name: "Guardar resultado" }).last().click();
  await expect.poll(guardados, { timeout: 8000 }).toBe(2);

  await ayudante.getByRole("button", { name: /Finalizar torneo/ }).click();
  await ayudante.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status, { timeout: 8000 }).toBe("finished");
});

test("el ayudante no ve Editar torneo ni Ayudantes; el dueño sí", async ({ browser }) => {
  await seedTournament(CODE, liga());
  await addHelper(CODE, EMAIL);
  const dueno = await abrir(browser, {});
  await expect(dueno.getByText("✏️ Editar torneo")).toBeVisible({ timeout: 8000 });
  await expect(dueno.getByTestId("btn-ayudantes")).toBeVisible();

  const ayudante = await abrir(browser, { uid: "ayudante-1", email: EMAIL });
  await expect(ayudante.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
  await expect(ayudante.getByText("✏️ Editar torneo")).toHaveCount(0);
  await expect(ayudante.getByTestId("btn-ayudantes")).toHaveCount(0);
});

test("un usuario con sesión que no es ayudante ve el torneo como espectador", async ({ browser }) => {
  await seedTournament(CODE, liga());
  await addHelper(CODE, EMAIL);
  const otro = await abrir(browser, { uid: "otro-1", email: "otra@gmail.com" });
  await expect(otro.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
  await expect(otro.locator('input[type="number"]')).toHaveCount(0);
  await expect(otro.getByText("🤝 Ayudante")).toHaveCount(0);
});

test("quien no tiene sesión ve el enlace para iniciarla; con sesión desaparece", async ({ browser }) => {
  await seedTournament(CODE, liga());
  const espectador = await abrir(browser, { sesion: false });
  await expect(espectador.getByTestId("btn-iniciar-sesion")).toBeVisible({ timeout: 8000 });
  const dueno = await abrir(browser, {});
  await expect(dueno.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
  await expect(dueno.getByTestId("btn-iniciar-sesion")).toHaveCount(0);
});

test("dueño y ayudante guardando a la vez: no se muestra un guardado que el servidor no tiene", async ({ browser }) => {
  let hubConflicto = false;
  for (let intento = 0; intento < 8 && !hubConflicto; intento++) {
    await seedTournament(CODE, liga());
    await addHelper(CODE, EMAIL);
    const dueno = await abrir(browser, {});
    const ayudante = await abrir(browser, { uid: "ayudante-1", email: EMAIL });
    await expect(dueno.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
    await expect(ayudante.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
    await expect(ayudante.locator('input[type="number"]').first()).toBeVisible();

    await dueno.locator('input[type="number"]').nth(0).fill("6");
    await dueno.locator('input[type="number"]').nth(1).fill("2");
    await ayudante.locator('input[type="number"]').nth(2).fill("6");
    await ayudante.locator('input[type="number"]').nth(3).fill("3");
    await Promise.all([
      dueno.getByRole("button", { name: "Guardar resultado" }).first().click(),
      ayudante.getByRole("button", { name: "Guardar resultado" }).last().click(),
    ]);
    await dueno.waitForTimeout(1500);
    const enServidor = await guardados();
    expect(enServidor).toBeGreaterThanOrEqual(1);
    for (const page of [dueno, ayudante]) await expect(page.getByText("✅ Guardado")).toHaveCount(enServidor);
    if (enServidor === 1) hubConflicto = true;
  }
  expect(hubConflicto).toBe(true);
});

test("si el dueño quita al ayudante, su siguiente guardado falla con aviso y la pantalla vuelve a lo guardado", async ({ browser }) => {
  await seedTournament(CODE, liga());
  await addHelper(CODE, EMAIL);
  const ayudante = await abrir(browser, { uid: "ayudante-1", email: EMAIL });
  await expect(ayudante.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
  await removeHelper(CODE, EMAIL);

  const c = ayudante.locator('input[type="number"]');
  await c.nth(0).fill("6"); await c.nth(1).fill("2");
  await ayudante.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect(ayudante.getByText(/No tienes permiso para guardar/)).toBeVisible({ timeout: 8000 });
  expect(await guardados()).toBe(0);
  await expect(ayudante.getByText("✅ Guardado")).toHaveCount(0);
});

test("el dueño añade ayudantes desde la pantalla, confirma el correo y el sexto da el aviso de máximo", async ({ browser }) => {
  await seedTournament(CODE, liga());
  const dueno = await abrir(browser, {});
  await dueno.getByTestId("btn-ayudantes").click();
  const modal = dueno.getByTestId("modal-ayudantes");
  await expect(modal).toBeVisible({ timeout: 8000 });

  for (let i = 1; i <= 5; i++) {
    await modal.getByPlaceholder("correo@gmail.com").fill(i === 1 ? "  Profe1@Gmail.COM " : `profe${i}@gmail.com`);
    await modal.getByTestId("agregar-ayudante").click();
    if (i === 1) await expect(modal.getByTestId("correo-a-confirmar")).toHaveText("profe1@gmail.com");
    await modal.getByTestId("confirmar-ayudante").click();
    await expect(modal.getByTestId("ayudante")).toHaveCount(i);
  }
  await expect(modal.getByTestId("error-ayudante")).toContainText("Máximo 5 ayudantes");
  await modal.getByRole("button", { name: "Quitar" }).first().click();
  await expect(modal.getByTestId("ayudante")).toHaveCount(4);
});

test("el dueño sigue siéndolo aunque un ayudante cambie el ownerUid guardado dentro de data", async ({ browser }) => {
  await seedTournament(CODE, { ...liga(), ownerUid: "otra-persona" });
  const dueno = await abrir(browser, {});
  await expect(dueno.getByText("✏️ Editar torneo")).toBeVisible({ timeout: 8000 });
  await expect(dueno.getByTestId("btn-ayudantes")).toBeVisible();
});

test("en el Americano el ayudante no ve niveles ni renombra hasta que el dueño lo permite", async ({ browser }) => {
  await seedTournament(CODE, {});
  await addHelper(CODE, EMAIL);
  const dueno = await abrir(browser, {});
  await dueno.getByTestId("btn-open-modal").click();
  await dueno.getByTestId("btn-iniciar").click();
  await expect(dueno.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });

  const ayudante = await abrir(browser, { uid: "ayudante-1", email: EMAIL });
  await expect(ayudante.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
  await expect(ayudante.locator('input[type="number"]').first()).toBeVisible();
  await expect(ayudante.getByText(/Ocultar niveles|Mostrar niveles/)).toHaveCount(0);

  await dueno.getByTestId("btn-ayudantes").click();
  await dueno.getByTestId("perm-niveles").check();
  await expect.poll(async () => (await getTournamentData(CODE)).helperPerms?.levels, { timeout: 8000 }).toBe(true);

  await expect(ayudante.getByText(/Ocultar niveles|Mostrar niveles/).first()).toBeVisible({ timeout: 8000 });
});
