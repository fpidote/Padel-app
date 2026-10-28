import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MatchFormatPicker from "./MatchFormatPicker";

const render = (config, props = {}) =>
  renderToStaticMarkup(
    <MatchFormatPicker config={config} color="#059669" allowSets onChange={() => {}} {...props} />
  );

const at = (html, text) => {
  const i = html.indexOf(text);
  expect(i, `no aparece "${text}"`).toBeGreaterThan(-1);
  return i;
};

describe("MatchFormatPicker", () => {
  it("muestra una sola lista de opciones, con sets solo si se permiten", () => {
    const withSets = render({});
    expect(withSets).toContain("Mejor de 3 sets");
    expect(withSets).toContain("Mejor de 5 sets");
    const noSets = render({}, { allowSets: false });
    expect(noSets).not.toContain("Mejor de 3 sets");
    expect(noSets).not.toContain("Mejor de 5 sets");
  });

  it("marca exactamente una opción como elegida", () => {
    ["timed", "rally", "games"].forEach((scoringSystem) => {
      const html = render({ scoringSystem });
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    });
    expect(render({ scoringFormat: "sets3" }).match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("los ajustes de por tiempo aparecen justo debajo de esa opción", () => {
    const html = render({ scoringSystem: "timed" });
    expect(at(html, "Minutos por partido")).toBeGreaterThan(at(html, "Por tiempo"));
    expect(at(html, "Minutos por partido")).toBeLessThan(at(html, "Por puntos"));
    expect(html).not.toContain("Puntos por partido");
    expect(html).not.toContain("Games para ganar");
  });

  it("los ajustes de por puntos aparecen entre su opción y la siguiente", () => {
    const html = render({ scoringSystem: "rally" });
    expect(at(html, "Puntos por partido")).toBeGreaterThan(at(html, "Por puntos"));
    expect(at(html, "Puntos por partido")).toBeLessThan(at(html, "Por games"));
    expect(html).not.toContain("Minutos por partido");
  });

  it("los ajustes de por games aparecen debajo de su opción", () => {
    const html = render({ scoringSystem: "games" });
    expect(at(html, "Games para ganar")).toBeGreaterThan(at(html, "Por games"));
    expect(at(html, "Games para ganar")).toBeLessThan(at(html, "Mejor de 3 sets"));
  });

  it("por tiempo pregunta qué se anota en cada partido", () => {
    const html = render({ scoringSystem: "timed" });
    expect(html).toContain("Qué se anota en cada partido");
    expect(html).toContain("Games ganados");
    expect(html).toContain("Puntos acumulados");
  });

  it("por tiempo explica cómo se decide un empate sin afirmar que siempre es punto de oro", () => {
    const html = render({ scoringSystem: "timed" });
    expect(html).toContain("igualados");
    expect(html).toContain("cerrando el game");
    expect(html).not.toContain("En caso de empate, punto de oro");
  });

  it("en sets no hay ajustes de tiempo, puntos ni games y avisa que se carga set por set", () => {
    const html = render({ scoringFormat: "sets3", scoringSystem: "rally" });
    expect(html).not.toContain("Minutos por partido");
    expect(html).not.toContain("Puntos por partido");
    expect(html).not.toContain("Games para ganar");
    expect(html).toContain("set por set");
  });

  it("usa lenguaje de pádel, sin rally ni scoring", () => {
    const html = render({ scoringSystem: "rally" });
    expect(html).not.toMatch(/rally/i);
    expect(html).not.toMatch(/scoring/i);
  });
});
