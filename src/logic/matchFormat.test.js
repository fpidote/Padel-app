import { describe, it, expect } from "vitest";
import { MATCH_FORMATS, availableMatchFormats, matchFormatOf, matchFormatPatch, matchFormatSummary } from "./matchFormat";

describe("matchFormatSummary", () => {
  it("por tiempo muestra minutos y qué cuenta (con los valores por defecto)", () => {
    expect(matchFormatSummary({})).toEqual({ label: "Por tiempo", detail: "10 min · Games ganados" });
    expect(matchFormatSummary({ matchMinutes: 15, timedMetric: "points" })).toEqual({ label: "Por tiempo", detail: "15 min · Puntos acumulados" });
  });
  it("por puntos muestra los puntos por partido", () => {
    expect(matchFormatSummary({ scoringSystem: "rally" })).toEqual({ label: "Por puntos", detail: "24 puntos por partido" });
    expect(matchFormatSummary({ scoringSystem: "rally", rallyPoints: 32 }).detail).toBe("32 puntos por partido");
  });
  it("por games muestra los games para ganar", () => {
    expect(matchFormatSummary({ scoringSystem: "games" })).toEqual({ label: "Por games", detail: "6 games para ganar" });
    expect(matchFormatSummary({ scoringSystem: "games", targetGames: 8 }).detail).toBe("8 games para ganar");
  });
  it("en sets muestra el formato y que se anota set por set", () => {
    expect(matchFormatSummary({ scoringFormat: "sets3" })).toEqual({ label: "Mejor de 3 sets", detail: "Se anota set por set" });
    expect(matchFormatSummary({ scoringFormat: "sets5" }).label).toBe("Mejor de 5 sets");
  });
});

describe("availableMatchFormats", () => {
  it("sin sets ofrece tiempo, puntos y games", () => {
    expect(availableMatchFormats(false).map((f) => f.id)).toEqual(["timed", "points", "games"]);
  });
  it("con sets suma mejor de 3 y mejor de 5", () => {
    expect(availableMatchFormats(true).map((f) => f.id)).toEqual(["timed", "points", "games", "sets3", "sets5"]);
  });
  it("cada formato trae nombre y descripción", () => {
    MATCH_FORMATS.forEach((f) => {
      expect(f.name).toBeTruthy();
      expect(f.desc).toBeTruthy();
    });
  });
});

describe("matchFormatOf", () => {
  it("por defecto es por tiempo", () => {
    expect(matchFormatOf({})).toBe("timed");
    expect(matchFormatOf(undefined)).toBe("timed");
  });
  it("traduce el scoringSystem guardado", () => {
    expect(matchFormatOf({ scoringSystem: "timed" })).toBe("timed");
    expect(matchFormatOf({ scoringSystem: "rally" })).toBe("points");
    expect(matchFormatOf({ scoringSystem: "games" })).toBe("games");
  });
  it("los sets mandan sobre el scoringSystem", () => {
    expect(matchFormatOf({ scoringFormat: "sets3", scoringSystem: "rally" })).toBe("sets3");
    expect(matchFormatOf({ scoringFormat: "sets5" })).toBe("sets5");
  });
  it("scoringFormat games no cambia nada", () => {
    expect(matchFormatOf({ scoringFormat: "games", scoringSystem: "rally" })).toBe("points");
  });
});

describe("matchFormatPatch", () => {
  it("por tiempo guarda formato games y sistema timed", () => {
    expect(matchFormatPatch("timed")).toEqual({ scoringFormat: "games", scoringSystem: "timed" });
  });
  it("por puntos guarda el id interno rally (no se migran los torneos existentes)", () => {
    expect(matchFormatPatch("points")).toEqual({ scoringFormat: "games", scoringSystem: "rally" });
  });
  it("por games guarda formato games y sistema games", () => {
    expect(matchFormatPatch("games")).toEqual({ scoringFormat: "games", scoringSystem: "games" });
  });
  it("los sets solo cambian el formato y conservan el sistema anterior", () => {
    expect(matchFormatPatch("sets3")).toEqual({ scoringFormat: "sets3" });
    expect(matchFormatPatch("sets5")).toEqual({ scoringFormat: "sets5" });
  });
  it("sin includeFormat (Americano) no agrega scoringFormat", () => {
    expect(matchFormatPatch("points", { includeFormat: false })).toEqual({ scoringSystem: "rally" });
    expect(matchFormatPatch("timed", { includeFormat: false })).toEqual({ scoringSystem: "timed" });
  });
  it("ida y vuelta: elegir una opción y leerla devuelve la misma opción", () => {
    MATCH_FORMATS.forEach((f) => {
      expect(matchFormatOf({ ...matchFormatPatch(f.id) })).toBe(f.id);
    });
  });
  it("un id desconocido no inventa configuración", () => {
    expect(matchFormatPatch("otro")).toEqual({});
  });
});
