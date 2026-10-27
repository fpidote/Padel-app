/**
 * Torneo por grupos: el organizador ve los formatos posibles según sus parejas, elige uno
 * y puede personalizar grupos y clasificados a mano.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "FORMATOSGRUPOS";

function parejas(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i, p1: `Jugador${i}A`, p2: `Jugador${i}B`, pts: 0, gf: 0, gc: 0,
  }));
}

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

async function entrar(page, n) {
  await seedTournament(CODE, {
    type: "mundialito",
    config: { name: "Grupos E2E", courts: 2, groupCount: 2, advancePerGroup: 2, scoringFormat: "games" },
    pairInputs: parejas(n),
    groups: null,
    knockoutBracket: null,
    phase: "setup",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/torneo/${CODE}`);
  const token = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, token);
  await expect(page.getByText("Formato de grupos")).toBeVisible({ timeout: 8000 });
}

test("con 12 parejas sugiere 4 grupos de 3 y al elegirlo guarda la configuración", async ({ page }) => {
  await entrar(page, 12);
  const tarjeta = page.getByRole("button", { name: /4 grupos de 3 · pasa 1 de cada grupo/ });
  await expect(tarjeta).toContainText("Cada pareja juega 2 partidos");
  await expect(tarjeta).toContainText("Clasifican 4: semifinales y final");
  await page.screenshot({ path: "test-results/formatos-12-390.png", fullPage: true });

  await tarjeta.click();
  await expect.poll(async () => {
    const d = await getTournamentData(CODE);
    return `${d.config.groupCount}-${d.config.advancePerGroup}`;
  }).toBe("4-1");
});

test("con 10 parejas ofrece 2 grupos de 5 y Personalizar abre los selectores manuales", async ({ page }) => {
  await entrar(page, 10);
  await expect(page.getByRole("button", { name: /2 grupos de 5 · pasan 2 de cada grupo/ })).toBeVisible();
  await page.getByRole("button", { name: /Personalizar/ }).click();
  await expect(page.getByText("Número de grupos")).toBeVisible();
  const bloque = page.locator("div", { has: page.getByText("Número de grupos", { exact: true }) }).last();
  await bloque.getByRole("button", { name: "3", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.groupCount).toBe(3);
});

test("sin parejas explica cómo funciona y qué formatos aparecerán, sin selectores sueltos", async ({ page }) => {
  await entrar(page, 0);
  await expect(page.getByText(/juegan todas contra todas/)).toBeVisible();
  await expect(page.getByText(/Agrega tus parejas \(mínimo 4\)/)).toBeVisible();
  await expect(page.getByText("Número de grupos")).toHaveCount(0);
  await page.screenshot({ path: "test-results/formatos-0-390.png", fullPage: true });
});

test("Personalizar muestra un resumen en vivo de lo elegido", async ({ page }) => {
  await entrar(page, 12);
  await page.getByRole("button", { name: /Personalizar/ }).click();
  const bloque = page.locator("div", { has: page.getByText("Número de grupos", { exact: true }) }).last();
  await bloque.getByRole("button", { name: "3", exact: true }).click();
  await expect(page.getByText("3 grupos de 4 · pasan 2 de cada grupo", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/Clasifican 6: cuartos de final, 2 pasan directo/).last()).toBeVisible();
  await page.screenshot({ path: "test-results/formatos-custom-390.png", fullPage: true });
});

test("elegir 'mejores terceros' guarda el extra y el cuadro final los incluye (3 grupos de 4: 6 + 2)", async ({ page }) => {
  await entrar(page, 12);
  const tarjeta = page.getByRole("button", { name: /3 grupos de 4 · pasan 2 de cada grupo \+ los 2 mejores terceros/ });
  await expect(tarjeta).toContainText("Clasifican 8: cuartos de final");
  await tarjeta.click();
  await expect.poll(async () => (await getTournamentData(CODE)).config.extraQualifiers).toBe(2);

  // Arranca el torneo por la interfaz
  await page.getByTestId("btn-open-modal").click();
  await page.getByTestId("btn-iniciar").click();
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("playing");

  // Completa los 18 partidos de grupo con resultados variados (gana siempre la pareja A, por distinto margen)
  // y recalcula las tablas igual que lo haría la app
  const data = await getTournamentData(CODE);
  data.groups.forEach((g) => {
    g.matches.forEach((m, i) => { m.saved = true; m.scoreA = "6"; m.scoreB = String((i * 2 + g.id) % 5); });
    g.standings = g.standings.map((s) => {
      const mine = g.matches.filter((m) => m.pairA.id === s.id || m.pairB.id === s.id);
      const gf = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreA : m.scoreB), 0);
      const gc = mine.reduce((n, m) => n + Number(m.pairA.id === s.id ? m.scoreB : m.scoreA), 0);
      const wins = mine.filter((m) => m.pairA.id === s.id).length;
      return { ...s, played: mine.length, wins, pts: wins, gf, gc, gamesFor: gf, gamesAgainst: gc };
    });
  });
  await seedTournament(CODE, data);
  await page.reload();
  const signed = await getTestToken();
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, signed);

  // En los grupos se marca con 🔸 a quienes compiten por los mejores terceros
  await expect(page.getByText("🔸").first()).toBeVisible({ timeout: 8000 });

  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");

  const final = await getTournamentData(CODE);
  const ids = final.knockoutBracket
    .flatMap((m) => [m.pairA?.id, m.pairB?.id])
    .filter((id) => id !== undefined && id !== null && id !== "bye");
  expect(new Set(ids).size).toBe(8);
  expect(final.knockoutBracket.filter((m) => m.round === 1)).toHaveLength(4);
  // Cada grupo aporta sus 2 primeros; los otros 2 cupos son terceros, y son los de mejor rendimiento por partido
  const ranked = final.groups.map((g) => [...g.standings].sort((a, b) => b.wins - a.wins || (b.gf - b.gc) - (a.gf - a.gc)));
  const top2 = ranked.flatMap((r) => r.slice(0, 2).map((s) => s.id));
  top2.forEach((id) => expect(ids).toContain(id));
  const extras = [...new Set(ids)].filter((id) => !top2.includes(id));
  expect(extras).toHaveLength(2);
  const thirds = ranked.map((r) => r[2]);
  extras.forEach((id) => expect(thirds.map((s) => s.id)).toContain(id));
  const rate = (s) => (s.gf - s.gc) / s.played;
  const worst = [...thirds].sort((a, b) => rate(a) - rate(b))[0];
  expect(extras).not.toContain(worst.id);
  await page.screenshot({ path: "test-results/mejores-terceros-390.png", fullPage: true });
});
