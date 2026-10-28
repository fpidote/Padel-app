/**
 * Avisos que antes eran silenciosos o confusos: el Americano explica por qué no deja guardar un
 * empate, y el Torneo por grupos no habla de pistas ni de quién descansa en su resumen de parejas.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";

const CODE = "AVISOSCLAROS";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("Americano: un empate muestra el motivo y no ofrece Guardar", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Avisos", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
    playerInputs: ["Ana", "Beto", "Caro", "Dani", "Eva", "Fede", "Gus", "Hugo"].map((name) => ({ name, level: 0 })),
  });
  await entrarComoAdmin(page);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible({ timeout: 8000 });

  await casillas.nth(0).fill("5");
  await casillas.nth(1).fill("5");
  await expect(page.getByTestId("score-error").first()).toContainText("Un partido no puede terminar empatado");
  await expect(page.getByRole("button", { name: "Guardar resultado" })).toHaveCount(0);

  await casillas.nth(1).fill("7");
  await expect(page.getByTestId("score-error")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar resultado" }).first()).toBeVisible();
});

test("Torneo por grupos: el resumen de parejas no habla de pistas ni de quién descansa", async ({ page }) => {
  const pairInputs = Array.from({ length: 8 }, (_, i) => ({ id: i, p1: `A${i}`, p2: `B${i}`, pts: 0, gf: 0, gc: 0 }));
  await seedTournament(CODE, { type: "mundialito", status: "setup", phase: "setup", config: { name: "Grupos", courts: 2 }, pairInputs, playerInputs: [] });
  await entrarComoAdmin(page);
  await expect(page.getByText("8 parejas · ✓ listo")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/pistas|descansan/)).toHaveCount(0);
});

test("Americano por parejas: el resumen habla de parejas, no de jugadores", async ({ page }) => {
  const pairInputs = Array.from({ length: 6 }, (_, i) => ({ id: i, p1: `A${i}`, p2: `B${i}`, pts: 0, gf: 0, gc: 0 }));
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Parejas", courts: 2, matchmaking: "americano", mode: "pairs", scoringSystem: "timed", matchMinutes: 10, maxRounds: 3, useLevels: false, goldenPoint: true },
    pairInputs, playerInputs: [],
  });
  await entrarComoAdmin(page);
  await page.getByTestId("btn-open-modal").click();
  const modal = page.locator(".fixed.inset-0"); // por parejas el modal abre directo en el resumen
  await expect(modal.getByText("2 parejas").first()).toBeVisible();
  await expect(modal.getByText("2 jugadores")).toHaveCount(0);
});

test("Americano: al teclear una coma en el marcador se avisa en vez de descartarla en silencio", async ({ page }) => {
  await seedTournament(CODE, {
    type: "americano", status: "setup",
    config: { name: "Coma", courts: 2, matchmaking: "americano", mode: "individual", scoringSystem: "timed", matchMinutes: 10, maxRounds: 2, useLevels: false, goldenPoint: true },
    playerInputs: ["Ana", "Beto", "Caro", "Dani", "Eva", "Fede", "Gus", "Hugo"].map((name) => ({ name, level: 0 })),
  });
  await entrarComoAdmin(page);
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  const casilla = page.locator('input[type="number"]').first();
  await expect(casilla).toBeVisible({ timeout: 8000 });
  await casilla.click();
  await page.keyboard.type("6,5");
  await expect(page.getByText("Escribe solo números enteros, sin coma ni punto.")).toBeVisible();
});
