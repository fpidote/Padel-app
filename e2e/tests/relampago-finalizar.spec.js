/**
 * Finalizar un Relámpago: el botón aparece solo con el cuadro y la revancha jugados, pide confirmación,
 * cierra los resultados y el espectador nunca lo ve.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { buildBracket, advanceBracket } from "../../src/logic/relampago.js";

const CODE = "RELFINALIZAR";
const NOMBRES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"], ["Mara", "Nico"], ["Olga", "Pepe"]];
const pairs = NOMBRES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 }));

function cuadro({ revanchaJugada }) {
  let b = buildBracket(pairs);
  const consolFinal = () => b.find((m) => m.bracket === "consolation" && !m.nextMatchId).id;
  for (let g = 0; g < 100; g++) {
    const m = b.find((x) => !x.saved && x.pairA && x.pairB && x.pairA.id !== "bye" && x.pairB.id !== "bye" && !(!revanchaJugada && x.id === consolFinal()));
    if (!m) break;
    b = advanceBracket(b, m.id, 6, 2);
  }
  return b;
}

const sembrar = (b) => seedTournament(CODE, {
  type: "relampago", status: "playing", phase: "bracket", scoringStarted: true,
  config: { name: "Relámpago cierre", courts: 2, scoringFormat: "games", matchMinutes: 10 },
  pairInputs: pairs, pairs, bracket: b,
});

async function entrarComoAdmin(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("con la revancha pendiente no se puede finalizar y se explica por qué", async ({ page }) => {
  await sembrar(cuadro({ revanchaJugada: false }));
  await entrarComoAdmin(page);
  await expect(page.getByText("Para finalizar el torneo falta jugar la revancha.")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);
});

test("finalizar pide confirmación, cierra los resultados y el podio queda como finalizado", async ({ page }) => {
  await sembrar(cuadro({ revanchaJugada: true }));
  await entrarComoAdmin(page);
  const boton = page.getByRole("button", { name: /Finalizar torneo/ });
  await expect(boton).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("✏️ Editar").first()).toBeVisible();

  await boton.click();
  await expect(page.getByText(/los resultados se cierran/)).toBeVisible();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Cancelar" }).click();
  expect((await getTournamentData(CODE)).status).toBe("playing");

  await boton.click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
  await expect(page.getByText(/Torneo finalizado: los resultados están cerrados/)).toBeVisible();
  await expect(page.getByText("✏️ Editar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("🏁 Torneo finalizado")).toBeVisible();
});

test("el espectador no ve el botón de finalizar", async ({ page }) => {
  await sembrar(cuadro({ revanchaJugada: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await expect(page.getByText("Campeón").first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);
  await expect(page.getByText(/falta jugar la revancha/)).toHaveCount(0);
});
