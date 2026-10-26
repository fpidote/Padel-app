import { describe, it, expect } from "vitest";
import { buildKnockoutFromGroups } from "./mundialito";

const pair = (id, pts, gf, gc) => ({ id, p1: `A${id}`, p2: `B${id}`, pts, gf, gc });

describe("buildKnockoutFromGroups", () => {
  it("genera el cuadro con los mejores de cada grupo", () => {
    const groups = [
      { standings: [pair(1, 6, 4, 0), pair(2, 3, 2, 2), pair(3, 0, 0, 4)] },
      { standings: [pair(4, 6, 4, 1), pair(5, 3, 2, 2), pair(6, 0, 1, 4)] },
    ];
    const bracket = buildKnockoutFromGroups(groups, 2);
    const ids = bracket
      .flatMap((m) => [m.pairA?.id, m.pairB?.id])
      .filter((id) => id && id !== "bye");
    expect(new Set(ids)).toEqual(new Set([1, 2, 4, 5]));
  });
});
