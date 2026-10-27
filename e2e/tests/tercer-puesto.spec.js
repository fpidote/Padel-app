/**
 * Fase final con partido por el 3.º y 4.º puesto: aparece con los dos perdedores de semifinales
 * y el campeón sale de la final, no de ese partido.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament } from "../helpers/seed.js";
import { buildBracket, advanceBracket } from "../../src/logic/relampago.js";

const CODE = "TERCERPUESTO";

function pair(id, p1, p2) {
  return { id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 };
}

function torneoEnFaseFinal(bracket) {
  const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
  return {
    type: "liga",
    status: "playing",
    phase: "playoff",
    scoringStarted: true,
    config: { name: "Liga 3.º puesto", scoringFormat: "games", playoffEnabled: true, advanceQualifiers: 4, thirdPlace: true, seasonMode: "single" },
    pairInputs: pairs,
    pairs,
    rounds: [],
    matches: [],
    knockoutBracket: bracket,
  };
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

test("las semifinales jugadas llenan el partido por el 3.º puesto y no se confunde con la final", async ({ page }) => {
  const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
  let bracket = buildBracket(pairs, { consolation: false, thirdPlace: true });
  const [s0, s1] = bracket.filter((m) => m.bracket === "winners" && m.round === 1);
  bracket = advanceBracket(bracket, s0.id, 6, 2);
  bracket = advanceBracket(bracket, s1.id, 6, 3);
  await seedTournament(CODE, torneoEnFaseFinal(bracket));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.getByRole("button", { name: /Eliminatoria/ }).click();

  await expect(page.getByText("🥉 3.º Y 4.º PUESTO", { exact: true })).toBeVisible({ timeout: 8000 });
  // Los perdedores de las semifinales (Gus/Hugo y Eva/Fede) juegan entre sí en esa tarjeta
  const tarjeta = page.getByText("🥉 3.º Y 4.º PUESTO", { exact: true }).locator("xpath=ancestor::div[.//text()[contains(.,'vs')]][1]");
  await expect(tarjeta).toContainText(`${s0.pairB.p1} / ${s0.pairB.p2}`);
  await expect(tarjeta).toContainText(`${s1.pairB.p1} / ${s1.pairB.p2}`);
  await expect(page.getByText("Campeón de la Liga")).toHaveCount(0);
  await page.screenshot({ path: "test-results/tercer-puesto-390.png", fullPage: true });
});
