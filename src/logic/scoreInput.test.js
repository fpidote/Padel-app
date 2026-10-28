import { describe, it, expect, vi, afterEach } from "vitest";
import { blockNonIntegerKey } from "./scoreInput";
import { subscribeToasts } from "./toast";

const key = (k) => ({ key: k, preventDefault: vi.fn() });

describe("blockNonIntegerKey", () => {
  let off;
  afterEach(() => off?.());

  it("bloquea coma, punto, menos y e, y avisa de por qué", () => {
    const listener = vi.fn();
    off = subscribeToasts(listener);
    for (const k of [",", ".", "-", "e"]) {
      const e = key(k);
      blockNonIntegerKey(e);
      expect(e.preventDefault).toHaveBeenCalled();
    }
    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener.mock.calls[0][0].message).toBe("Escribe solo números enteros, sin coma ni punto.");
  });

  it("deja pasar los dígitos y las teclas de edición sin avisar", () => {
    const listener = vi.fn();
    off = subscribeToasts(listener);
    for (const k of ["0", "7", "Backspace", "Tab", "Enter"]) {
      const e = key(k);
      blockNonIntegerKey(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(listener).not.toHaveBeenCalled();
  });
});
