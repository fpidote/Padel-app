/**
 * Liga con cantidad impar de parejas: cada jornada indica quién descansa, y la confirmación de
 * "Iniciar Fase Final" lista las parejas que pasan según la tabla.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";
import { buildLigaFixture, recomputeLigaStandings } from "../../src/logic/liga.js";

const CODE = "LIGADESCANSO";

const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"]];
const pairs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));

// Gana siempre la pareja con menor id, así la tabla queda 0, 1, 2, 3, 4
function ligaCompleta() {
  const { rounds, matches } = buildLigaFixture(pairs);
  const jugados = matches.map((m) => {
    const aGana = m.pairA.id < m.pairB.id;
    const sets = aGana ? [{ a: 6, b: 2 }, { a: 6, b: 3 }] : [{ a: 2, b: 6 }, { a: 3, b: 6 }];
    return { ...m, saved: true, scoreA: aGana ? "2" : "0", scoreB: aGana ? "0" : "2", sets };
  });
  return { rounds, matches: jugados, standings: recomputeLigaStandings(pairs, jugados) };
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("5 parejas: cada jornada indica quién descansa, y las 5 descansan una vez", async ({ page }) => {
  const { rounds, matches } = buildLigaFixture(pairs);
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Liga impar", courts: 2, scoringFormat: "sets3", idaYVuelta: false, playoffEnabled: false, advanceQualifiers: 4, seasonMode: "single" },
    pairInputs: pairs, pairs, rounds, matches, knockoutBracket: null,
  });
  await entrarComoAdmin(page);
  await expect(page.getByText("Jornada 1", { exact: true })).toBeVisible({ timeout: 8000 });
  const avisos = page.getByText(/😴 Descansa:/);
  await expect(avisos).toHaveCount(5);   // visible aunque la jornada esté plegada
  const textos = await avisos.allTextContents();
  const quienes = textos.map((t) => t.replace("😴 Descansa: ", ""));
  expect(new Set(quienes).size).toBe(5);
  await page.screenshot({ path: "test-results/liga-descansa-390.png", fullPage: true });
});

test("4 parejas: no aparece ningún aviso de descanso", async ({ page }) => {
  const cuatro = pairs.slice(0, 4);
  const { rounds, matches } = buildLigaFixture(cuatro);
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: false,
    config: { name: "Liga par", courts: 2, scoringFormat: "sets3", idaYVuelta: false, playoffEnabled: false, advanceQualifiers: 4, seasonMode: "single" },
    pairInputs: cuatro, pairs: cuatro, rounds, matches, knockoutBracket: null,
  });
  await entrarComoAdmin(page);
  await expect(page.getByText("Jornada 1", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Descansa:/)).toHaveCount(0);
});

test("Iniciar Fase Final lista las parejas que pasan según la tabla", async ({ page }) => {
  const { rounds, matches, standings } = ligaCompleta();
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "fixture", scoringStarted: true,
    config: { name: "Liga completa", courts: 2, scoringFormat: "sets3", idaYVuelta: false, playoffEnabled: true, advanceQualifiers: 4, seasonMode: "single" },
    pairInputs: pairs, pairs: standings, rounds, matches, knockoutBracket: null,
  });
  await entrarComoAdmin(page);
  await page.getByRole("button", { name: /Iniciar Fase Final/ }).click();
  const lista = page.getByTestId("clasificados");
  await expect(lista).toBeVisible({ timeout: 8000 });
  await expect(lista.locator("li")).toHaveText(["1. Ana / Beto", "2. Caro / Dario", "3. Eva / Fede", "4. Gus / Hugo"]);
  await expect(page.getByText(/se cierran los resultados de la liga/)).toBeVisible();
  await page.screenshot({ path: "test-results/liga-clasificados-390.png" });
  // Iris / Juan (5.ª) no pasa
  await expect(lista).not.toContainText("Iris");
});
