import { describe, it, expect } from "vitest";
import { generateRules } from "./constants";

const americano = (config) => generateRules("americano", { courts: 2, matchmaking: "americano", mode: "individual", ...config }).join(" ");

describe("reglas escritas: punto de oro y ventaja", () => {
  it("T-RUL-01: con punto de oro explica el 40-40, no habla de empates", () => {
    const text = americano({ goldenPoint: true });
    expect(text).toContain("40-40");
    expect(text).toContain("punto de oro");
  });

  it("T-RUL-02: sin punto de oro dice que se juega con ventaja y no que los empates puntúan", () => {
    const text = americano({ goldenPoint: false });
    expect(text).toContain("40-40");
    expect(text).toContain("ventaja");
    expect(text).not.toContain("empates cuentan");
  });
});

describe("reglas escritas: empate al terminar el tiempo (Americano)", () => {
  it("T-RUL-03: por tiempo avisa cómo se decide un empate en el marcador", () => {
    const text = americano({ scoringSystem: "timed", matchMinutes: 10 });
    expect(text).toContain("igualados");
    expect(text).toContain("cerrando el game");
  });

  it("T-RUL-04: por games, por puntos o por sets no hay empate posible y no se menciona", () => {
    expect(americano({ scoringSystem: "games", targetGames: 6 })).not.toContain("igualados");
    expect(americano({ scoringSystem: "rally", rallyPoints: 24 })).not.toContain("igualados");
    expect(americano({ scoringFormat: "sets3" })).not.toContain("igualados");
  });
});
