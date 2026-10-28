import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PodiumCard from "./PodiumCard";

const pair = (id) => ({ id, p1: `Ana${id}`, p2: `Eva${id}` });
const podium = { champion: pair(1), runnerUp: pair(2), third: pair(3), fourth: pair(4) };

describe("PodiumCard", () => {
  it("T-POD-UI-1: muestra campeón, subcampeón y tercer puesto cuando hay partido por el 3.º", () => {
    const html = renderToStaticMarkup(<PodiumCard podium={podium} hasThird semifinalists={[]} />);
    expect(html).toContain("Campeón");
    expect(html).toContain("Ana1 / Eva1");
    expect(html).toContain("Subcampeón");
    expect(html).toContain("Ana2 / Eva2");
    expect(html).toContain("Tercer puesto");
    expect(html).toContain("Ana3 / Eva3");
  });

  it("T-POD-UI-2: con el partido por el 3.º sin jugar el tercero queda 'Por definir'", () => {
    const html = renderToStaticMarkup(<PodiumCard podium={{ ...podium, third: null }} hasThird semifinalists={[]} />);
    expect(html).toContain("Por definir");
  });

  it("T-POD-UI-4: thirdLabel cambia el rótulo del tercero (Relámpago: ganador de la revancha)", () => {
    const html = renderToStaticMarkup(<PodiumCard podium={podium} hasThird thirdLabel="Ganador de la revancha" semifinalists={[]} />);
    expect(html).toContain("Ganador de la revancha");
    expect(html).not.toContain("Tercer puesto");
  });

  it("T-POD-UI-3: sin partido por el 3.º muestra a los semifinalistas, sin inventar un tercero", () => {
    const html = renderToStaticMarkup(<PodiumCard podium={{ ...podium, third: null }} hasThird={false} semifinalists={[pair(3), pair(4)]} />);
    expect(html).not.toContain("Tercer puesto");
    expect(html).toContain("Semifinalistas");
    expect(html).toContain("Ana3 / Eva3");
    expect(html).toContain("Ana4 / Eva4");
  });

  it("T-POD-UI-4: con 2 parejas (sin semifinales) solo hay campeón y subcampeón", () => {
    const html = renderToStaticMarkup(<PodiumCard podium={podium} hasThird={false} semifinalists={[]} />);
    expect(html).not.toContain("Semifinalistas");
    expect(html).not.toContain("Tercer puesto");
  });

  it("T-POD-UI-5: sin campeón no muestra nada", () => {
    expect(renderToStaticMarkup(<PodiumCard podium={{ champion: null }} hasThird={false} semifinalists={[]} />)).toBe("");
  });

  it("T-POD-UI-6: finalizado se indica en el título", () => {
    expect(renderToStaticMarkup(<PodiumCard podium={podium} hasThird semifinalists={[]} finished />)).toContain("Torneo finalizado");
    expect(renderToStaticMarkup(<PodiumCard podium={podium} hasThird semifinalists={[]} />)).toContain("Resultado final");
  });
});
