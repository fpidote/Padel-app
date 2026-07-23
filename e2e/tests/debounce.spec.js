/**
 * Regression tests for the debounce race condition.
 *
 * Bug: when `onStart()` wrote status:"playing" to Firestore, a pending debounce
 * (from field edits during setup) would fire 600ms later with a stale `t` object
 * and overwrite status back to "setup", leaving the tournament stuck.
 *
 * Fix: `onStart()` cancels all pending debounces before calling persist().
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
} from "../helpers/seed.js";

const CODE = "DEBTEST";

test.beforeEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function signInAsAdmin(page) {
  const token = await getTestToken();
  await page.evaluate(async (t) => {
    await window.__e2eSignIn(t);
  }, token);
}

// Opens the launch modal and returns without clicking Iniciar
async function openLaunchModal(page) {
  await expect(page.getByTestId("btn-open-modal")).toBeEnabled({ timeout: 5000 });
  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByTestId("btn-iniciar")).toBeVisible({ timeout: 3000 });
}

test("iniciar torneo no se pisa con un debounce pendiente", async ({ page }) => {
  await seedTournament(CODE);
  await page.goto(`/torneo/${CODE}`);

  await expect(page.getByText("El torneo aún no comenzó")).toBeVisible({ timeout: 8000 });

  await signInAsAdmin(page);
  await expect(page.getByTestId("btn-open-modal")).toBeVisible({ timeout: 5000 });

  // Editar el nombre — dispara el debounce de 600ms con `t` viejo (status:"setup")
  const nameInput = page.getByTestId("input-tournament-name");
  await nameInput.click();
  await nameInput.fill("Torneo Editado");

  // Abrir modal e Iniciar INMEDIATAMENTE (antes de que el debounce de 600ms se dispare)
  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByTestId("btn-iniciar")).toBeVisible({ timeout: 2000 });
  await page.getByTestId("btn-iniciar").click();

  // Esperar 1500ms — el debounce hubiera disparado si no fue cancelado por onStart()
  await page.waitForTimeout(1500);

  // Verificar que el status en Firestore quedó "playing" y no fue revertido a "setup"
  const data = await getTournamentData(CODE);
  expect(data.status).toBe("playing");
});

test("el torneo inicia correctamente y conserva los jugadores", async ({ page }) => {
  await seedTournament(CODE);
  await page.goto(`/torneo/${CODE}`);

  await signInAsAdmin(page);
  await openLaunchModal(page);
  await page.getByTestId("btn-iniciar").click();

  // El modal desaparece y la vista cambia al play
  await expect(page.getByTestId("btn-iniciar")).not.toBeVisible({ timeout: 5000 });

  // Esperar a que el write asíncrono a Firestore complete
  await page.waitForTimeout(1000);

  const data = await getTournamentData(CODE);
  expect(data.status).toBe("playing");
  expect(data.players).toHaveLength(4);
  expect(data.currentRound).not.toBeNull();
  expect(data.roundNum).toBe(1);
});
