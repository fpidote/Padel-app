/**
 * Finalizar el torneo (Torneo por grupos y Liga): el botón aparece solo con todo jugado, pide
 * confirmación, cierra los resultados y el podio refleja a los campeones de la fase final.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { buildGroups, buildKnockoutFromGroups } from "../../src/logic/mundialito.js";
import { buildLigaKnockout } from "../../src/logic/liga.js";
import { advanceBracket, buildBracket } from "../../src/logic/relampago.js";

const CODE = "FINALIZARTORNEO";

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrarComoAdmin(page, tab) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: tab }).click();
}

// ── Torneo por grupos ───────────────────────────────────────────
const NAMES = [["Ana", "Beto"], ["Caro", "Dario"], ["Eva", "Fede"], ["Gus", "Hugo"], ["Iris", "Juan"], ["Kali", "Leo"]];

function grupos({ jugarTercero }) {
  const pairs = NAMES.map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 }));
  const groups = buildGroups(pairs, 2);
  groups.forEach((g) => {
    g.matches.forEach((m, i) => { m.saved = true; m.scoreA = "6"; m.scoreB = String(i % 4); });
    g.standings = g.standings.map((s) => {
      const mine = g.matches.filter((m) => m.pairA.id === s.id || m.pairB.id === s.id);
      const gf = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreA : m.scoreB), 0);
      const gc = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreB : m.scoreA), 0);
      const wins = mine.filter((m) => m.pairA.id === s.id).length;
      return { ...s, played: mine.length, wins, pts: wins, gf, gc, gamesFor: gf, gamesAgainst: gc };
    });
  });
  let bracket = buildKnockoutFromGroups(groups, 2, { thirdPlace: true });
  for (const m of bracket.filter((x) => x.round === 1 && x.bracket === "winners")) bracket = advanceBracket(bracket, m.id, 6, 3);
  bracket = advanceBracket(bracket, "w_r2_m0", 6, 4);
  if (jugarTercero) bracket = advanceBracket(bracket, "w_third", 6, 2);
  return {
    type: "mundialito", status: "playing", phase: "knockout", scoringStarted: true,
    config: { name: "Grupos", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games", thirdPlace: true },
    pairInputs: pairs, pairs, groups, knockoutBracket: bracket,
  };
}

test("Torneo por grupos: no se puede finalizar sin jugar el 3.º puesto; al finalizar se cierran los resultados", async ({ page }) => {
  await seedTournament(CODE, grupos({ jugarTercero: false }));
  await entrarComoAdmin(page, /Eliminatoria/);
  await expect(page.getByText("Campeón del torneo")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);

  // Se juega el partido por el 3.º y ya aparece el botón
  await seedTournament(CODE, grupos({ jugarTercero: true }));
  await page.reload();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  const boton = page.getByRole("button", { name: /Finalizar torneo/ });
  await expect(boton).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();

  await boton.click();
  await expect(page.getByText(/los resultados se cierran/)).toBeVisible();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Cancelar" }).click();
  expect((await getTournamentData(CODE)).status).toBe("playing");

  await boton.click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
  await expect(page.getByText(/Torneo finalizado: los resultados están cerrados/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Posiciones/ }).click();
  await expect(page.getByText("🏁 Torneo finalizado")).toBeVisible();
});

// ── Liga ────────────────────────────────────────────────────────
function pair(id, p1, p2, stats) {
  return { id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0, ...stats };
}
const sets = (a, b) => [{ a, b }, { a, b }];

function liga({ playoff, finalJugada = true }) {
  const ana = pair(0, "Ana", "Beto", { pts: 2, wins: 2, gf: 4, gc: 0, gamesFor: 24, gamesAgainst: 8, played: 2 });
  const caro = pair(1, "Caro", "Dario", { pts: 1, wins: 1, gf: 2, gc: 2, gamesFor: 14, gamesAgainst: 16, played: 2 });
  const eva = pair(2, "Eva", "Fede", { pts: 0, wins: 0, gf: 0, gc: 4, gamesFor: 8, gamesAgainst: 24, played: 2 });
  const done = (id, round, a, b, s) => ({ id, round, pairA: a, pairB: b, scoreA: "2", scoreB: "0", saved: true, sets: s });
  const matches = [done("r1_m0", 1, ana, caro, sets(6, 3)), done("r2_m0", 2, ana, eva, sets(6, 4)), done("r3_m0", 3, caro, eva, sets(6, 4))];
  let bracket = null;
  if (playoff) {
    bracket = buildLigaKnockout([ana, caro, eva], 2, matches);
    // La final la gana la 2.ª de la tabla (Caro): el campeón no es el 1.º de la liga
    if (finalJugada) bracket = advanceBracket(bracket, bracket[0].id, 3, 6);
  }
  return {
    type: "liga", status: "playing", phase: playoff ? "playoff" : "fixture", scoringStarted: true,
    config: { name: "Liga final", courts: 2, scoringFormat: "sets3", idaYVuelta: false, playoffEnabled: playoff, advanceQualifiers: 2, seasonMode: "single" },
    pairInputs: [ana, caro, eva], pairs: [ana, caro, eva],
    rounds: [{ round: 1, date: null }, { round: 2, date: null }, { round: 3, date: null }],
    matches, knockoutBracket: bracket,
  };
}

test("Liga con eliminatoria: Posiciones muestra el podio de la fase final y la tabla sin medallas", async ({ page }) => {
  await seedTournament(CODE, liga({ playoff: true }));
  await entrarComoAdmin(page, /Posiciones/);

  await expect(page.getByText("Resultado final")).toBeVisible({ timeout: 8000 });
  const podio = page.locator("div.rounded-xl", { has: page.getByText("Resultado final") }).first();
  await expect(podio).toContainText("Caro / Dario");   // campeón de la eliminatoria, no el 1.º de la liga
  await expect(podio).toContainText("Ana / Beto");     // subcampeón
  await expect(page.getByText("🏆 Tabla de la liga")).toBeVisible();
  await expect(page.locator("td", { hasText: "🥇" })).toHaveCount(0);
  await expect(page.getByText(/el campeón se decide en la eliminatoria/)).toBeVisible();
  await expect(page.getByText("⚡ Fase final")).toBeVisible();
  await page.screenshot({ path: "test-results/liga-posiciones-final-390.png", fullPage: true });

  // Finalizar
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await page.getByRole("button", { name: /Finalizar torneo/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
});

test("Liga con 3.º puesto: al finalizar también se cierra el partido por el 3.º y el podio no se puede cambiar", async ({ page }) => {
  const pairs = [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario"), pair(2, "Eva", "Fede"), pair(3, "Gus", "Hugo")];
  let bracket = buildBracket(pairs, { consolation: false, thirdPlace: true });
  for (const m of bracket.filter((x) => x.bracket === "winners" && x.round === 1)) bracket = advanceBracket(bracket, m.id, 6, 2);
  const final = bracket.find((m) => !m.nextMatchId && m.bracket !== "third");
  bracket = advanceBracket(bracket, final.id, 6, 3);
  bracket = advanceBracket(bracket, bracket.find((m) => m.bracket === "third").id, 6, 4);
  await seedTournament(CODE, {
    type: "liga", status: "playing", phase: "playoff", scoringStarted: true,
    config: { name: "Liga 3.º", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: true, advanceQualifiers: 4, thirdPlace: true, seasonMode: "single" },
    pairInputs: pairs, pairs, rounds: [], matches: [], knockoutBracket: bracket,
  });
  await entrarComoAdmin(page, /Eliminatoria/);
  await page.getByRole("button", { name: /Finalizar torneo/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
  await expect(page.getByText(/Torneo finalizado: los resultados están cerrados/)).toBeVisible();
  // Ningún partido, tampoco el del 3.º puesto, se puede editar una vez finalizado
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  const tercero = page.getByText("🥉 3.º Y 4.º PUESTO").locator("xpath=ancestor::div[.//text()[contains(.,'Cerrado')]][1]");
  await expect(tercero).toContainText("Cerrado");
});

test("Liga con eliminatoria sin terminar: no hay podio ni botón de finalizar, y la tabla no lleva medallas", async ({ page }) => {
  await seedTournament(CODE, liga({ playoff: true, finalJugada: false }));
  await entrarComoAdmin(page, /Posiciones/);
  await expect(page.getByText("🏆 Tabla de la liga")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Resultado final")).toHaveCount(0);
  await expect(page.locator("td", { hasText: "🥇" })).toHaveCount(0);
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await expect(page.getByRole("button", { name: /Finalizar torneo/ })).toHaveCount(0);
});

test("Liga sin eliminatoria: se finaliza desde Jornadas y los resultados quedan cerrados", async ({ page }) => {
  await seedTournament(CODE, liga({ playoff: false }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await expect(page.getByText("Campeón de la Liga")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /Finalizar torneo/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("finished");
  await expect(page.getByText(/Torneo finalizado: los resultados están cerrados/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  await expect(page.getByText(/la fase final ya está en marcha/)).toHaveCount(0);
});
