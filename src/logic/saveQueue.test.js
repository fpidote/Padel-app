import { describe, it, expect, vi } from "vitest";
import { createSaveQueue } from "./saveQueue";

// Escritura falsa que controla cuándo termina cada guardado
function fakeWrite() {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const write = (state) =>
    new Promise((resolve, reject) => {
      active++;
      maxActive = Math.max(maxActive, active);
      calls.push({ state, resolve: () => { active--; resolve(); }, reject: (e) => { active--; reject(e); } });
    });
  return { write, calls, maxActive: () => maxActive };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createSaveQueue — guardados en orden, sin descartar cambios", () => {
  it("T-SQ-01: un guardado escribe el estado y resuelve true", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write });
    const p = q.save({ ver: 1 });
    await tick();
    expect(f.calls.map((c) => c.state.ver)).toEqual([1]);
    f.calls[0].resolve();
    expect(await p).toBe(true);
    expect(q.lastSaved()).toEqual({ ver: 1 });
  });

  it("T-SQ-02: guardados pedidos mientras hay uno en curso NO se descartan: se escribe siempre el último", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write });
    const p1 = q.save({ ver: 1 });
    const p2 = q.save({ ver: 2 });
    const p3 = q.save({ ver: 3 });
    await tick();
    expect(f.calls).toHaveLength(1);
    f.calls[0].resolve();
    await tick();
    expect(f.calls.map((c) => c.state.ver)).toEqual([1, 3]); // el 2 lo cubre el 3 (que lo contiene)
    f.calls[1].resolve();
    expect(await Promise.all([p1, p2, p3])).toEqual([true, true, true]);
    expect(q.lastSaved()).toEqual({ ver: 3 });
  });

  it("T-SQ-03: nunca hay dos escrituras a la vez", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write });
    for (let v = 1; v <= 5; v++) q.save({ ver: v });
    for (let i = 0; i < 2; i++) { await tick(); f.calls[i]?.resolve(); }
    await tick();
    expect(f.maxActive()).toBe(1);
  });

  it("T-SQ-04: isSaving es true mientras se escribe y false al terminar", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write });
    expect(q.isSaving()).toBe(false);
    const p = q.save({ ver: 1 });
    expect(q.isSaving()).toBe(true);
    await tick();
    f.calls[0].resolve();
    await p;
    expect(q.isSaving()).toBe(false);
  });

  it("T-SQ-05: si falla la escritura avisa una sola vez con el último estado guardado y resuelve false", async () => {
    const f = fakeWrite();
    const onFailure = vi.fn();
    const q = createSaveQueue({ write: f.write, onFailure });
    q.confirm({ ver: 0 });
    const p1 = q.save({ ver: 1 });
    const p2 = q.save({ ver: 2 });
    await tick();
    f.calls[0].reject(new Error("sin red"));
    expect(await Promise.all([p1, p2])).toEqual([false, false]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({ ver: 0 }, expect.any(Error));
    expect(f.calls).toHaveLength(1); // no reintenta el estado pendiente, que partía del que falló
  });

  it("T-SQ-06: tras un fallo la cola sigue aceptando guardados", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write, onFailure: () => {} });
    const p1 = q.save({ ver: 1 });
    await tick();
    f.calls[0].reject(new Error("x"));
    await p1;
    const p2 = q.save({ ver: 2 });
    await tick();
    f.calls[1].resolve();
    expect(await p2).toBe(true);
    expect(q.lastSaved()).toEqual({ ver: 2 });
  });

  it("T-SQ-07: confirm() fija el estado conocido (el que llega del servidor) sin escribir", async () => {
    const f = fakeWrite();
    const q = createSaveQueue({ write: f.write });
    q.confirm({ ver: 7 });
    expect(q.lastSaved()).toEqual({ ver: 7 });
    expect(f.calls).toHaveLength(0);
  });
});
