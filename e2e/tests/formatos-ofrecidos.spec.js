/**
 * Los formatos que se ofrecen al crear: el Pozo está oculto, tanto en el modal de creación como en la
 * lista de formatos de la pantalla de inicio. Los Pozos ya creados se siguen abriendo (pozo-vista-previa).
 */
import { test, expect } from "@playwright/test";
import { getTestToken, deleteTournament } from "../helpers/seed.js";

test("el modal de creación y la landing no ofrecen El Pozo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Elige tu formato")).toBeVisible();
  await expect(page.getByText("El Pozo")).toHaveCount(0);

  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Crear torneo gratis/ }).first().click();
  await expect(page.getByText("Elige el tipo de torneo")).toBeVisible();
  for (const id of ["americano", "relampago", "mundialito", "liga"]) {
    await expect(page.getByTestId(`crear-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("crear-pozo")).toHaveCount(0);
  await expect(page.getByText("El Pozo")).toHaveCount(0);
});

test("tocar una tarjeta de formato de la landing crea ese torneo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByTestId("formato-liga").click();
  await expect(page).toHaveURL(/\/torneo\//);
  const code = page.url().split("/torneo/")[1];
  try {
    await expect(page.getByTestId("input-tournament-name")).toHaveValue("Torneo Liga");
  } finally {
    await deleteTournament(code).catch(() => {});
  }
});
