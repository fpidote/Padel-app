import { describe, it, expect } from "vitest";
import { hasDraw, drawIsRandom, pairsForStart, drawKey, buildStartDraw, startPatch } from "./launchDraw";
import { buildBracket } from "./relampago";

const pairInputs = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i, p1: `A${i}`, p2: `B${i}`, pts: 0, gf: 0, gc: 0 }));

const tournament = (type, n, config = {}) => ({
  type,
  pairInputs: pairInputs(n),
  config: { name: "Torneo", groupCount: 2, advancePerGroup: 2, idaYVuelta: false, ...config },
});

describe("hasDraw", () => {
  it("Mundialito, Liga y Relámpago tienen sorteo que previsualizar", () => {
    expect(hasDraw("mundialito")).toBe(true);
    expect(hasDraw("liga")).toBe(true);
    expect(hasDraw("relampago")).toBe(true);
  });
  it("los demás formatos no (todavía)", () => {
    ["pozo", "americano"].forEach((t) => expect(hasDraw(t)).toBe(false));
  });
});

describe("drawIsRandom", () => {
  it("Mundialito y Liga siempre son al azar", () => {
    expect(drawIsRandom(tournament("mundialito", 6))).toBe(true);
    expect(drawIsRandom(tournament("liga", 4))).toBe(true);
  });
  it("Relámpago es al azar salvo que se respete el orden de carga", () => {
    expect(drawIsRandom(tournament("relampago", 6))).toBe(true);
    expect(drawIsRandom(tournament("relampago", 6, { seedByOrder: false }))).toBe(true);
    expect(drawIsRandom(tournament("relampago", 6, { seedByOrder: true }))).toBe(false);
  });
  it("donde no hay sorteo no hay nada que re-sortear", () => {
    expect(drawIsRandom(tournament("americano", 4))).toBe(false);
  });
});

describe("pairsForStart", () => {
  it("numera las parejas y las deja con estadísticas en cero", () => {
    const out = pairsForStart([{ p1: "Ana", p2: "Eva", id: 99, pts: 5 }, { p1: "Luis", p2: "Pedro" }]);
    expect(out.map((p) => p.id)).toEqual([0, 1]);
    expect(out[0]).toMatchObject({ p1: "Ana", p2: "Eva", pts: 0, gf: 0, gc: 0 });
  });
  it("sin parejas devuelve lista vacía", () => {
    expect(pairsForStart(undefined)).toEqual([]);
  });
});

describe("drawKey", () => {
  it("es estable si no cambia nada que afecte al sorteo", () => {
    expect(drawKey(tournament("mundialito", 6))).toBe(drawKey(tournament("mundialito", 6)));
  });
  it("cambia al agregar o cambiar una pareja", () => {
    const base = tournament("mundialito", 6);
    expect(drawKey(tournament("mundialito", 7))).not.toBe(drawKey(base));
    const edited = tournament("mundialito", 6);
    edited.pairInputs[2].p1 = "Otro";
    expect(drawKey(edited)).not.toBe(drawKey(base));
  });
  it("cambia con la cantidad de grupos y con ida y vuelta", () => {
    expect(drawKey(tournament("mundialito", 8, { groupCount: 4 }))).not.toBe(drawKey(tournament("mundialito", 8, { groupCount: 2 })));
    expect(drawKey(tournament("liga", 4, { idaYVuelta: true }))).not.toBe(drawKey(tournament("liga", 4, { idaYVuelta: false })));
  });
  it("cambia al activar o desactivar el orden de carga (Relámpago)", () => {
    expect(drawKey(tournament("relampago", 6, { seedByOrder: true }))).not.toBe(drawKey(tournament("relampago", 6, { seedByOrder: false })));
  });
  it("no cambia por ajustes que no afectan al sorteo (nombre, minutos)", () => {
    expect(drawKey(tournament("mundialito", 6, { name: "Otro", matchMinutes: 15 }))).toBe(drawKey(tournament("mundialito", 6)));
  });
});

describe("buildStartDraw — Mundialito", () => {
  it("reparte todas las parejas, una vez cada una, en la cantidad de grupos pedida", () => {
    const draw = buildStartDraw(tournament("mundialito", 8, { groupCount: 4 }));
    expect(draw.groups).toHaveLength(4);
    const ids = draw.groups.flatMap((g) => g.pairs.map((p) => p.id)).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("usa 2 grupos si no hay configuración", () => {
    const t = tournament("mundialito", 6);
    delete t.config.groupCount;
    expect(buildStartDraw(t).groups).toHaveLength(2);
  });
  it("cada sorteo es distinto: el azar interviene", () => {
    const t = tournament("mundialito", 8);
    const seen = new Set();
    for (let i = 0; i < 20; i++) seen.add(JSON.stringify(buildStartDraw(t).groups.map((g) => g.pairs.map((p) => p.id))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("buildStartDraw — Liga", () => {
  it("arma todos contra todos: n(n-1)/2 partidos con ida simple", () => {
    const draw = buildStartDraw(tournament("liga", 4));
    expect(draw.matches).toHaveLength(6);
    expect(draw.rounds).toHaveLength(3);
    expect(draw.standings).toHaveLength(4);
  });
  it("ida y vuelta duplica partidos y jornadas", () => {
    const draw = buildStartDraw(tournament("liga", 4, { idaYVuelta: true }));
    expect(draw.matches).toHaveLength(12);
    expect(draw.rounds).toHaveLength(6);
  });
});

const r1 = (bracket) => bracket.filter((m) => m.bracket === "winners" && m.round === 1);
const r1ids = (bracket) => r1(bracket).map((m) => [m.pairA?.id, m.pairB?.id]);

describe("buildStartDraw — Relámpago", () => {
  it("arma el cuadro con todas las parejas, una vez cada una, en la primera ronda", () => {
    const { bracket } = buildStartDraw(tournament("relampago", 6));
    const ids = r1ids(bracket).flat().filter((id) => id !== "bye").sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("con parejas de más reparte los pasa-directo sin enfrentar dos BYE", () => {
    const { bracket } = buildStartDraw(tournament("relampago", 5));
    const matches = r1ids(bracket);
    expect(matches).toHaveLength(4);
    expect(matches.filter(([a, b]) => a === "bye" && b === "bye")).toHaveLength(0);
    expect(matches.filter(([a, b]) => a === "bye" || b === "bye")).toHaveLength(3);
  });

  it("por defecto es un sorteo: el cuadro cambia de un sorteo a otro", () => {
    const t = tournament("relampago", 8);
    const seen = new Set();
    for (let i = 0; i < 30; i++) seen.add(JSON.stringify(r1ids(buildStartDraw(t).bracket)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("con orden de carga no hay azar y el cuadro es el de siempre", () => {
    const t = tournament("relampago", 5, { seedByOrder: true });
    const expected = JSON.stringify(r1ids(buildBracket(pairsForStart(t.pairInputs))));
    for (let i = 0; i < 10; i++) expect(JSON.stringify(r1ids(buildStartDraw(t).bracket))).toBe(expected);
  });

  it("con orden de carga la primera pareja cargada pasa directo", () => {
    const { bracket } = buildStartDraw(tournament("relampago", 5, { seedByOrder: true }));
    const first = r1(bracket).find((m) => m.pairA?.id === 0 || m.pairB?.id === 0);
    expect([first.pairA?.id, first.pairB?.id]).toContain("bye");
  });
});

describe("buildStartDraw — otros formatos", () => {
  it("devuelve null donde no hay sorteo previsualizable", () => {
    expect(buildStartDraw(tournament("pozo", 4))).toBeNull();
    expect(buildStartDraw(tournament("americano", 4))).toBeNull();
  });
});

describe("startPatch", () => {
  it("Mundialito inicia en fase de grupos con las parejas numeradas", () => {
    const t = tournament("mundialito", 6);
    const draw = buildStartDraw(t);
    const patch = startPatch(t, draw);
    expect(patch.phase).toBe("groups");
    expect(patch.pairs.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("usa el MISMO sorteo que se previsualizó, no genera otro", () => {
    const t = tournament("mundialito", 8);
    const draw = buildStartDraw(t);
    expect(startPatch(t, draw).groups).toBe(draw.groups);
  });
  it("Liga inicia en fase de fixture con el mismo fixture y tabla", () => {
    const t = tournament("liga", 4);
    const draw = buildStartDraw(t);
    const patch = startPatch(t, draw);
    expect(patch.phase).toBe("fixture");
    expect(patch.rounds).toBe(draw.rounds);
    expect(patch.matches).toBe(draw.matches);
    expect(patch.pairs).toBe(draw.standings);
  });
  it("Relámpago inicia en fase de cuadro con el mismo cuadro previsualizado", () => {
    const t = tournament("relampago", 6);
    const draw = buildStartDraw(t);
    const patch = startPatch(t, draw);
    expect(patch.phase).toBe("bracket");
    expect(patch.bracket).toBe(draw.bracket);
  });
  it("Relámpago: el sorteo no reordena las parejas, que siguen numeradas por orden de carga", () => {
    const t = tournament("relampago", 6);
    expect(startPatch(t, buildStartDraw(t)).pairs.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("sin sorteo previo lo genera (el inicio nunca queda sin grupos)", () => {
    const t = tournament("mundialito", 6);
    expect(startPatch(t, null).groups).toHaveLength(2);
  });
});
