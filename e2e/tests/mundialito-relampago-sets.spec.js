/**
 * Mundialito (grupos → eliminatoria) y Relámpago con formato por sets:
 * verifica carga set por set, tabla de posiciones y paso a eliminatoria.
 */
import { test, expect } from "@playwright/test";
import {
  seedTournament,
  deleteTournament,
  getTournamentData,
  getTestToken,
} from "../helpers/seed.js";

const CODE = "MUNDTST";

const NAMES = [
  ["Ana", "Beto"],
  ["Caro", "Dario"],
  ["Eva", "Fede"],
  ["Gus", "Hugo"],
  ["Iris", "Juan"],
  ["Kali", "Leo"],
];

function pairInputs(n) {
  return NAMES.slice(0, n).map(([p1, p2], i) => ({ id: i, p1, p2, pts: 0, gf: 0, gc: 0 }));
}

function setupTournament(type, scoringFormat, pairCount, extraConfig = {}) {
  return {
    type,
    status: "setup",
    phase: "setup",
    config: {
      name: "Test sets",
      courts: 2,
      scoringSystem: "timed",
      ...(scoringFormat ? { scoringFormat } : {}),
      ...extraConfig,
    },
    pairInputs: pairInputs(pairCount),
    pairs: [],
    groups: null,
    bracket: null,
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

async function startTournament(page) {
  await page.goto(`/torneo/${CODE}`);
  await signInAsAdmin(page);
  // Mundialito pasa por "Revisar y lanzar"; Relámpago todavía inicia directo con "Iniciar Torneo".
  const open = page.getByTestId("btn-open-modal");
  const direct = page.getByRole("button", { name: /Iniciar Torneo/i });
  await expect(open.or(direct)).toBeVisible({ timeout: 8000 });
  if (await open.count()) {
    await expect(open).toBeEnabled();
    await open.click();
    await expect(page.getByTestId("btn-iniciar")).toBeVisible({ timeout: 3000 });
    await page.getByTestId("btn-iniciar").click();
  } else {
    await direct.click();
  }
  await expect.poll(async () => (await getTournamentData(CODE)).status).toBe("playing");
}

test("Mundialito por sets: carga grupos completos y pasa a eliminatoria", async ({ page }) => {
  await seedTournament(CODE, setupTournament("mundialito", "sets3", 6, { groupCount: 2, advancePerGroup: 2 }));
  await startTournament(page);

  let data = await getTournamentData(CODE);
  expect(data.groups).toHaveLength(2);
  const totalMatches = data.groups.reduce((n, g) => n + g.matches.length, 0);
  expect(totalMatches).toBe(6);

  await expect(page.getByText("MEJOR DE 3").first()).toBeVisible({ timeout: 8000 });

  // Cargar todos los partidos: pareja A gana 6-4 / 6-3
  for (let i = 0; i < totalMatches; i++) {
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill("6");
    await inputs.nth(1).fill("4");
    await inputs.nth(2).fill("6");
    await inputs.nth(3).fill("3");
    await page.getByRole("button", { name: "Guardar resultado" }).first().click();
    await expect.poll(async () => {
      const d = await getTournamentData(CODE);
      return d.groups.reduce((n, g) => n + g.matches.filter((m) => m.saved).length, 0);
    }).toBe(i + 1);
  }

  data = await getTournamentData(CODE);
  for (const g of data.groups) {
    for (const m of g.matches) {
      expect(m.sets).toEqual([{ a: 6, b: 4 }, { a: 6, b: 3 }]);
      expect(m.scoreA).toBe("2");
      expect(m.scoreB).toBe("0");
    }
    const totalWins = g.standings.reduce((n, s) => n + s.wins, 0);
    expect(totalWins).toBe(g.matches.length);
    g.standings.forEach((s) => {
      expect(s.gamesFor - s.gamesAgainst).toBe(
        g.matches.reduce((acc, m) => {
          if (m.pairA.id === s.id) return acc + 5;
          if (m.pairB.id === s.id) return acc - 5;
          return acc;
        }, 0),
      );
    });
  }

  // El botón de eliminatoria debe estar activo y generar el cuadro
  const koBtn = page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i });
  await expect(koBtn).toBeVisible({ timeout: 5000 });
  await koBtn.click();
  // Al iniciar la eliminatoria se avisa de que los resultados de grupos se cierran
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");
  data = await getTournamentData(CODE);
  const qualifiers = new Set(
    data.knockoutBracket.flatMap((m) => [m.pairA?.id, m.pairB?.id]).filter((id) => id !== undefined && id !== null && id !== "bye"),
  );
  expect(qualifiers.size).toBe(4);
  // Los clasificados deben ser los 2 primeros por grupo (más victorias)
  const expected = new Set(
    data.groups.flatMap((g) =>
      [...g.standings]
        .sort((a, b) => b.wins - a.wins || (b.gf - b.gc) - (a.gf - a.gc) || (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst))
        .slice(0, 2)
        .map((s) => s.id),
    ),
  );
  expect(qualifiers).toEqual(expected);

  // Con la eliminatoria en marcha los resultados de grupos quedan cerrados
  await page.getByRole("button", { name: /Grupos/ }).click();
  await expect(page.getByText(/Resultados de grupos cerrados/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);

  // Sin partidos jugados en la eliminatoria se puede volver a la fase de grupos
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await page.getByRole("button", { name: /Volver a la fase de grupos/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Volver a grupos" }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("groups");
  data = await getTournamentData(CODE);
  expect(data.knockoutBracket ?? null).toBeNull();
});

test("Mundialito por sets: un 1-1 sin tercer set no se puede guardar", async ({ page }) => {
  await seedTournament(CODE, setupTournament("mundialito", "sets3", 4, { groupCount: 1, advancePerGroup: 2 }));
  await startTournament(page);
  await expect(page.getByText("MEJOR DE 3").first()).toBeVisible({ timeout: 8000 });

  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill("6");
  await inputs.nth(1).fill("4");
  await inputs.nth(2).fill("3");
  await inputs.nth(3).fill("6");
  await expect(page.getByRole("button", { name: "Guardar resultado" }).first()).toBeDisabled();

  await inputs.nth(4).fill("7");
  await inputs.nth(5).fill("5");
  await expect(page.getByRole("button", { name: "Guardar resultado" }).first()).toBeEnabled();
});

test("Mundialito por games (sin cambios): flujo original sigue funcionando", async ({ page }) => {
  await seedTournament(CODE, setupTournament("mundialito", null, 4, { groupCount: 1, advancePerGroup: 2 }));
  await startTournament(page);

  const total = (await getTournamentData(CODE)).groups[0].matches.length;
  expect(total).toBe(6);
  for (let i = 0; i < total; i++) {
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill("6");
    await inputs.nth(1).fill("2");
    await page.getByRole("button", { name: "Guardar resultado" }).first().click();
    await expect.poll(async () => (await getTournamentData(CODE)).groups[0].matches.filter((m) => m.saved).length).toBe(i + 1);
  }
  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(CODE)).phase).toBe("knockout");
});

test("Relámpago por sets: guarda sets, actualiza posiciones y revierte al editar", async ({ page }) => {
  await seedTournament(CODE, setupTournament("relampago", "sets3", 4));
  await startTournament(page);

  let data = await getTournamentData(CODE);
  const first = data.bracket.find((m) => m.bracket === "winners" && m.round === 1 && m.pairA && m.pairB && m.pairA.id !== "bye" && m.pairB.id !== "bye");
  expect(first).toBeTruthy();

  await page.getByText(`${first.pairA.p1} / ${first.pairA.p2}`).first().click();
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill("6");
  await inputs.nth(1).fill("4");
  await inputs.nth(2).fill("3");
  await inputs.nth(3).fill("6");
  // 1-1: todavía no se puede guardar
  await expect(page.getByRole("button", { name: /Guardar/ })).toHaveCount(0);
  await inputs.nth(4).fill("7");
  await inputs.nth(5).fill("5");
  await page.getByRole("button", { name: /Guardar/ }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((m) => m.id === first.id).saved).toBe(true);
  data = await getTournamentData(CODE);
  const saved = data.bracket.find((m) => m.id === first.id);
  expect(saved.scoreA).toBe("2");
  expect(saved.scoreB).toBe("1");
  expect(saved.sets).toEqual([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }]);
  const winner = data.pairs.find((p) => p.id === first.pairA.id);
  const loser = data.pairs.find((p) => p.id === first.pairB.id);
  expect(winner.pts).toBe(1);
  expect(winner.gf).toBe(2);
  expect(winner.gc).toBe(1);
  expect(winner.gamesFor).toBe(16);
  expect(winner.gamesAgainst).toBe(15);
  expect(loser.pts).toBe(0);
  expect(loser.gamesFor).toBe(15);

  await page.getByRole("button", { name: /Posiciones/i }).click();
  await expect(page.getByText("DS", { exact: true })).toBeVisible();

  // Editar → las estadísticas vuelven a cero
  await page.getByRole("button", { name: /Cuadro$/ }).first().click();
  await page.getByText("✏️ editar").first().click();
  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((m) => m.id === first.id).saved).toBe(false);
  data = await getTournamentData(CODE);
  const w2 = data.pairs.find((p) => p.id === first.pairA.id);
  expect(w2.pts).toBe(0);
  expect(w2.gf).toBe(0);
  expect(w2.gamesFor).toBe(0);
  expect(w2.played).toBe(0);
});

test("Mundialito por sets: rechaza sets inválidos con mensaje y deja guardar al corregir", async ({ page }) => {
  await seedTournament(CODE, setupTournament("mundialito", "sets3", 4, { groupCount: 1, advancePerGroup: 2 }));
  await startTournament(page);
  await expect(page.getByText("MEJOR DE 3").first()).toBeVisible({ timeout: 8000 });

  const inputs = page.locator('input[type="number"]');
  const save = page.getByRole("button", { name: "Guardar resultado" }).first();

  await inputs.nth(0).fill("6");
  await inputs.nth(1).fill("6");
  await expect(page.getByText(/no puede terminar empatado/i)).toBeVisible();
  await expect(save).toBeDisabled();

  await inputs.nth(1).fill("9");
  await expect(page.getByText(/Set inválido/i)).toBeVisible();

  await inputs.nth(0).fill("6");
  await inputs.nth(1).fill("4");
  await expect(page.getByText(/Set inválido|empatado/i)).toHaveCount(0);
  await inputs.nth(2).fill("6");
  await inputs.nth(3).fill("3");
  await expect(save).toBeEnabled();
});

test("Relámpago por sets: rechaza 5-3, acepta 7-6 y guarda", async ({ page }) => {
  await seedTournament(CODE, setupTournament("relampago", "sets3", 4));
  await startTournament(page);

  const data = await getTournamentData(CODE);
  const first = data.bracket.find((m) => m.bracket === "winners" && m.round === 1 && m.pairA && m.pairB && m.pairA.id !== "bye" && m.pairB.id !== "bye");

  await page.getByText(`${first.pairA.p1} / ${first.pairA.p2}`).first().click();
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill("5");
  await inputs.nth(1).fill("3");
  await expect(page.getByText(/Set inválido/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar/ })).toHaveCount(0);

  await inputs.nth(0).fill("7");
  await inputs.nth(1).fill("6");
  await expect(page.getByText(/Set inválido/i)).toHaveCount(0);
  await inputs.nth(2).fill("6");
  await inputs.nth(3).fill("2");
  await page.getByRole("button", { name: /Guardar/ }).click();

  await expect.poll(async () => (await getTournamentData(CODE)).bracket.find((m) => m.id === first.id).saved).toBe(true);
  const saved = (await getTournamentData(CODE)).bracket.find((m) => m.id === first.id);
  expect(saved.sets).toEqual([{ a: 7, b: 6 }, { a: 6, b: 2 }]);
});
