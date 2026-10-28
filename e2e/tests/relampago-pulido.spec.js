/**
 * Relámpago ya jugado: el podio completo se ve en la pestaña Cuadro, la tabla de Posiciones no contradice
 * al podio, la revancha usa los mismos nombres, y una pareja repetida avisa al cargarla.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTestToken } from "../helpers/seed.js";
import { buildBracket, advanceBracket, relampagoPodium } from "../../src/logic/relampago.js";

const CODE = "RELPULIDO";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"], ["Mara", "Nico"], ["Olga", "Pepe"]];
const pairs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));

function cuadroJugado() {
  let b = buildBracket(pairs);
  for (let g = 0; g < 100; g++) {
    const m = b.find((x) => !x.saved && x.pairA && x.pairB && x.pairA.id !== "bye" && x.pairB.id !== "bye");
    if (!m) break;
    b = advanceBracket(b, m.id, 6, 2);
  }
  return b;
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("podio en Cuadro, Posiciones coherente con el podio y revancha con los mismos nombres", async ({ page, browser }) => {
  const bracket = cuadroJugado();
  const podium = relampagoPodium(bracket);
  await seedTournament(CODE, {
    type: "relampago", status: "playing", phase: "bracket", scoringStarted: true,
    config: { name: "Pulido", courts: 2, scoringFormat: "games", matchMinutes: 10 },
    pairInputs: pairs, pairs, bracket,
  });

  const espectador = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await espectador.goto(`/torneo/${CODE}`);
  await expect(espectador.getByText("Subcampeón").first()).toBeVisible({ timeout: 8000 });
  await expect(espectador.getByText("Ganador de la revancha").first()).toBeVisible();

  await espectador.getByRole("button", { name: /Revancha/ }).click();
  await expect(espectador.getByText("Final de la revancha")).toBeVisible();
  await expect(espectador.getByText("Campeón Revancha")).toHaveCount(0);

  await espectador.getByRole("button", { name: /Posiciones/ }).click();
  await expect(espectador.getByText("Estadísticas de las parejas")).toBeVisible();
  await expect(espectador.getByRole("columnheader", { name: "#" })).toHaveCount(0);
  const primeras = await espectador.locator("tbody tr td:nth-child(1)").allTextContents();
  expect(primeras[0]).toContain(`${podium.champion.p1} / ${podium.champion.p2}`);
  expect(primeras[1]).toContain(`${podium.runnerUp.p1} / ${podium.runnerUp.p2}`);
  expect(primeras[2]).toContain(`${podium.third.p1} / ${podium.third.p2}`);

  // El organizador, en Revancha, ve que ya puede finalizar
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Revancha/ }).click();
  await expect(page.getByTestId("aviso-puedes-finalizar")).toBeVisible({ timeout: 8000 });
});

test("una pareja repetida avisa al cargarla, sin impedirlo", async ({ page }) => {
  await seedTournament(CODE, {
    type: "relampago", status: "setup", phase: "setup",
    config: { name: "Repetida", courts: 2 }, pairInputs: pairs.slice(0, 2), playerInputs: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByPlaceholder("Jugador 1").fill("beto");
  await page.getByPlaceholder("Jugador 2").fill("ANA");
  await expect(page.getByTestId("aviso-pareja-repetida")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /Agregar pareja/ }).click();
  await expect(page.getByText("⚠️ repetida").first()).toBeVisible();
});
