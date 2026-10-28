/**
 * Navegación del torneo: flecha para volver (al panel si eres el dueño, a la home si no) y, solo para quien
 * no organiza, una franja al final que invita a crear su propio torneo.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken, addHelper } from "../helpers/seed.js";

const CODE = "VOLVERBAN1";
const EMAIL = "profe@gmail.com";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });
const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario")];
const liga = () => ({
  type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
  config: { name: "Volver", courts: 1, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
  pairInputs: pairs, pairs, rounds: [{ round: 1, date: null }],
  matches: [{ id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "", scoreB: "", saved: false, sets: null }],
  knockoutBracket: null,
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function abrir(browser, { uid, claims } = {}, sesion = true) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`/torneo/${CODE}`);
  if (sesion) {
    const token = await getTestToken(uid, claims);
    await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  }
  return page;
}

test("el espectador ve la flecha (a la home) y el banner para crear su torneo", async ({ browser }) => {
  await seedTournament(CODE, liga());
  const page = await abrir(browser, {}, false);
  await expect(page.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("banner-crear")).toBeVisible();
  await page.getByTestId("banner-crear").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await page.getByTestId("btn-volver").click();
  await expect(page).toHaveURL(/\/$/);
});

test("el dueño vuelve a Mis torneos y no ve el banner", async ({ browser }) => {
  await seedTournament(CODE, liga());
  const page = await abrir(browser, {});
  await expect(page.getByText("👑 Admin")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("banner-crear")).toHaveCount(0);
  await page.getByTestId("btn-volver").click();
  await expect(page).toHaveURL(/\/panel/);
});

test("el ayudante vuelve a la home y no ve el banner", async ({ browser }) => {
  await seedTournament(CODE, liga());
  await addHelper(CODE, EMAIL);
  const page = await abrir(browser, { uid: "ayudante-1", claims: { email: EMAIL, email_verified: true } });
  await expect(page.getByText("🤝 Ayudante")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("banner-crear")).toHaveCount(0);
  await page.getByTestId("btn-volver").click();
  await expect(page).toHaveURL(/\/$/);
});

test("también hay flecha en la pantalla de preparación y en la de espera del espectador", async ({ browser }) => {
  await seedTournament(CODE, {});
  const dueno = await abrir(browser, {});
  await expect(dueno.getByTestId("btn-volver")).toBeVisible({ timeout: 8000 });
  const espectador = await abrir(browser, {}, false);
  await expect(espectador.getByText(/aún no comenzó/)).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByTestId("btn-volver")).toBeVisible();
});
