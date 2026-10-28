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

describe("reglas escritas de la Liga", () => {
  const liga = (config) => generateRules("liga", { courts: 2, ...config }, { pairCount: 8 }).join(" ");

  it("T-RUL-05: declara punto de oro o ventaja", () => {
    expect(liga({ goldenPoint: true })).toContain("punto de oro");
    expect(liga({ goldenPoint: false })).toContain("ventaja");
  });

  it("T-RUL-06: al mejor de 3 sets explica cómo se anota el tie-break", () => {
    expect(liga({ scoringFormat: "sets3" })).toContain("tie-break");
    expect(liga({ scoringFormat: "sets3" })).toContain("7-6");
  });

  it("T-RUL-07: por games no habla de tie-break", () => {
    expect(liga({ scoringFormat: "games", scoringSystem: "games" })).not.toContain("tie-break");
  });
});

describe("reglas escritas: cómo se clasifica el Americano", () => {
  it("T-RUL-08: dice que la tabla ordena por partidos ganados y luego por diferencia, no por games sumados", () => {
    const text = americano({ scoringSystem: "timed", timedMetric: "games" });
    expect(text).toContain("partidos ganados");
    expect(text).toContain("diferencia de juegos");
    expect(text).not.toContain("Se cuentan");
  });

  it("T-RUL-09: con puntos acumulados habla de diferencia de puntos", () => {
    expect(americano({ scoringSystem: "timed", timedMetric: "points" })).toContain("diferencia de puntos");
  });

  it("T-RUL-10: en modo manual ya no dice que gana quien acumule más juegos", () => {
    const text = americano({ matchmaking: "manual", scoringSystem: "timed", timedMetric: "games" });
    expect(text).not.toContain("acumule más");
    expect(text).toContain("partidos ganados");
  });
});
