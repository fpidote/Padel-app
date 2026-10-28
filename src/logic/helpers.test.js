import { describe, it, expect } from "vitest";
import { normalizeEmail, isValidEmail, validateNewHelper, MAX_HELPERS } from "./helpers";

describe("normalizeEmail", () => {
  it("T-HLP-01: quita espacios y pasa a minúsculas", () => {
    expect(normalizeEmail("  Ana@Gmail.COM ")).toBe("ana@gmail.com");
  });

  it("T-HLP-02: no normaliza puntos ni alias (coincidencia exacta)", () => {
    expect(normalizeEmail("a.na+x@gmail.com")).toBe("a.na+x@gmail.com");
  });

  it("T-HLP-03: tolera valores vacíos o no texto", () => {
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("T-HLP-04: acepta formas normales y rechaza lo que no es un correo", () => {
    expect(isValidEmail("ana@gmail.com")).toBe(true);
    expect(isValidEmail("ana")).toBe(false);
    expect(isValidEmail("ana@")).toBe(false);
    expect(isValidEmail("@gmail.com")).toBe(false);
    expect(isValidEmail("ana@gmail")).toBe(false);
    expect(isValidEmail("ana @gmail.com")).toBe(false);
  });
});

describe("validateNewHelper", () => {
  it("T-HLP-05: acepta un correo nuevo con la lista vacía", () => {
    expect(validateNewHelper("ana@gmail.com", [])).toBeNull();
  });

  it("T-HLP-06: rechaza un correo inválido", () => {
    expect(validateNewHelper("ana", [])).toBe("Escribe un correo válido");
  });

  it("T-HLP-07: rechaza un repetido sin importar mayúsculas ni espacios", () => {
    expect(validateNewHelper("  ANA@gmail.com ", ["ana@gmail.com"])).toBe("Ese correo ya es ayudante");
  });

  it("T-HLP-08: rechaza el sexto ayudante", () => {
    const cinco = Array.from({ length: MAX_HELPERS }, (_, i) => `h${i}@gmail.com`);
    expect(MAX_HELPERS).toBe(5);
    expect(validateNewHelper("nuevo@gmail.com", cinco)).toBe("Máximo 5 ayudantes por torneo");
  });
});

describe("tournamentOwnerUid", () => {
  it("T-HLP-20: manda el campo de primer nivel del documento sobre el ownerUid de data", async () => {
    const { tournamentOwnerUid } = await import("./helpers");
    expect(tournamentOwnerUid("dueno", { ownerUid: "ayudante" })).toBe("dueno");
  });

  it("T-HLP-21: si el documento no trae ownerUid de primer nivel usa el de data", async () => {
    const { tournamentOwnerUid } = await import("./helpers");
    expect(tournamentOwnerUid(undefined, { ownerUid: "dueno" })).toBe("dueno");
  });
});

describe("helperAllows", () => {
  it("T-HLP-30: el dueño y quien no es ayudante siempre pueden", async () => {
    const { helperAllows } = await import("./helpers");
    expect(helperAllows(false, {}, "levels")).toBe(true);
    expect(helperAllows(false, { helperPerms: { levels: false } }, "rename")).toBe(true);
  });

  it("T-HLP-31: el ayudante no puede salvo que el dueño lo active (torneos antiguos: no)", async () => {
    const { helperAllows } = await import("./helpers");
    expect(helperAllows(true, {}, "levels")).toBe(false);
    expect(helperAllows(true, { helperPerms: {} }, "rename")).toBe(false);
    expect(helperAllows(true, { helperPerms: { levels: true } }, "levels")).toBe(true);
    expect(helperAllows(true, { helperPerms: { levels: true } }, "rename")).toBe(false);
  });
});
