/**
 * Recorrido completo del Torneo por grupos como lo haría un organizador, solo por la interfaz y sin
 * sembrar datos: crear desde la pantalla de inicio, cargar parejas, elegir formato y cruces, lanzar,
 * jugar los grupos y la fase final, finalizar y ver el podio.
 */
import { test, expect } from "@playwright/test";
import { deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

test.setTimeout(120_000);

let code = null;

test.afterEach(async () => {
  if (code) await deleteTournament(code).catch(() => {});
  code = null;
});

const NOMBRES = ["Ana", "Beto", "Caro", "Dario", "Eva", "Fede", "Gus", "Hugo", "Iris", "Juan", "Kali", "Leo", "Mia", "Nico", "Olga", "Pablo"];

test("crear, configurar, jugar grupos y fase final, finalizar y ver el podio", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Crear el torneo desde la pantalla de inicio
  await page.goto("/");
  await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
  await page.getByRole("button", { name: /Crear torneo gratis/ }).first().click();
  await page.getByRole("button", { name: /Torneo por grupos/ }).click();
  await expect(page).toHaveURL(/\/torneo\//);
  code = page.url().split("/torneo/")[1];

  // El nombre por defecto no repite la palabra "Torneo"
  await expect(page.getByTestId("input-tournament-name")).toHaveValue("Torneo por grupos");

  // 2. Cargar 8 parejas por la interfaz
  await expect(page.getByText("Formato de grupos")).toBeVisible({ timeout: 8000 });
  for (let i = 0; i < 8; i++) {
    await page.getByPlaceholder("Jugador 1").fill(NOMBRES[i * 2]);
    await page.getByPlaceholder("Jugador 2").fill(NOMBRES[i * 2 + 1]);
    await page.getByRole("button", { name: "+ Agregar pareja" }).click();
  }
  await expect.poll(async () => (await getTournamentData(code)).pairInputs.length).toBe(8);

  // 3. Elegir 2 grupos de 4 pasando 2: el cruce clásico viene por defecto y se activa el 3.º puesto
  await page.getByRole("button", { name: /2 grupos de 4 · pasan 2 de cada grupo/ }).click();
  await expect.poll(async () => (await getTournamentData(code)).config.advancePerGroup).toBe(2);
  await expect(page.getByRole("button", { name: /Clásico por grupos/ })).toContainText("⭐");
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(code)).config.thirdPlace).toBe(true);
  await page.screenshot({ path: "test-results/completo-1-config-390.png", fullPage: true });

  // 4. Revisar y lanzar
  await page.getByTestId("btn-open-modal").click();
  await page.getByRole("button", { name: /Resumen/ }).click();
  await expect(page.getByText("Clásico por grupos (1º A vs 2º B)")).toBeVisible();
  await page.getByTestId("btn-iniciar").click();
  await expect.poll(async () => (await getTournamentData(code)).status).toBe("playing");

  // 5. Antes de jugar ya se ven los cruces exactos de la fase final
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  await expect(page.getByText("1º Grupo A")).toBeVisible();
  const filas = page.locator("div.rounded-lg", { has: page.getByText("VS", { exact: true }) });
  expect((await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, " "))).toEqual([
    "1º Grupo A VS 2º Grupo B",
    "1º Grupo B VS 2º Grupo A",
  ]);
  await page.getByRole("button", { name: /Grupos/ }).first().click();

  // 6. Jugar los 12 partidos de grupo
  const guardados = async () => (await getTournamentData(code)).groups.reduce((n, g) => n + g.matches.filter((m) => m.saved).length, 0);
  const total = (await getTournamentData(code)).groups.reduce((n, g) => n + g.matches.length, 0);
  expect(total).toBe(12);
  for (let i = 0; i < total; i++) {
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill("6");
    await inputs.nth(1).fill(String(i % 5));
    await page.getByRole("button", { name: "Guardar resultado" }).first().click();
    await expect.poll(guardados).toBe(i + 1);
  }

  // 7. Iniciar la fase final: el cuadro respeta el cruce clásico (A1-B2 y B1-A2)
  await page.getByRole("button", { name: /Iniciar Fase Eliminatoria/i }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(code)).phase).toBe("knockout");
  let d = await getTournamentData(code);
  const rank = (g) => [...g.standings].sort((a, b) => b.wins - a.wins || (b.gf - b.gc) - (a.gf - a.gc)).map((s) => s.id);
  const lugar = {};
  d.groups.forEach((g, gi) => rank(g).slice(0, 2).forEach((id, pos) => { lugar[id] = `${"AB"[gi]}${pos + 1}`; }));
  const semis = d.knockoutBracket.filter((m) => m.bracket === "winners" && m.round === 1).sort((a, b) => a.matchIndex - b.matchIndex);
  expect(semis.map((m) => `${lugar[m.pairA.id]}-${lugar[m.pairB.id]}`)).toEqual(["A1-B2", "B1-A2"]);
  expect(d.knockoutBracket.some((m) => m.bracket === "third")).toBe(true);

  // 8. Jugar la fase final por la interfaz: semifinales, final y 3.º puesto (gana siempre la pareja A)
  await page.getByRole("button", { name: /Eliminatoria/ }).click();
  const jugados = async () => (await getTournamentData(code)).knockoutBracket.filter((m) => m.saved).length;
  for (let n = 1; n <= 4; n++) {
    const boton = page.getByRole("button", { name: "Guardar resultado" }).first();
    await expect(boton).toBeVisible({ timeout: 8000 });
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill("6");
    await inputs.nth(1).fill("3");
    await boton.click();
    await expect.poll(jugados).toBe(n);
  }

  // 9. Finalizar el torneo
  await page.getByRole("button", { name: /Finalizar torneo/ }).click();
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect.poll(async () => (await getTournamentData(code)).status).toBe("finished");
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);

  // 10. El podio refleja la fase final
  await page.getByRole("button", { name: /Posiciones/ }).click();
  d = await getTournamentData(code);
  const final = d.knockoutBracket.find((m) => !m.nextMatchId && m.bracket !== "third");
  const tercero = d.knockoutBracket.find((m) => m.bracket === "third");
  const podio = page.locator("div.rounded-xl", { has: page.getByText("🏁 Torneo finalizado") }).first();
  await expect(podio).toContainText(`${final.winner.p1} / ${final.winner.p2}`);
  await expect(podio).toContainText(`${final.loser.p1} / ${final.loser.p2}`);
  await expect(podio).toContainText(`${tercero.winner.p1} / ${tercero.winner.p2}`);
  await expect(page.getByText("🏆 Grupo A")).toBeVisible();
  await expect(page.getByText("🏆 Grupo B")).toBeVisible();
  await page.screenshot({ path: "test-results/completo-2-posiciones-390.png", fullPage: true });
});
