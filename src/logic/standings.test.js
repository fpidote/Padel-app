import { describe, it, expect } from "vitest";
import { computeStandings, sortStandings } from "./standings";

const P = (id) => ({ id, p1: `A${id}`, p2: `B${id}` });
const match = (a, b, sa, sb, sets = null) => ({
  pairA: P(a),
  pairB: P(b),
  scoreA: String(sa),
  scoreB: String(sb),
  saved: true,
  sets,
});

describe("sortStandings", () => {
  it("ordena primero por partidos ganados", () => {
    const pairs = [P(1), P(2), P(3)];
    const s = computeStandings(pairs, [
      match(1, 2, 2, 0),
      match(1, 3, 2, 0),
      match(2, 3, 2, 1),
    ]);
    expect(sortStandings(s).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("desempata por diferencia de sets", () => {
    const pairs = [P(1), P(2), P(3)];
    // 1 gana a 2 (2-1), 2 gana a 3 (2-0), 3 gana a 1 (2-1): todos 1 victoria
    const s = computeStandings(pairs, [
      match(1, 2, 2, 1),
      match(2, 3, 2, 0),
      match(3, 1, 2, 1),
    ]);
    // dif sets: 1 → 3-3=0 ... 1: 2+1 - (1+2)=0 ; 2: 1+2 - (2+0)=1 ; 3: 0+2 - (2+1)=-1
    expect(sortStandings(s).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it("desempata por diferencia de juegos si empatan victorias y sets", () => {
    const pairs = [P(1), P(2), P(3), P(4)];
    const s = computeStandings(pairs, [
      match(1, 3, 2, 0, [{ a: 6, b: 4 }, { a: 6, b: 4 }]),
      match(2, 4, 2, 0, [{ a: 6, b: 0 }, { a: 6, b: 0 }]),
    ]);
    expect(sortStandings(s).map((x) => x.id).slice(0, 2)).toEqual([2, 1]);
  });
});
