import { describe, it, expect, vi } from "vitest";
import { applyVersionedWrite } from "./saveTransaction";
import { VersionConflictError } from "./saveQueue";

// Transacción falsa: el servidor tiene `server` (o nada) y se anota lo que se escribe
function fakeTx(server) {
  return {
    get: vi.fn(async () => ({
      exists: () => server !== undefined,
      data: () => ({ data: JSON.stringify(server), ownerUid: "u" }),
    })),
    set: vi.fn(),
  };
}
const ref = { path: "torneos/ABC" };

describe("applyVersionedWrite", () => {
  it("T-SV-01: escribe cuando la versión del servidor es la base", async () => {
    const tx = fakeTx({ ver: 3, writeId: "a" });
    await applyVersionedWrite(tx, ref, { ver: 4, writeId: "b" }, 3);
    expect(tx.set).toHaveBeenCalledTimes(1);
    const [, payload, options] = tx.set.mock.calls[0];
    expect(JSON.parse(payload.data)).toEqual({ ver: 4, writeId: "b" });
    expect(options).toEqual({ merge: true });
  });

  it("T-SV-02: lanza VersionConflictError con el estado del servidor si ya cambió", async () => {
    const tx = fakeTx({ ver: 5, writeId: "otro" });
    await expect(applyVersionedWrite(tx, ref, { ver: 4, writeId: "b" }, 3)).rejects.toMatchObject({
      name: "VersionConflictError",
      serverState: { ver: 5, writeId: "otro" },
    });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("T-SV-03: un reintento con el mismo writeId no escribe ni falla", async () => {
    const tx = fakeTx({ ver: 4, writeId: "b" });
    await expect(applyVersionedWrite(tx, ref, { ver: 4, writeId: "b" }, 3)).resolves.toBeUndefined();
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("T-SV-04: un documento sin ver se trata como versión 0 en ambos lados", async () => {
    const tx = fakeTx({ status: "setup" });
    await applyVersionedWrite(tx, ref, { ver: 1, writeId: "a" }, undefined);
    expect(tx.set).toHaveBeenCalledTimes(1);
    const viejo = fakeTx({ status: "setup" });
    await expect(applyVersionedWrite(viejo, ref, { ver: 3, writeId: "a" }, 2)).rejects.toBeInstanceOf(VersionConflictError);
  });

  it("T-SV-05: un documento que no existe se escribe igual", async () => {
    const tx = fakeTx(undefined);
    await applyVersionedWrite(tx, ref, { ver: 1, writeId: "a" }, undefined);
    expect(tx.set).toHaveBeenCalledTimes(1);
  });
});

describe("newWriteId", () => {
  it("T-SV-20: devuelve un identificador distinto en cada llamada aunque no exista crypto.randomUUID", async () => {
    const { newWriteId } = await import("./saveTransaction");
    const original = globalThis.crypto;
    vi.stubGlobal("crypto", {});
    try {
      const a = newWriteId();
      const b = newWriteId();
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(8);
      expect(a).not.toBe(b);
    } finally {
      vi.stubGlobal("crypto", original);
    }
  });
});
