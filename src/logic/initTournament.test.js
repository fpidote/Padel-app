import { describe, it, expect } from "vitest";
import { buildInitialTournament } from "./initTournament";
import { TOURNAMENT_TYPES, CREATABLE_TYPES } from "./constants";

describe("nombre por defecto del torneo", () => {
  it("T-INI-01: el Torneo por grupos no repite la palabra Torneo", () => {
    expect(buildInitialTournament("mundialito", "uid").config.name).toBe("Torneo por grupos");
  });

  it("T-INI-02: ningún formato repite la palabra Torneo", () => {
    for (const { id } of TOURNAMENT_TYPES) {
      expect(buildInitialTournament(id, "uid").config.name).not.toMatch(/Torneo\s+Torneo/i);
    }
  });

  it("T-INI-03: los demás formatos conservan su nombre de siempre", () => {
    expect(buildInitialTournament("americano", "uid").config.name).toBe("Torneo Americano");
    expect(buildInitialTournament("relampago", "uid").config.name).toBe("Torneo Relámpago");
  });
});

describe("formatos que se pueden crear", () => {
  it("T-INI-03: el Pozo no se ofrece al crear, pero sigue en el catálogo para abrir los ya creados", () => {
    expect(CREATABLE_TYPES.map((t) => t.id)).not.toContain("pozo");
    expect(TOURNAMENT_TYPES.map((t) => t.id)).toContain("pozo");
  });

  it("T-INI-04: el resto de formatos sigue disponible", () => {
    expect(CREATABLE_TYPES.map((t) => t.id)).toEqual(["americano", "relampago", "mundialito", "liga"]);
  });
});

describe("pistas por defecto", () => {
  it("T-INI-05: el Americano arranca con 2 pistas (8 jugadores), no con 3 (12 jugadores)", () => {
    expect(buildInitialTournament("americano", "uid").config.courts).toBe(2);
  });
});
