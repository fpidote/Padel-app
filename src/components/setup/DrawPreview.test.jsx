import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupsPreview, FixturePreview, BracketPreview } from "./DrawPreview";
import { buildBracket } from "../../logic/relampago";

const pair = (id) => ({ id, p1: `Ana${id}`, p2: `Eva${id}` });

describe("GroupsPreview", () => {
  const groups = [
    { id: 0, name: "Grupo A", pairs: [pair(0), pair(1), pair(2)], matches: [{}, {}, {}] },
    { id: 1, name: "Grupo B", pairs: [pair(3), pair(4)], matches: [{}] },
  ];

  it("muestra cada grupo con sus parejas y cuántos partidos tiene", () => {
    const html = renderToStaticMarkup(<GroupsPreview groups={groups} advancePerGroup={2} />);
    expect(html).toContain("Grupo A");
    expect(html).toContain("Grupo B");
    expect(html).toContain("Ana0 / Eva0");
    expect(html).toContain("Ana4 / Eva4");
    expect(html).toContain("3 partidos");
    expect(html).toContain("1 partido");
    expect(html).not.toContain("1 partidos");
  });

  it("explica cuántas parejas avanzan por grupo", () => {
    const html = renderToStaticMarkup(<GroupsPreview groups={groups} advancePerGroup={2} />);
    expect(html).toContain("avanzan 2");
    expect(renderToStaticMarkup(<GroupsPreview groups={groups} advancePerGroup={1} />)).toContain("avanza 1");
  });

  it("avisa si un grupo queda con menos de 2 parejas", () => {
    const bad = [...groups, { id: 2, name: "Grupo C", pairs: [pair(5)], matches: [] }];
    expect(renderToStaticMarkup(<GroupsPreview groups={bad} advancePerGroup={2} />)).toContain("Grupo C");
    expect(renderToStaticMarkup(<GroupsPreview groups={bad} advancePerGroup={2} />)).toContain("menos de 2 parejas");
  });
});

describe("FixturePreview", () => {
  const rounds = [{ round: 1, date: null }, { round: 2, date: null }];
  const matches = [
    { id: "r1_m0", round: 1, pairA: pair(0), pairB: pair(1) },
    { id: "r1_m1", round: 1, pairA: pair(2), pairB: pair(3) },
    { id: "r2_m0", round: 2, pairA: pair(0), pairB: pair(2) },
  ];

  it("agrupa los partidos por jornada", () => {
    const html = renderToStaticMarkup(<FixturePreview rounds={rounds} matches={matches} />);
    expect(html).toContain("Jornada 1");
    expect(html).toContain("Jornada 2");
    expect(html.indexOf("Ana0 / Eva0")).toBeLessThan(html.indexOf("Jornada 2"));
    expect(html).toContain("Ana2 / Eva2");
  });

  it("muestra el enfrentamiento de cada partido", () => {
    const html = renderToStaticMarkup(<FixturePreview rounds={rounds} matches={matches} />);
    expect(html).toContain("Ana0 / Eva0");
    expect(html).toContain("Ana1 / Eva1");
    expect(html).toContain("vs");
  });
});

describe("BracketPreview", () => {
  const pairs = (n) => Array.from({ length: n }, (_, i) => pair(i));

  it("muestra la primera ronda con cada enfrentamiento", () => {
    const html = renderToStaticMarkup(<BracketPreview bracket={buildBracket(pairs(4))} />);
    expect(html).toContain("Primera ronda");
    expect(html).toContain("vs");
    ["Ana0 / Eva0", "Ana1 / Eva1", "Ana2 / Eva2", "Ana3 / Eva3"].forEach((n) => expect(html).toContain(n));
  });

  it("marca como pasa directo a quien no tiene rival y nunca muestra BYE", () => {
    const html = renderToStaticMarkup(<BracketPreview bracket={buildBracket(pairs(5))} />);
    expect(html).toContain("Pasa directo");
    expect(html).not.toContain("BYE");
    expect(html.match(/Pasa directo/g)).toHaveLength(3);
  });

  it("con orden de carga avisa que se respetan los cabezas de serie", () => {
    const seeded = renderToStaticMarkup(<BracketPreview bracket={buildBracket(pairs(4))} seeded />);
    expect(seeded).toContain("orden de carga");
    const random = renderToStaticMarkup(<BracketPreview bracket={buildBracket(pairs(4))} />);
    expect(random).not.toContain("orden de carga");
  });
});
