/**
 * Casillas obsoletas con dos pantallas cuando la pantalla A es la que LANZÓ el torneo (el caso real: el dueño
 * lanza desde su móvil y el ayudante carga). Antes el estado confirmado de A se quedaba atrasado y su marcador
 * viejo reaparecía al corregir.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "CASILLASLANZA";
const NOMBRES = ["Ana", "Beto", "Caro", "Dani", "Eva", "Fede", "Gus", "Hugo"];

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

async function lanzarDesdeA(browser) {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Lanza", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true },
    playerInputs: NOMBRES.map((name) => ({ name, level: 0 })),
  });
  const context = await browser.newContext();
  const A = await abrir(context);
  await A.getByTestId("btn-open-modal").click();
  await A.getByTestId("btn-iniciar").click();
  await expect(A.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
  const B = await abrir(context);
  await expect(B.locator('input[type="number"]').first()).toBeVisible({ timeout: 8000 });
  return { A, B };
}
const pista = async (i) => (await getTournamentData(CODE))?.currentRound?.[i] ?? {};

test("A lanza el torneo: lo que escribe sin guardar no reaparece cuando B guarda y vuelve a abrir la corrección", async ({ browser }) => {
  const { A, B } = await lanzarDesdeA(browser);
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("1");
  await B.locator('input[type="number"]').nth(0).fill("2");
  await B.locator('input[type="number"]').nth(1).fill("6");
  await B.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista(0)).saved, { timeout: 8000 }).toBe(true);

  await B.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await pista(0)).editing, { timeout: 8000 }).toBe(true);
  // A abre con lo guardado (2-6), no con su 6-1
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("2", { timeout: 8000 });
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("6");

  // A escribe en la corrección y B guarda la suya: al volver a abrirla, A ve lo guardado por B
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("1");
  await B.locator('input[type="number"]').nth(0).fill("3");
  await B.locator('input[type="number"]').nth(1).fill("6");
  await B.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista(0)).scoreA, { timeout: 8000 }).toBe("3");
  await B.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await pista(0)).editing, { timeout: 8000 }).toBe(true);
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("3", { timeout: 8000 });
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("6");
  expect(await pista(0)).toMatchObject({ scoreA: "3", scoreB: "6" });
});

test("guardar o corregir otro partido desde otra pantalla no borra la corrección que A está escribiendo", async ({ browser }) => {
  const { A, B } = await lanzarDesdeA(browser);
  // B guarda primero la pista 2: A recibe una escritura ajena y ya tiene la pista 1 "sin guardar" en su estado confirmado
  await B.locator('input[type="number"]').nth(2).fill("6");
  await B.locator('input[type="number"]').nth(3).fill("3");
  await B.getByRole("button", { name: "Guardar resultado" }).last().click();
  await expect.poll(async () => (await pista(1)).saved, { timeout: 8000 }).toBe(true);

  // A guarda la pista 1, la abre para corregir y escribe 7-5
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("2");
  await A.getByRole("button", { name: "Guardar resultado" }).first().click();
  await expect.poll(async () => (await pista(0)).saved, { timeout: 8000 }).toBe(true);
  await A.getByRole("button", { name: /Editar/ }).first().click();
  await expect.poll(async () => (await pista(0)).editing, { timeout: 8000 }).toBe(true);
  await A.locator('input[type="number"]').nth(0).fill("7");
  await A.locator('input[type="number"]').nth(1).fill("5");

  // B abre la corrección de SU pista (otra escritura ajena): A conserva su 7-5 en la pista 1
  await B.getByRole("button", { name: /Editar/ }).last().click();
  await expect.poll(async () => (await pista(1)).editing, { timeout: 8000 }).toBe(true);
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("7");
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("5");
});

test("acuse lento del guardado propio: la corrección que se escribe mientras tanto no se vacía", async ({ browser }) => {
  const { A } = await lanzarDesdeA(browser);
  // La escritura al servidor tarda 3 s en confirmarse
  await A.route("**/documents:commit*", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await A.locator('input[type="number"]').nth(0).fill("6");
  await A.locator('input[type="number"]').nth(1).fill("2");
  await A.getByRole("button", { name: "Guardar resultado" }).first().click();
  // Sin esperar el acuse: Editar y cambiar solo el segundo marcador
  await A.getByRole("button", { name: /Editar/ }).first().click();
  await A.locator('input[type="number"]').nth(1).fill("3");
  await expect.poll(async () => (await pista(0)).saved, { timeout: 15000 }).toBe(true);
  await A.waitForTimeout(1500);
  // Al llegar el acuse del primer guardado, la corrección sigue entera (6 y 3), no vacía
  await expect(A.locator('input[type="number"]').nth(0)).toHaveValue("6");
  await expect(A.locator('input[type="number"]').nth(1)).toHaveValue("3");
});
