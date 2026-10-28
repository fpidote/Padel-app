import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CrossingsProjection from "./CrossingsProjection";

const st = (id, played) => ({ id, p1: `P${id}`, p2: "x", pts: 0, wins: 0, played, gf: 0, gc: 0 });
const groups = (n, played) =>
  "ABCDEFGH".slice(0, n).split("").map((l, i) => ({
    id: i, name: `Grupo ${l}`, matches: [], standings: [st(`${l}1`, played), st(`${l}2`, played), st(`${l}3`, played)],
  }));

describe("CrossingsProjection", () => {
  it("T-PRJ-UI-1: con 4 grupos clásicos muestra los 4 cruces sin repetir ningún grupo y desde el principio", () => {
    const html = renderToStaticMarkup(<CrossingsProjection groups={groups(4, 0)} config={{ groupCount: 4, advancePerGroup: 2 }} />);
    for (const cruce of ["1º Grupo A", "2º Grupo B", "1º Grupo C", "2º Grupo D", "1º Grupo B", "2º Grupo A", "1º Grupo D", "2º Grupo C"]) {
      expect(html).toContain(cruce);
    }
    expect(html.match(/VS/g)).toHaveLength(4);
  });

  it("T-PRJ-UI-2: por rendimiento sin partidos jugados explica la regla y no inventa cruces", () => {
    const html = renderToStaticMarkup(<CrossingsProjection groups={groups(3, 0)} config={{ groupCount: 3, advancePerGroup: 2 }} />);
    expect(html).toContain("mejor clasificado contra el peor");
    expect(html).not.toContain("VS");
    expect(html).not.toContain("Provisional");
  });

  it("T-PRJ-UI-3: por rendimiento con partidos jugados muestra la proyección provisional con parejas reales", () => {
    const html = renderToStaticMarkup(<CrossingsProjection groups={groups(3, 1)} config={{ groupCount: 3, advancePerGroup: 2 }} />);
    expect(html).toContain("Provisional");
    expect(html).toContain("VS");
    expect(html).toMatch(/PA1|PB1|PC1/);
  });

  it("T-PRJ-UI-4: el organizador eligió rendimiento aunque el clásico aplique: no muestra el clásico", () => {
    const html = renderToStaticMarkup(<CrossingsProjection groups={groups(2, 0)} config={{ groupCount: 2, advancePerGroup: 2, crossing: "performance" }} />);
    expect(html).toContain("mejor clasificado contra el peor");
    expect(html).not.toContain("1º Grupo A");
  });

  it("T-PRJ-UI-5: con mejores terceros indica quiénes pasan", () => {
    const html = renderToStaticMarkup(<CrossingsProjection groups={groups(3, 0)} config={{ groupCount: 3, advancePerGroup: 2, extraQualifiers: 2 }} />);
    expect(html).toContain("mejores terceros");
  });
});
