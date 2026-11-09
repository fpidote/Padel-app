/**
 * Setup de parejas (Liga, Relámpago, Torneo por grupos): un cambio hecho justo después de escribir un
 * campo con guardado retrasado (ubicación, descripción, nombre) no se deshace.
 */
import { test, expect } from "@playwright/test";
import { seedTournament, deleteTournament, getTournamentData, getTestToken } from "../helpers/seed.js";

const CODE = "PARCSEG1";
const pair = (id, p1, p2) => ({ id, p1, p2, pts: 0, gf: 0, gc: 0, gamesFor: 0, gamesAgainst: 0, played: 0, wins: 0 });

test.afterEach(async () => {
  await deleteTournament(CODE).catch(() => {});
});

for (const [campo, placeholder, clave] of [
  ["ubicación", "Club, dirección...", "location"],
  ["descripción", "Reglas especiales, mensaje a los jugadores...", "description"],
]) {
  test(`agregar una pareja justo después de escribir la ${campo} no deshace ninguna de las dos`, async ({ page }) => {
    await seedTournament(CODE, {
      type: "liga", status: "setup", phase: "setup",
      config: { name: "Seguidos", courts: 2, scoringFormat: "games", idaYVuelta: false, playoffEnabled: false },
      pairInputs: [pair(0, "Ana", "Beto"), pair(1, "Caro", "Dario")], playerInputs: [],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/torneo/${CODE}`);
    await page.evaluate(async (t) => { await window.__e2eSignIn(t); }, await getTestToken());
    await page.getByPlaceholder(placeholder).fill("Club Sur");
    await page.getByPlaceholder("Jugador 1").fill("Eva");
    await page.getByPlaceholder("Jugador 2").fill("Fran");
    await page.getByRole("button", { name: /Agregar pareja/ }).click();
    await page.waitForTimeout(2000);
    const d = await getTournamentData(CODE);
    expect(d.pairInputs).toHaveLength(3);
    expect(d.config[clave]).toBe("Club Sur");
  });
}
