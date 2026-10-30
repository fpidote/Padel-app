import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MatchCard from "./MatchCard";

const match = {
  id: "m1",
  saved: true,
  scoreA: "2",
  scoreB: "0",
  sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }],
  pairA: { id: 1, p1: "Ana", p2: "Luis" },
  pairB: { id: 2, p1: "Eva", p2: "Pau" },
};

const render = (props) =>
  renderToStaticMarkup(
    <MatchCard match={match} isAdmin ls={{}} setLs={() => {}} onSave={() => {}} scoringFormat="sets3" {...props} />,
  );

describe("MatchCard — editar y eliminar un resultado guardado", () => {
  // Corregir un resultado: sin guardar, con el marcador anterior todavía en el partido
  const correcting = { ...match, saved: false, editing: true };

  it("guardado: el organizador ve Editar y no ve Eliminar (eso va dentro de la corrección)", () => {
    const html = render({ onEdit: () => {}, onDelete: () => {} });
    expect(html).toContain("Editar");
    expect(html).not.toContain("Eliminar");
  });

  it("al corregir, con onDelete aparece Eliminar resultado junto a Cancelar y Guardar", () => {
    const html = render({ match: correcting, onEdit: () => {}, onDelete: () => {} });
    expect(html).toContain("Eliminar resultado");
    expect(html).toContain("Cancelar");
    expect(html).toContain("Guardar resultado");
  });

  it("al corregir, sin onDelete no hay Eliminar (Relámpago y fase final no cambian)", () => {
    const html = render({ match: correcting, onEdit: () => {} });
    expect(html).toContain("Cancelar");
    expect(html).not.toContain("Eliminar");
  });

  it("al espectador nunca se le muestran Editar ni Eliminar", () => {
    const html = render({ isAdmin: false, onEdit: () => {}, onDelete: () => {} });
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Eliminar");
  });

  it("cerrado: sin Editar ni Eliminar y con la marca de cerrado", () => {
    const html = render({ locked: true });
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Eliminar");
    expect(html).toContain("Cerrado");
  });

  it("un partido sin resultado no muestra Eliminar ni Cancelar", () => {
    const html = render({ match: { ...match, saved: false, scoreA: "", scoreB: "", sets: null }, onEdit: () => {}, onDelete: () => {} });
    expect(html).not.toContain("Eliminar");
    expect(html).not.toContain("Cancelar");
  });
});

describe("MatchCard — nombres de la pareja", () => {
  it("las dos líneas de cada pareja van unidas con '/' (nunca '&')", () => {
    const html = render({});
    expect(html).toContain("Ana /");
    expect(html).toContain("Eva /");
    expect(html).not.toContain("&amp;");
  });

  it("con por sets y sin guardar anuncia 'Al mejor de' en el cuerpo y no en la cabecera", () => {
    const open = { ...match, saved: false, scoreA: "", scoreB: "", sets: null };
    expect(render({ match: open })).toContain("Al mejor de 3 sets");
    expect(render({ match: open, scoringFormat: "sets5" })).toContain("Al mejor de 5 sets");
  });
});

describe("MatchCard — el botón Guardar no salta al escribir el marcador", () => {
  const pending = { ...match, saved: false, scoreA: "", scoreB: "", sets: null };
  const typed = { ls: { m1_A: "6", m1_B: "2" } };

  it("T-MC-01: reserva el hueco del ganador también antes de escribir, para que el botón no se mueva", () => {
    const antes = render({ match: pending, scoringFormat: "games" });
    const despues = render({ match: pending, scoringFormat: "games", ...typed });
    expect(antes).toContain('data-testid="winner-slot"');
    expect(despues).toContain('data-testid="winner-slot"');
  });

  it("T-MC-02: antes de escribir el hueco está vacío y después muestra quién gana", () => {
    const antes = render({ match: pending, scoringFormat: "games" });
    const despues = render({ match: pending, scoringFormat: "games", ...typed });
    expect(antes).not.toContain("Gana");
    expect(despues).toContain("Gana");
    expect(despues).toContain("Ana / Luis");
  });

  it("T-MC-03: un partido guardado no lleva ese hueco (no cambia su aspecto)", () => {
    expect(render({})).not.toContain("winner-slot");
  });

  it("T-MC-04: al espectador no se le reserva hueco", () => {
    expect(render({ match: pending, scoringFormat: "games", isAdmin: false })).not.toContain("winner-slot");
  });
});

describe("MatchCard — etiqueta de fase", () => {
  it("sin stageLabel conserva las etiquetas de siempre (grupos y cuadro)", () => {
    expect(render({})).toContain("FASE DE GRUPOS");
    expect(render({ match: { ...match, bracket: "winners" } })).toContain("CUADRO PRINCIPAL");
  });

  it("con stageLabel la reemplaza, para formatos sin grupos ni revancha", () => {
    const html = render({ stageLabel: "LIGA" });
    expect(html).toContain("LIGA");
    expect(html).not.toContain("FASE DE GRUPOS");
    const ko = render({ match: { ...match, bracket: "winners" }, stageLabel: "FASE FINAL" });
    expect(ko).toContain("FASE FINAL");
    expect(ko).not.toContain("CUADRO PRINCIPAL");
  });
});

describe("MatchCard — marcador por games inválido", () => {
  const open = { ...match, saved: false, scoreA: "", scoreB: "", sets: null };
  const games = (a, b) => render({ match: open, scoringFormat: "games", ls: { m1_A: a, m1_B: b } });

  it("explica por qué no se puede guardar un empate", () => {
    expect(games("6", "6")).toContain("Un partido no puede terminar empatado");
  });

  it("explica el máximo y los decimales", () => {
    expect(games("999", "2")).toContain("El máximo es 99");
    expect(games("2.5", "1")).toContain("Usa números enteros");
  });

  it("con un marcador válido no hay mensaje de error y se anuncia el ganador", () => {
    const html = games("6", "4");
    expect(html).not.toContain("data-testid=\"games-error\"");
    expect(html).toContain("Gana");
  });
});

describe("MatchCard — ganador por sets", () => {
  const open = { ...match, saved: false, scoreA: "", scoreB: "", sets: null };
  const ls = { m1_set0_A: "4", m1_set0_B: "6", m1_set1_A: "3", m1_set1_B: "6" };

  it("anuncia el resultado en sets desde el lado del ganador (2 a 0, no 0 a 2)", () => {
    const html = render({ match: open, ls });
    expect(html).toContain("Eva / Pau");
    expect(html).toContain("(2 sets a 0)");
    expect(html).not.toContain("(0 sets a 2)");
  });
});
