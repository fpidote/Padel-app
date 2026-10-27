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
  it("muestra Editar y Eliminar al organizador cuando se pasan los dos manejadores", () => {
    const html = render({ onEdit: () => {}, onDelete: () => {} });
    expect(html).toContain("Editar");
    expect(html).toContain("Eliminar");
  });

  it("sin onDelete no hay botón Eliminar (Mundialito y Relámpago no cambian)", () => {
    const html = render({ onEdit: () => {} });
    expect(html).toContain("Editar");
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

  it("un partido sin guardar no muestra Eliminar", () => {
    const html = render({ match: { ...match, saved: false, scoreA: "", scoreB: "", sets: null }, onEdit: () => {}, onDelete: () => {} });
    expect(html).not.toContain("Eliminar");
  });
});
