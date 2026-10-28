import { describe, it, expect } from "vitest";
import { isDuplicatePair, duplicatePairKeys, pairKey } from "./pairNames";

const pairs = [{ p1: "Ana", p2: "Beto" }, { p1: "Caro", p2: "Dario" }];

describe("pareja repetida", () => {
  it("la misma pareja en el mismo orden es repetida", () => {
    expect(isDuplicatePair("Ana", "Beto", pairs)).toBe(true);
  });

  it("también con los jugadores intercambiados, sin importar mayúsculas ni espacios", () => {
    expect(isDuplicatePair("  beto ", "ANA", pairs)).toBe(true);
  });

  it("una pareja distinta o a medio escribir no lo es", () => {
    expect(isDuplicatePair("Ana", "Caro", pairs)).toBe(false);
    expect(isDuplicatePair("Ana", "", pairs)).toBe(false);
    expect(isDuplicatePair("", "", pairs)).toBe(false);
  });

  it("pairKey no depende del orden", () => {
    expect(pairKey("Ana", "Beto")).toBe(pairKey("beto", "ana"));
  });

  it("duplicatePairKeys marca las parejas que aparecen más de una vez", () => {
    const list = [...pairs, { p1: "dario", p2: "CARO" }];
    const keys = duplicatePairKeys(list);
    expect(keys.has(pairKey("Caro", "Dario"))).toBe(true);
    expect(keys.has(pairKey("Ana", "Beto"))).toBe(false);
  });
});
