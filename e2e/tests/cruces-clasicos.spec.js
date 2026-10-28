/**
 * Cruce clásico por grupos (1º A vs 2º B) en el Torneo por grupos: se ofrece y es el de por defecto
 * cuando aplica, el organizador puede cambiarlo, la proyección lo muestra desde el primer día y el
 * cuadro que se genera al iniciar la fase final lo respeta.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";
import { buildGroups } from "../../src/logic/mundialito.js";

const CODE = "CRUCESCLASICOS";
const pares = (n) => Array.from({ length: n }, (_, i) => ({ id: i, p1: `J${i}A`, p2: `J${i}B`, pts: 0, gf: 0, gc: 0 }));

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page, overrides) {
  await seedTournament(CODE, overrides);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
}

test("en la configuración el clásico es el de por defecto y el organizador puede cambiarlo", async ({ page }) => {
  await entrar(page, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Cruces", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: pares(8), groups: null, knockoutBracket: null,
  });
  await expect(page.getByText("Cruces de la fase final")).toBeVisible({ timeout: 8000 });
  const clasico = page.getByRole("button", { name: /Clásico por grupos/ });
  const rendimiento = page.getByRole("button", { name: /Por rendimiento/ });
  await expect(clasico).toContainText("⭐");
  await expect(clasico).toContainText("1º A vs 2º B");
  await page.screenshot({ path: "test-results/cruces-config-390.png", fullPage: true });

  await rendimiento.click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.crossing).toBe("performance");
  await clasico.click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.crossing).toBe("classic");
});

test("con 3 grupos el clásico no se ofrece (no hay con quién cruzar al tercero)", async ({ page }) => {
  await entrar(page, {
    type: "mundialito", status: "setup", phase: "setup",
    config: { name: "Cruces", courts: 2, groupCount: 3, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: pares(9), groups: null, knockoutBracket: null,
  });
  await expect(page.getByText("Formato de grupos")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Cruces de la fase final")).toHaveCount(0);
});

test("4 grupos: la proyección muestra los 4 cruces desde el primer día, sin repetir ningún grupo", async ({ page }) => {
  const groups = buildGroups(pares(12), 4);
  await entrar(page, {
    type: "mundialito", status: "playing", phase: "groups", scoringStarted: false,
    config: { name: "Cruces", courts: 2, groupCount: 4, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: pares(12), pairs: pares(12), groups, knockoutBracket: null,
  });
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await expect(page.getByText("🔮 Proyección de Cruces")).toBeVisible({ timeout: 8000 });
  const filas = page.locator("div.rounded-lg", { has: page.getByText("VS", { exact: true }) });
  await expect(filas).toHaveCount(4);
  const textos = (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  expect(textos).toEqual([
    "1º Grupo A VS 2º Grupo B",
    "1º Grupo C VS 2º Grupo D",
    "1º Grupo B VS 2º Grupo A",
    "1º Grupo D VS 2º Grupo C",
  ]);
  await page.screenshot({ path: "test-results/cruces-proyeccion-390.png", fullPage: true });
});

test("al iniciar la fase final el cuadro respeta el cruce clásico (y el de rendimiento si se eligió)", async ({ page }) => {
  const armar = (crossing) => {
    const pairs = pares(12);
    const groups = buildGroups(pairs, 4);
    groups.forEach((g, gi) => {
      g.matches.forEach((m, i) => { m.saved = true; m.scoreA = "6"; m.scoreB = String((i + gi) % 4); });
      g.standings = g.standings.map((s) => {
        const mine = g.matches.filter((m) => m.pairA.id === s.id || m.pairB.id === s.id);
        const gf = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreA : m.scoreB), 0);
        const gc = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreB : m.scoreA), 0);
        const wins = mine.filter((m) => m.pairA.id === s.id).length;
        return { ...s, played: mine.length, wins, pts: wins, gf, gc, gamesFor: gf, gamesAgainst: gc };
      });
    });
    return {
      type: "mundialito", status: "playing", phase: "groups", scoringStarted: true,
      config: { name: "Cruces", courts: 2, groupCount: 4, advancePerGroup: 2, scoringFormat: "games", ...(crossing ? { crossing } : {}) },
      pairInputs: pairs, pairs, groups, knockoutBracket: null,
    };
  };

  // Por defecto: clásico
  await entrar(page, armar(null));
  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");
  let d = await getTournamentData(CODE);
  const rankOf = (g) => [...g.standings].sort((a, b) => b.wins - a.wins || (b.gf - b.gc) - (a.gf - a.gc)).map((s) => s.id);
  const lugar = {}; // id de pareja -> "A1", "B2"...
  d.groups.forEach((g, gi) => rankOf(g).slice(0, 2).forEach((id, pos) => { lugar[id] = `${"ABCD"[gi]}${pos + 1}`; }));
  const primera = d.knockoutBracket.filter((m) => m.bracket === "winners" && m.round === 1).sort((a, b) => a.matchIndex - b.matchIndex);
  expect(primera.map((m) => `${lugar[m.pairA.id]}-${lugar[m.pairB.id]}`)).toEqual(["A1-B2", "C1-D2", "B1-A2", "D1-C2"]);

  // Eligiendo rendimiento el cuadro sale sembrado por mérito, no con ese emparejamiento fijo
  await deleteTournament(CODE);
  await seedTournament(CODE, armar("performance"));
  await page.reload();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");
  d = await getTournamentData(CODE);
  const rend = d.knockoutBracket.filter((m) => m.bracket === "winners" && m.round === 1).sort((a, b) => a.matchIndex - b.matchIndex);
  expect(rend.map((m) => `${lugar[m.pairA.id]}-${lugar[m.pairB.id]}`)).not.toEqual(["A1-B2", "C1-D2", "B1-A2", "D1-C2"]);
});
