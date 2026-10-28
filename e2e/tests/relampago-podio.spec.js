/**
 * Relámpago terminado: Posiciones muestra el podio del cuadro (campeón y subcampeón salen de la final,
 * el tercero de la revancha) y la tabla no reparte medallas por victorias.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament } from "../helpers/seed.js";
import { buildBracket, advanceBracket } from "../../src/logic/relampago.js";

const CODE = "RELPODIO";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"], ["Mara", "Nico"], ["Olga", "Pepe"]];
const parejas = (n) => NOMBRES.slice(0, n).map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));
const nombre = (p) => `${p.p1} / ${p.p2}`;

// Gana siempre la pareja A salvo en la final, que gana la B: el campeón es quien llega de la parte baja
function torneoTerminado({ n = 6, revanchaJugada = true } = {}) {
  let b = buildBracket(parejas(n));
  const final = () => b.find((m) => m.bracket === "winners" && !m.nextMatchId);
  const consolFinal = () => b.find((m) => m.bracket === "consolation" && !m.nextMatchId);
  for (let g = 0; g < 100; g++) {
    const m = b.find((x) => !x.saved && x.pairA && x.pairB && x.pairA.id !== "bye" && x.pairB.id !== "bye"
      && !(!revanchaJugada && x.id === consolFinal().id));
    if (!m) break;
    const gana = m.id === final().id ? "B" : "A";
    b = advanceBracket(b, m.id, gana === "A" ? 6 : 2, gana === "A" ? 2 : 6);
  }
  return { b, final: final(), consolFinal: consolFinal() };
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

function sembrar(b, n = 6) {
  const pairs = parejas(n);
  return seedTournament(CODE, {
    type: "relampago", status: "playing", phase: "bracket", scoringStarted: true,
    config: { name: "Relámpago podio", courts: 2, scoringFormat: "games", matchMinutes: 10 },
    pairInputs: pairs, pairs, bracket: b,
  });
}

test("Posiciones muestra campeón y subcampeón de la final y al ganador de la revancha, sin medallas por victorias", async ({ page }) => {
  const { b, final, consolFinal } = torneoTerminado();
  await sembrar(b);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Posiciones/ }).click();

  const podio = page.locator("div.rounded-xl", { has: page.getByText("Resultado final") }).first();
  await expect(podio).toBeVisible({ timeout: 8000 });
  await expect(podio).toContainText(nombre(final.winner));
  await expect(podio.locator("div", { hasText: /^Subcampeón/ }).first()).toContainText(nombre(final.loser));
  await expect(podio.locator("div", { hasText: /^Ganador de la revancha/ }).first()).toContainText(nombre(consolFinal.winner));
  await expect(page.locator("td", { hasText: /🥇|🥈|🥉/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/relampago-podio-390.png", fullPage: true });
});

test("con la final jugada y la revancha pendiente, el tercero queda por definir", async ({ page }) => {
  const { b } = torneoTerminado({ n: 8, revanchaJugada: false });
  await sembrar(b, 8);
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("Resultado final")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Por definir")).toBeVisible();
});

test("las reglas explican que a la revancha pasa quien pierde su primer partido", async ({ page }) => {
  const { b } = torneoTerminado();
  await sembrar(b);
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Reglas/ }).click();
  await expect(page.getByText(/primer partido/)).toBeVisible({ timeout: 8000 });
});
