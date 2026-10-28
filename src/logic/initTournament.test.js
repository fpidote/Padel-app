import { describe, it, expect } from "vitest";
import { buildInitialTournament } from "./initTournament";
import { TOURNAMENT_TYPES } from "./constants";

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
