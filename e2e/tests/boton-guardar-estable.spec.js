/**
 * El botón "Guardar resultado" no se mueve al escribir el marcador (aparece la línea "Gana X" sin
 * desplazarlo), para que un clic apuntado antes de teclear siga acertando.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";
import { buildGroups } from "../../src/logic/mundialito.js";

const CODE = "BOTONESTABLE";
const pares = (n) => Array.from({ length: n }, (_, i) => ({ id: i, p1: `J${i}A`, p2: `J${i}B`, pts: 0, gf: 0, gc: 0 }));

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("al escribir el marcador el botón Guardar resultado no cambia de posición", async ({ page }) => {
  await seedTournament(CODE, {
    type: "mundialito", status: "playing", phase: "groups", scoringStarted: false,
    config: { name: "Estable", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: pares(6), pairs: pares(6), groups: buildGroups(pares(6), 2), knockoutBracket: null,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());

  const boton = page.getByRole("button", { name: "Guardar resultado" }).first();
  await expect(boton).toBeVisible({ timeout: 8000 });
  const antes = await boton.boundingBox();

  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill("6");
  await inputs.nth(1).fill("2");
  await expect(page.getByText(/Gana/).first()).toBeVisible();
  await expect(boton).toBeEnabled();

  const despues = await boton.boundingBox();
  expect(despues.y).toBe(antes.y);
});
