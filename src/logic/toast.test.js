import { describe, it, expect, vi } from "vitest";
import { showToast, subscribeToasts } from "./toast";

describe("avisos en pantalla", () => {
  it("entrega el aviso a quien está suscrito", () => {
    const listener = vi.fn();
    const off = subscribeToasts(listener);
    showToast("No se pudo guardar");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ message: "No se pudo guardar", type: "error" });
    off();
  });

  it("el tipo por defecto es error y se puede cambiar", () => {
    const listener = vi.fn();
    const off = subscribeToasts(listener);
    showToast("Listo", "ok");
    expect(listener.mock.calls[0][0].type).toBe("ok");
    off();
  });

  it("cada aviso tiene un id distinto", () => {
    const ids = [];
    const off = subscribeToasts((t) => ids.push(t.id));
    showToast("a");
    showToast("b");
    off();
    expect(new Set(ids).size).toBe(2);
  });

  it("al darse de baja ya no recibe avisos", () => {
    const listener = vi.fn();
    const off = subscribeToasts(listener);
    off();
    showToast("nadie lo ve");
    expect(listener).not.toHaveBeenCalled();
  });

  it("sin nadie suscrito no falla", () => {
    expect(() => showToast("a nadie")).not.toThrow();
  });
});
