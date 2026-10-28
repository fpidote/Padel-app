/**
 * Los formatos que se ofrecen al crear: el Pozo está oculto, tanto en el modal de creación como en la
 * lista de formatos de la pantalla de inicio. Los Pozos ya creados se siguen abriendo (pozo-vista-previa).
 */
import { test, expect } from "@playwright/test";
import { getTestToken } from "../helpers/seed.js";

test("el modal de creación y la landing no ofrecen El Pozo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Elige tu formato")).toBeVisible();
  await expect(page.getByText("El Pozo")).toHaveCount(0);

  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Crear torneo gratis/ }).first().click();
  await expect(page.getByText("Elige el tipo de torneo")).toBeVisible();
  for (const nombre of ["Americano", "Relámpago", "Torneo por grupos", "Liga"]) {
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible();
  }
  await expect(page.getByText("El Pozo")).toHaveCount(0);
});
