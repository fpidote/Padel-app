/**
 * Liga: eliminar un resultado, y cierre de los resultados al iniciar la fase final
 * (con la salida "Volver a la fase de liga" mientras no se haya jugado la eliminatoria).
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
} from "../helpers/seed.js";

const CODE = "LIGACIERRE";

function pair(id, p1, p2, stats) {
  return { id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0, ...stats };
}

const sets = (a, b) => [{ a, b }, { a, b }];

// Liga de 3 parejas con todos los partidos jugados y fase final de 2 parejas
function ligaTerminada(extra = {}) {
  const ana = pair(0, "Ana", "Beto", { pts: 2, wins: 2, gf: 4, gc: 0, gamesFor: 24, gamesAgainst: 8, played: 2 });
  const caro = pair(1, "Caro", "Dario", { pts: 1, wins: 1, gf: 2, gc: 2, gamesFor: 14, gamesAgainst: 16, played: 2 });
  const eva = pair(2, "Eva", "Fede", { pts: 0, wins: 0, gf: 0, gc: 4, gamesFor: 8, gamesAgainst: 24, played: 2 });
  const done = (id, round, a, b, s) => ({
    id, round, pairA: a, pairB: b, scoreA: "2", scoreB: "0", saved: true, sets: s,
  });
  return {
    type: "liga",
    status: "playing",
    phase: "fixture",
    scoringStarted: true,
    config: {
      name: "Liga cierre",
      courts: 2,
      scoringFormat: "sets3",
      idaYVuelta: false,
      playoffEnabled: true,
      advanceQualifiers: 2,
      seasonMode: "single",
    },
    pairInputs: [ana, caro, eva],
    pairs: [ana, caro, eva],
    rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
    matches: [
      done("r1_m0", 1, ana, caro, sets(6, 3)),
      done("r2_m0", 2, ana, eva, sets(6, 4)),
      done("r3_m0", 3, caro, eva, sets(6, 4)),
    ],
    knockoutBracket: null,
    ...extra,
  };
}

test.beforeEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  await expect(page.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
}

test("eliminar un resultado pide confirmación, deja el partido sin jugar y recalcula la tabla", async ({ page }) => {
  await seedTournament(CODE, ligaTerminada());
  await entrarComoAdmin(page);

  await page.getByRole("button", { name: "Eliminar" }).first().click();
  const modal = page.locator(".fixed.inset-0");
  await expect(modal.getByText(/Eliminar este resultado/)).toBeVisible();
  await modal.getByRole("button", { name: "Eliminar" }).click();

  await expect
    .poll(async () => (await getTournamentData(CODE)).matches.find((m) => m.id === "r1_m0").saved, { timeout: 8000 })
    .toBe(false);
  const data = await getTournamentData(CODE);
  const borrado = data.matches.find((m) => m.id === "r1_m0");
  expect(borrado.scoreA).toBe("");
  expect(borrado.scoreB).toBe("");
  expect(borrado.sets).toBeNull();
  // Ana ya no suma esa victoria
  expect(data.pairs.find((p) => p.id === 0).pts).toBe(1);
  // Los demás resultados siguen ahí
  expect(data.matches.filter((m) => m.saved)).toHaveLength(2);
});

test("cancelar el aviso de eliminar no cambia nada", async ({ page }) => {
  await seedTournament(CODE, ligaTerminada());
  await entrarComoAdmin(page);

  await page.getByRole("button", { name: "Eliminar" }).first().click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".fixed.inset-0")).toHaveCount(0);
  const data = await getTournamentData(CODE);
  expect(data.matches.filter((m) => m.saved)).toHaveLength(3);
});

test("iniciar la fase final avisa, cierra los resultados de la liga y permite volver si no se jugó nada", async ({ page }) => {
  await seedTournament(CODE, ligaTerminada());
  await entrarComoAdmin(page);

  // Antes de iniciar: se puede editar y eliminar
  await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();

  await page.getByRole("button", { name: /Iniciar Fase Final/ }).click();
  await expect(page.getByText(/ya no se podrán modificar/)).toBeVisible();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar" }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).phase, { timeout: 8000 }).toBe("playoff");

  // Resultados cerrados: sin Editar ni Eliminar y con el aviso
  await expect(page.getByText(/Resultados de la liga cerrados/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);

  // Sin partidos jugados en la eliminatoria se puede volver
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await page.getByRole("button", { name: /Volver a la fase de liga/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Volver a la liga" }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).phase, { timeout: 8000 }).toBe("fixture");
  const data = await getTournamentData(CODE);
  expect(data.knockoutBracket ?? null).toBeNull();
  await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();
});

test("si ya se jugó un partido de la eliminatoria no se puede volver a la liga", async ({ page }) => {
  const ana = { id: 0, p1: "Ana", p2: "Beto" };
  const caro = { id: 1, p1: "Caro", p2: "Dario" };
  await seedTournament(CODE, ligaTerminada({
    phase: "playoff",
    knockoutBracket: [{
      id: "w_r1_m0", bracket: "winners", round: 1, matchIndex: 0,
      pairA: ana, pairB: caro, scoreA: "2", scoreB: "0", saved: true,
      winner: ana, loser: caro, nextMatchId: null, nextMatchSlot: null,
      loserMatchId: null, loserMatchSlot: null, sets: sets(6, 3),
    }],
  }));
  await entrarComoAdmin(page);
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await expect(page.getByText("Campeón de la Liga")).toBeVisible();
  await expect(page.getByRole("button", { name: /Volver a la fase de liga/ })).toHaveCount(0);
});

test("el espectador no ve Editar ni Eliminar", async ({ page }) => {
  await seedTournament(CODE, ligaTerminada());
  await page.goto(`/torneo/${CODE}`);
  await expect(page.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
});

test("tras eliminar un resultado recién guardado la tarjeta queda limpia, sin Guardar activo", async ({ page }) => {
  const t = ligaTerminada();
  t.matches[2] = { ...t.matches[2], scoreA: "", scoreB: "", saved: false, sets: null };
  await seedTournament(CODE, t);
  await entrarComoAdmin(page);

  const casillas = page.locator('input[type="number"]');
  await expect(casillas.first()).toBeVisible();
  const rellenar = async (a, b) => {
    const n = await casillas.count();
    await casillas.nth(n - 2).fill(String(a));
    await casillas.nth(n - 1).fill(String(b));
  };
  await rellenar(6, 2);
  await rellenar(6, 2);
  await page.getByRole("button", { name: "Guardar resultado" }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).matches.find((m) => m.id === "r3_m0").saved, { timeout: 8000 }).toBe(true);

  await page.getByRole("button", { name: "Eliminar" }).last().click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Eliminar" }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).matches.find((m) => m.id === "r3_m0").saved, { timeout: 8000 }).toBe(false);

  await expect(page.getByRole("button", { name: "Guardar resultado" })).toBeDisabled();
  await expect(page.getByText(/Gana /)).toHaveCount(0);
});

test("liga finalizada: Jornadas dice que el torneo terminó, no que la fase final está en marcha", async ({ page }) => {
  await seedTournament(CODE, ligaTerminada({ phase: "playoff", status: "finished" }));
  await page.goto(`/torneo/${CODE}`);
  await expect(page.getByText("🏁 Torneo finalizado: los resultados están cerrados.")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/ya está en marcha/)).toHaveCount(0);
});
