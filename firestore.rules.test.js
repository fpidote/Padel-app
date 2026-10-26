// firestore.rules.test.js
import { describe, test, beforeAll, afterAll, afterEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "app-padel-torneo",
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Crea un torneo saltando las reglas (setup de tests)
async function crearTorneo(code, ownerUid) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "torneos", code), {
      data: JSON.stringify({ ver: 1, status: "setup" }),
      ownerUid,
      createdAt: new Date(),
    });
  });
}

// ─── GET ───────────────────────────────────────────────────────

describe("get — lectura directa", () => {
  test("espectador sin login puede leer un torneo por código", async () => {
    await crearTorneo("T1", "owner1");
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(ctx.firestore(), "torneos", "T1")));
  });

  test("usuario autenticado puede leer un torneo ajeno por código", async () => {
    await crearTorneo("T2", "owner1");
    const ctx = testEnv.authenticatedContext("intruso");
    await assertSucceeds(getDoc(doc(ctx.firestore(), "torneos", "T2")));
  });
});

// ─── LIST ──────────────────────────────────────────────────────

describe("list — query sobre la colección", () => {
  test("el dueño puede listar sus propios torneos", async () => {
    await crearTorneo("T3", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    const q = query(
      collection(ctx.firestore(), "torneos"),
      where("ownerUid", "==", "owner1"),
      orderBy("createdAt", "desc")
    );
    await assertSucceeds(getDocs(q));
  });

  test("usuario autenticado no puede listar torneos ajenos", async () => {
    await crearTorneo("T4", "owner1");
    const ctx = testEnv.authenticatedContext("intruso");
    const q = query(
      collection(ctx.firestore(), "torneos"),
      where("ownerUid", "==", "owner1")
    );
    await assertFails(getDocs(q));
  });

  test("usuario sin login no puede listar torneos", async () => {
    const ctx = testEnv.unauthenticatedContext();
    const q = query(
      collection(ctx.firestore(), "torneos"),
      where("ownerUid", "==", "owner1")
    );
    await assertFails(getDocs(q));
  });
});

// ─── CREATE ────────────────────────────────────────────────────

describe("create — creación de torneo", () => {
  test("usuario autenticado puede crear torneo con su propio ownerUid", async () => {
    const ctx = testEnv.authenticatedContext("user1");
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "torneos", "NUEVO"), {
        data: JSON.stringify({ ver: 1, status: "setup" }),
        ownerUid: "user1",
        createdAt: serverTimestamp(),
      })
    );
  });

  test("usuario no puede crear torneo con ownerUid de otro", async () => {
    const ctx = testEnv.authenticatedContext("user1");
    await assertFails(
      setDoc(doc(ctx.firestore(), "torneos", "ROBO"), {
        data: JSON.stringify({ ver: 1 }),
        ownerUid: "otro-usuario",
        createdAt: serverTimestamp(),
      })
    );
  });

  test("usuario sin login no puede crear torneo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(ctx.firestore(), "torneos", "ANON"), {
        data: JSON.stringify({ ver: 1 }),
        ownerUid: "nadie",
        createdAt: serverTimestamp(),
      })
    );
  });

  test("creación falla si data no es string", async () => {
    const ctx = testEnv.authenticatedContext("user1");
    await assertFails(
      setDoc(doc(ctx.firestore(), "torneos", "MAL"), {
        data: { ver: 1 },
        ownerUid: "user1",
        createdAt: serverTimestamp(),
      })
    );
  });
});

// ─── UPDATE ────────────────────────────────────────────────────

describe("update — actualización de torneo", () => {
  test("el dueño puede actualizar el campo data", async () => {
    await crearTorneo("UPD1", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "torneos", "UPD1"), {
        data: JSON.stringify({ ver: 2, status: "playing" }),
      })
    );
  });

  test("usuario ajeno no puede actualizar un torneo", async () => {
    await crearTorneo("UPD2", "owner1");
    const ctx = testEnv.authenticatedContext("intruso");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "torneos", "UPD2"), {
        data: JSON.stringify({ ver: 2 }),
      })
    );
  });

  test("usuario sin login no puede actualizar un torneo", async () => {
    await crearTorneo("UPD3", "owner1");
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      updateDoc(doc(ctx.firestore(), "torneos", "UPD3"), {
        data: JSON.stringify({ ver: 2 }),
      })
    );
  });

  test("el dueño no puede cambiar ownerUid", async () => {
    await crearTorneo("UPD4", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "torneos", "UPD4"), {
        data: JSON.stringify({ ver: 2 }),
        ownerUid: "intruso",
      })
    );
  });

  test("actualización falla si data no es string", async () => {
    await crearTorneo("UPD5", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "torneos", "UPD5"), {
        data: { ver: 2 },
      })
    );
  });
});

// ─── DELETE ────────────────────────────────────────────────────

describe("delete — borrado de torneo", () => {
  test("el dueño puede borrar su torneo", async () => {
    await crearTorneo("DEL1", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertSucceeds(deleteDoc(doc(ctx.firestore(), "torneos", "DEL1")));
  });

  test("usuario ajeno no puede borrar un torneo", async () => {
    await crearTorneo("DEL2", "owner1");
    const ctx = testEnv.authenticatedContext("intruso");
    await assertFails(deleteDoc(doc(ctx.firestore(), "torneos", "DEL2")));
  });

  test("usuario sin login no puede borrar un torneo", async () => {
    await crearTorneo("DEL3", "owner1");
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(deleteDoc(doc(ctx.firestore(), "torneos", "DEL3")));
  });
});

// ─── CAMPOS PERMITIDOS ─────────────────────────────────────────

describe("campos permitidos del documento", () => {
  test("no se puede crear un torneo con campos extra", async () => {
    const ctx = testEnv.authenticatedContext("user1");
    await assertFails(
      setDoc(doc(ctx.firestore(), "torneos", "EXTRA"), {
        data: JSON.stringify({ ver: 1 }),
        ownerUid: "user1",
        createdAt: serverTimestamp(),
        basura: "x".repeat(1000),
      })
    );
  });

  test("el dueño no puede añadir campos extra al actualizar", async () => {
    await crearTorneo("EXTRA2", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "torneos", "EXTRA2"), {
        data: JSON.stringify({ ver: 2 }),
        basura: "x",
      })
    );
  });

  test("el persist con merge (solo data) sigue funcionando", async () => {
    await crearTorneo("MERGE1", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertSucceeds(
      setDoc(
        doc(ctx.firestore(), "torneos", "MERGE1"),
        { data: JSON.stringify({ ver: 3 }) },
        { merge: true }
      )
    );
  });
});

// ─── CUENTAS ANÓNIMAS ──────────────────────────────────────────

describe("create — cuentas anónimas", () => {
  test("una sesión anónima de Firebase no puede crear torneos", async () => {
    const ctx = testEnv.authenticatedContext("anon1", { firebase: { sign_in_provider: "anonymous" } });
    await assertFails(
      setDoc(doc(ctx.firestore(), "torneos", "ANON2"), {
        data: JSON.stringify({ ver: 1 }),
        ownerUid: "anon1",
        createdAt: serverTimestamp(),
      })
    );
  });

  test("una sesión con Google sí puede crear torneos", async () => {
    const ctx = testEnv.authenticatedContext("g1", { firebase: { sign_in_provider: "google.com" } });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "torneos", "GOOG"), {
        data: JSON.stringify({ ver: 1 }),
        ownerUid: "g1",
        createdAt: serverTimestamp(),
      })
    );
  });
});

// ─── REGISTRO DE PARTIDOS (El Pozo) ────────────────────────────

describe("matches — registro de partidos del Pozo", () => {
  const registro = { roundNum: 1, courtNum: 1, mode: "fixed", result: { scoreA: 6, scoreB: 3, winningSide: "A" } };

  test("el dueño del torneo puede registrar partidos", async () => {
    await crearTorneo("POZO1", "owner1");
    const ctx = testEnv.authenticatedContext("owner1");
    await assertSucceeds(addDoc(collection(ctx.firestore(), "torneos", "POZO1", "matches"), registro));
  });

  test("un usuario ajeno no puede registrar partidos", async () => {
    await crearTorneo("POZO2", "owner1");
    const ctx = testEnv.authenticatedContext("intruso");
    await assertFails(addDoc(collection(ctx.firestore(), "torneos", "POZO2", "matches"), registro));
  });

  test("sin login no se pueden registrar partidos", async () => {
    await crearTorneo("POZO3", "owner1");
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(addDoc(collection(ctx.firestore(), "torneos", "POZO3", "matches"), registro));
  });

  test("el registro no se puede modificar ni borrar", async () => {
    await crearTorneo("POZO4", "owner1");
    let ref;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      ref = await addDoc(collection(ctx.firestore(), "torneos", "POZO4", "matches"), registro);
    });
    const ctx = testEnv.authenticatedContext("owner1");
    const mine = doc(ctx.firestore(), "torneos", "POZO4", "matches", ref.id);
    await assertFails(updateDoc(mine, { mode: "mixer" }));
    await assertFails(deleteDoc(mine));
  });

  test("solo el dueño puede leer el registro", async () => {
    await crearTorneo("POZO5", "owner1");
    let ref;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      ref = await addDoc(collection(ctx.firestore(), "torneos", "POZO5", "matches"), registro);
    });
    const owner = testEnv.authenticatedContext("owner1");
    const other = testEnv.authenticatedContext("intruso");
    await assertSucceeds(getDoc(doc(owner.firestore(), "torneos", "POZO5", "matches", ref.id)));
    await assertFails(getDoc(doc(other.firestore(), "torneos", "POZO5", "matches", ref.id)));
  });
});
