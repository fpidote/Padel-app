import { describe, it, expect } from "vitest";
import { validateSet, analyzeSets, validateGamesScore } from "./sets";

describe("validateSet", () => {
  it.each([[6, 0], [6, 4], [4, 6], [7, 5], [5, 7], [7, 6], [6, 7]])("acepta %i-%i", (a, b) => {
    expect(validateSet(a, b)).toBeNull();
  });
  it.each([[6, 6], [0, 0], [9, 1], [5, 3], [6, 5], [8, 6], [7, 4], [-1, 6]])("rechaza %i-%i", (a, b) => {
    expect(validateSet(a, b)).toEqual(expect.any(String));
  });
});

const row = (a, b) => ({ a: String(a), b: String(b) });

describe("analyzeSets", () => {
  it("2-0 termina el partido a mejor de 3", () => {
    const r = analyzeSets([row(6, 4), row(6, 3)], 2);
    expect(r).toMatchObject({ setsA: 2, setsB: 0, finished: true, error: null });
    expect(r.sets).toEqual([{ a: 6, b: 4 }, { a: 6, b: 3 }]);
  });
  it("1-1 queda pendiente (no terminado, sin error)", () => {
    const r = analyzeSets([row(6, 4), row(3, 6)], 2);
    expect(r).toMatchObject({ setsA: 1, setsB: 1, finished: false, error: null });
  });
  it("fila a medias no genera error", () => {
    const r = analyzeSets([row(6, 4), { a: "6", b: "" }], 2);
    expect(r).toMatchObject({ finished: false, error: null });
    expect(r.sets).toHaveLength(1);
  });
  it("set inválido devuelve error con su índice y no cuenta", () => {
    const r = analyzeSets([row(6, 4), row(6, 6)], 2);
    expect(r.finished).toBe(false);
    expect(r.errorIndex).toBe(1);
    expect(r.error).toEqual(expect.any(String));
  });
  it("fila 2 completa con fila 1 vacía no termina", () => {
    const r = analyzeSets([{ a: "", b: "" }, row(6, 0)], 2);
    expect(r).toMatchObject({ finished: false, error: null });
    expect(r.sets).toHaveLength(0);
  });
  it("ignora filas posteriores a que el partido ya terminó", () => {
    const r = analyzeSets([row(6, 0), row(6, 0), row(1, 6)], 2);
    expect(r.sets).toHaveLength(2);
    expect(r.finished).toBe(true);
  });
});

describe("validateGamesScore", () => {
  it("sin nada escrito o con un solo lado no hay mensaje (todavía está escribiendo)", () => {
    expect(validateGamesScore("", "")).toBeNull();
    expect(validateGamesScore("6", "")).toBeNull();
    expect(validateGamesScore("", "4")).toBeNull();
  });

  it("un marcador normal es válido", () => {
    expect(validateGamesScore("6", "4")).toBeNull();
    expect(validateGamesScore("0", "1")).toBeNull();
    expect(validateGamesScore("99", "0")).toBeNull();
  });

  it("explica el empate, incluido 0-0", () => {
    expect(validateGamesScore("6", "6")).toBe("Un partido no puede terminar empatado");
    expect(validateGamesScore("0", "0")).toBe("Un partido no puede terminar empatado");
  });

  it("rechaza decimales y negativos, que parseInt dejaba pasar o recortaba", () => {
    expect(validateGamesScore("2.5", "1")).toBe("Usa números enteros, sin decimales ni negativos");
    expect(validateGamesScore("-1", "3")).toBe("Usa números enteros, sin decimales ni negativos");
    expect(validateGamesScore("3", "1e2")).toBe("Usa números enteros, sin decimales ni negativos");
  });

  it("rechaza marcadores absurdos (más de 99)", () => {
    expect(validateGamesScore("999", "2")).toBe("El máximo es 99");
    expect(validateGamesScore("3", "100")).toBe("El máximo es 99");
  });
});
