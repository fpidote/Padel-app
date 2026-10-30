import { describe, test, expect } from "vitest";
import { matchScoreState, isSetsFormat } from "./matchScore.js";

describe("isSetsFormat", () => {
  test("T-MS-1: solo sets3 y sets5 son por sets", () => {
    expect(isSetsFormat("sets3")).toBe(true);
    expect(isSetsFormat("sets5")).toBe(true);
    expect(isSetsFormat("games")).toBe(false);
    expect(isSetsFormat(undefined)).toBe(false);
  });
});

describe("matchScoreState por games", () => {
  test("T-MS-2: marcador válido se puede guardar y devuelve los games", () => {
    const s = matchScoreState("games", { gamesA: "6", gamesB: "4" });
    expect(s).toMatchObject({ bySets: false, isValid: true, scoreA: 6, scoreB: 4, gamesError: null });
  });

  test("T-MS-3: falta un lado: no es válido y no hay error", () => {
    const s = matchScoreState("games", { gamesA: "6", gamesB: "" });
    expect(s.isValid).toBe(false);
    expect(s.gamesError).toBeNull();
  });

  test("T-MS-4: empate, decimales y fuera de rango dan error y no se guardan", () => {
    expect(matchScoreState("games", { gamesA: "5", gamesB: "5" })).toMatchObject({ isValid: false, gamesError: expect.any(String) });
    expect(matchScoreState("games", { gamesA: "6.5", gamesB: "4" }).isValid).toBe(false);
    expect(matchScoreState("games", { gamesA: "100", gamesB: "4" }).isValid).toBe(false);
  });

  test("T-MS-5: sin argumentos no es válido", () => {
    expect(matchScoreState("games").isValid).toBe(false);
  });
});

describe("matchScoreState por sets", () => {
  const rows = (...pairs) => pairs.map(([a, b]) => ({ a: String(a), b: String(b) }));

  test("T-MS-6: mejor de 3 terminado 2-0 es válido y muestra solo los sets jugados", () => {
    const s = matchScoreState("sets3", { setRows: rows([6, 4], [6, 2]) });
    expect(s).toMatchObject({ bySets: true, maxSets: 3, setsNeeded: 2, isValid: true, scoreA: 2, scoreB: 0, visibleSetRows: 2 });
  });

  test("T-MS-7: 1-1 pide un tercer set", () => {
    const s = matchScoreState("sets3", { setRows: rows([6, 4], [3, 6]) });
    expect(s).toMatchObject({ isValid: false, visibleSetRows: 3 });
  });

  test("T-MS-8: sin nada escrito muestra una fila", () => {
    expect(matchScoreState("sets3", {}).visibleSetRows).toBe(1);
  });

  test("T-MS-9: un set inválido marca el error y bloquea el guardado", () => {
    const s = matchScoreState("sets3", { setRows: rows([6, 5]) });
    expect(s.isValid).toBe(false);
    expect(s.live.errorIndex).toBe(0);
  });

  test("T-MS-10: mejor de 5 necesita 3 sets ganados", () => {
    const s = matchScoreState("sets5", { setRows: rows([6, 4], [6, 4], [6, 4]) });
    expect(s).toMatchObject({ maxSets: 5, setsNeeded: 3, isValid: true, scoreA: 3, scoreB: 0, visibleSetRows: 3 });
    expect(matchScoreState("sets5", { setRows: rows([6, 4], [6, 4]) }).isValid).toBe(false);
  });

  test("T-MS-11: por sets los games escritos se ignoran", () => {
    const s = matchScoreState("sets3", { gamesA: "6", gamesB: "4" });
    expect(s.gamesError).toBeNull();
    expect(s.isValid).toBe(false);
  });
});
