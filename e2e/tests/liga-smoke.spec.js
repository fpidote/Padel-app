/**
 * Smoke test del nuevo formato Liga: renderiza el fixture, permite al
 * organizador cargar un resultado a mejor de 3 sets, y la tabla de
 * posiciones se actualiza correctamente en Firestore.
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
} from "../helpers/seed.js";

const CODE = "LIGATST";

function pair(id, p1, p2) {
  return { id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 };
}

function ligaTournament() {
  const pairs = [
    pair(0, "Ana", "Beto"),
    pair(1, "Caro", "Dario"),
    pair(2, "Eva", "Fede"),
  ];
  return {
    type: "liga",
    status: "playing",
    phase: "fixture",
    config: {
      name: "Liga E2E",
      courts: 2,
      scoringFormat: "sets3",
      idaYVuelta: false,
      playoffEnabled: false,
      advanceQualifiers: 4,
      seasonMode: "single",
    },
    pairInputs: pairs,
    pairs,
    rounds: [
      { round: 1, date: null },
      { round: 2, date: null },
      { round: 3, date: null },
    ],
    matches: [
      { id: "r1_m0", round: 1, pairA: pairs[0], pairB: pairs[1], scoreA: "", scoreB: "", saved: false, sets: null },
      { id: "r2_m0", round: 2, pairA: pairs[0], pairB: pairs[2], scoreA: "", scoreB: "", saved: false, sets: null },
      { id: "r3_m0", round: 3, pairA: pairs[1], pairB: pairs[2], scoreA: "", scoreB: "", saved: false, sets: null },
    ],
    knockoutBracket: null,
  };
}

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

test("espectador ve el fixture de Liga agrupado por jornadas", async ({ page }) => {
  await seedTournament(CODE, ligaTournament());
  await page.goto(`/torneo/${CODE}`);

  await expect(page.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });
  // Ana/Beto y Caro/Dario juegan en más de una jornada — usamos .first()
  await expect(page.getByText("Ana / Beto").first()).toBeVisible();
  await expect(page.getByText("Caro / Dario").first()).toBeVisible();
});

test("el organizador carga un resultado a mejor de 3 sets y la tabla se actualiza", async ({ page }) => {
  await seedTournament(CODE, ligaTournament());
  await page.goto(`/torneo/${CODE}`);
  await signInAsAdmin(page);

  await expect(page.getByText("Jornada 1")).toBeVisible({ timeout: 8000 });

  // Cargar 6-4 y 6-3 (Ana/Beto gana 2 sets a 0, no hace falta un tercer set)
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("6"); // set 1 - pareja A
  await numberInputs.nth(1).fill("4"); // set 1 - pareja B
  await numberInputs.nth(2).fill("6"); // set 2 - pareja A
  await numberInputs.nth(3).fill("3"); // set 2 - pareja B

  // La Jornada 1 se renderiza primero — su botón "Guardar resultado" es el único habilitado
  await page.getByRole("button", { name: "Guardar resultado" }).first().click();

  await expect(page.getByText("✅ Guardado")).toBeVisible({ timeout: 5000 });

  // Verificar en Firestore que el resultado y la tabla de posiciones quedaron correctos
  await page.waitForTimeout(500);
  const data = await getTournamentData(CODE);
  const match = data.matches.find((m) => m.id === "r1_m0");
  expect(match.saved).toBe(true);
  expect(match.scoreA).toBe("2");
  expect(match.scoreB).toBe("0");
  expect(match.sets).toEqual([{ a: 6, b: 4 }, { a: 6, b: 3 }]);

  const standingA = data.pairs.find((p) => p.id === 0);
  const standingB = data.pairs.find((p) => p.id === 1);
  expect(standingA.pts).toBe(1);
  expect(standingA.gf).toBe(2);
  expect(standingA.gc).toBe(0);
  expect(standingA.gamesFor).toBe(12);
  expect(standingA.gamesAgainst).toBe(7);
  expect(standingB.pts).toBe(0);

  // La pestaña de posiciones refleja el mismo resultado
  await page.getByRole("button", { name: /Posiciones/i }).click();
  await expect(page.getByText("Ana / Beto")).toBeVisible();
});

test("el organizador arma el torneo desde cero (setup) y el fixture se genera al iniciar", async ({ page }) => {
  await seedTournament(CODE, {
    type: "liga",
    status: "setup",
    config: {
      name: "Liga Setup E2E",
      courts: 2,
      scoringFormat: "sets3",
      idaYVuelta: false,
      playoffEnabled: true,
      advanceQualifiers: 2,
      seasonMode: "single",
    },
    pairInputs: [
      { id: 0, p1: "Ana", p2: "Beto", pts: 0, gf: 0, gc: 0 },
      { id: 1, p1: "Caro", p2: "Dario", pts: 0, gf: 0, gc: 0 },
      { id: 2, p1: "Eva", p2: "Fede", pts: 0, gf: 0, gc: 0 },
      { id: 3, p1: "Gus", p2: "Hugo", pts: 0, gf: 0, gc: 0 },
    ],
    pairs: [],
    rounds: [],
    matches: [],
    knockoutBracket: null,
    phase: "setup",
  });
  await page.goto(`/torneo/${CODE}`);
  await signInAsAdmin(page);

  // Liga ahora pasa por "Revisar y lanzar" (muestra el fixture) antes de iniciar.
  await expect(page.getByTestId("btn-open-modal")).toBeEnabled({ timeout: 8000 });
  await page.getByTestId("btn-open-modal").click();
  await expect(page.getByTestId("btn-iniciar")).toBeVisible({ timeout: 3000 });
  await page.getByTestId("btn-iniciar").click();

  await page.waitForTimeout(1000);
  const data = await getTournamentData(CODE);
  expect(data.status).toBe("playing");
  expect(data.phase).toBe("fixture");
  // 4 parejas, ida simple → 3 jornadas, 6 partidos (n*(n-1)/2)
  expect(data.rounds).toHaveLength(3);
  expect(data.matches).toHaveLength(6);
  expect(data.pairs).toHaveLength(4);
  data.pairs.forEach((p) => expect(p.pts).toBe(0));
});
