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

describe("jugadores repetidos entre parejas distintas", () => {
  it("T-PN-10: avisa del jugador nuevo que ya está en otra pareja, sin importar mayúsculas ni espacios", async () => {
    const { repeatedPlayersInNewPair } = await import("./pairNames");
    expect(repeatedPlayersInNewPair("  ana ", "Eva", pairs)).toEqual([{ name: "ana", pair: "Ana / Beto" }]);
    expect(repeatedPlayersInNewPair("Eva", "DARIO", pairs)).toEqual([{ name: "DARIO", pair: "Caro / Dario" }]);
  });

  it("T-PN-11: sin repetidos, a medio escribir o con la pareja completa repetida no avisa de jugadores", async () => {
    const { repeatedPlayersInNewPair } = await import("./pairNames");
    expect(repeatedPlayersInNewPair("Eva", "Fede", pairs)).toEqual([]);
    expect(repeatedPlayersInNewPair("Ana", "", pairs)).toEqual([{ name: "Ana", pair: "Ana / Beto" }]);
    expect(repeatedPlayersInNewPair("", "", pairs)).toEqual([]);
    // la pareja entera repetida ya tiene su propio aviso
    expect(repeatedPlayersInNewPair("Beto", "Ana", pairs)).toEqual([]);
  });

  it("T-PN-12: duplicatePlayerKeys marca el jugador que está en más de una pareja", async () => {
    const { duplicatePlayerKeys } = await import("./pairNames");
    const list = [...pairs, { p1: "ana", p2: "Eva" }];
    const keys = duplicatePlayerKeys(list);
    expect(keys.has("ana")).toBe(true);
    expect(keys.has("beto")).toBe(false);
    expect(keys.has("eva")).toBe(false);
  });

  it("T-PN-13: un nombre escrito dos veces dentro de la misma pareja no cuenta como repetido entre parejas", async () => {
    const { duplicatePlayerKeys } = await import("./pairNames");
    expect(duplicatePlayerKeys([{ p1: "Ana", p2: "ana" }]).size).toBe(0);
  });
});
