import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament } from "../helpers/seed.js";

const CODE = "SMOKE1";

test.beforeEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("home page carga correctamente", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Padeldesk|Padel/i);
  // El CTA principal siempre está visible en la landing
  await expect(page.getByRole("link", { name: /crear torneo/i }).or(
    page.getByRole("button", { name: /crear torneo/i })
  ).first()).toBeVisible({ timeout: 5000 });
});

test("torneo inexistente muestra pantalla de error", async ({ page }) => {
  await page.goto("/torneo/NOEXISTE99");
  await expect(page.getByText("Torneo no encontrado")).toBeVisible({ timeout: 8000 });
});

test("espectador ve mensaje de espera cuando el torneo está en setup", async ({ page }) => {
  await seedTournament(CODE);
  await page.goto(`/torneo/${CODE}`);
  // El espectador (sin auth) debe ver que el torneo aún no comenzó
  await expect(page.getByText("El torneo aún no comenzó")).toBeVisible({ timeout: 8000 });
});
