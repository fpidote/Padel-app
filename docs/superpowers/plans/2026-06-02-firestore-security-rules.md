# Firestore Security Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar reglas de seguridad Firestore que protejan la colección `torneos` sin romper ningún flujo existente de la app.

**Architecture:** Tres archivos nuevos (`firestore.rules`, `firestore.indexes.json`, `firestore.rules.test.js`) y dos modificados (`firebase.json`, `package.json`). Las reglas separan `get` de `list`, protegen `ownerUid` y `createdAt` como inmutables, y dejan una sub-colección `partidos/{matchId}` como punto de extensión. Los tests usan el emulador de Firestore vía `@firebase/rules-unit-testing` + Vitest.

**Tech Stack:** Firebase CLI 15.19.0, `@firebase/rules-unit-testing` ^4.0.0, `firebase-admin` ^13.0.0, Vitest 4.x (ya instalado).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `firestore.rules` | Crear | Reglas de seguridad Firestore |
| `firestore.indexes.json` | Crear | Índice compuesto para query de Panel |
| `firestore.rules.test.js` | Crear | Tests del emulador (TDD) |
| `firebase.json` | Modificar | Declarar los tres archivos anteriores + config del emulador |
| `package.json` | Modificar | Script `test:rules` + devDependencies |

---

## Task 1: Instalar dependencias y configurar el emulador

**Files:**
- Modify: `package.json`
- Modify: `firebase.json`

- [ ] **Step 1: Instalar `@firebase/rules-unit-testing` y `firebase-admin`**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm install -D @firebase/rules-unit-testing firebase-admin
```

Verificar que aparecen en `devDependencies` del `package.json`.

- [ ] **Step 2: Agregar el script `test:rules` a `package.json`**

Abrir `package.json` y agregar en la sección `scripts`:

```json
"test:rules": "firebase emulators:exec --only firestore \"vitest run firestore.rules.test.js\""
```

La sección `scripts` completa queda:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "test:rules": "firebase emulators:exec --only firestore \"vitest run firestore.rules.test.js\"",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

- [ ] **Step 3: Agregar configuración del emulador de Firestore a `firebase.json`**

Abrir `firebase.json` y agregar la sección `emulators`. El archivo completo queda:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "host": "127.0.0.1",
      "port": 8080
    },
    "ui": {
      "enabled": false
    }
  }
}
```

- [ ] **Step 4: Verificar que el emulador de Firestore está disponible**

```bash
firebase emulators:start --only firestore
```

Esperar a ver `✔  firestore: Firestore Emulator started at http://127.0.0.1:8080` y luego `Ctrl+C`.

---

## Task 2: Crear reglas deny-all y escribir los tests (RED)

**Files:**
- Create: `firestore.rules` (placeholder deny-all)
- Create: `firestore.rules.test.js`

- [ ] **Step 1: Crear `firestore.rules` con reglas deny-all temporales**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Esto garantiza que todos los `assertSucceeds` fallen, confirmando que los tests sí prueban algo real.

- [ ] **Step 2: Crear `firestore.rules.test.js` en la raíz del proyecto**

```js
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
```

- [ ] **Step 3: Correr los tests y verificar que fallan (RED)**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run test:rules
```

Con las reglas deny-all, todos los `assertSucceeds` fallan. Salida esperada: varios tests marcados como FAIL. Confirma que los tests sí detectan permisos incorrectos.

---

## Task 3: Implementar `firestore.rules` real (GREEN)

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Reemplazar `firestore.rules` con las reglas reales**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /torneos/{code} {

      // Lectura directa: cualquiera con el código (espectadores sin login)
      allow get: if true;

      // Query sobre la colección: solo el dueño (Panel.jsx)
      allow list: if request.auth != null
               && request.auth.uid == resource.data.ownerUid;

      // Creación: auth requerido, ownerUid propio, createdAt del servidor, data string
      allow create: if request.auth != null
                 && request.resource.data.ownerUid == request.auth.uid
                 && request.resource.data.createdAt == request.time
                 && request.resource.data.data is string;

      // Actualización: solo el dueño, ownerUid y createdAt inmutables, data string
      allow update: if request.auth != null
                 && request.auth.uid == resource.data.ownerUid
                 && request.resource.data.ownerUid == resource.data.ownerUid
                 && request.resource.data.createdAt == resource.data.createdAt
                 && request.resource.data.data is string;

      // Borrado: solo el dueño
      allow delete: if request.auth != null
                 && request.auth.uid == resource.data.ownerUid;

      // Sub-colección — punto de extensión para escrituras de jugadores
      match /partidos/{matchId} {
        allow read: if true;
        allow write: if false;
      }
    }
  }
}
```

- [ ] **Step 2: Correr los tests y verificar que todos pasan (GREEN)**

```bash
npm run test:rules
```

Salida esperada:

```
✓ get — lectura directa (2 tests)
✓ list — query sobre la colección (3 tests)
✓ create — creación de torneo (4 tests)
✓ update — actualización de torneo (5 tests)
✓ delete — borrado de torneo (3 tests)

Tests  17 passed (17)
```

Si algún test falla, revisar el mensaje de error — Firebase emulator devuelve el motivo exacto de la denegación.

- [ ] **Step 3: Commit de reglas y tests**

```bash
git add firestore.rules firestore.rules.test.js
git commit -m "feat: agregar reglas de seguridad Firestore con tests del emulador"
```

---

## Task 4: Crear `firestore.indexes.json`

**Files:**
- Create: `firestore.indexes.json`

- [ ] **Step 1: Crear el archivo con el índice compuesto**

```json
{
  "indexes": [
    {
      "collectionGroup": "torneos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Este índice es requerido por la query de `Panel.jsx`:
```js
query(collection(db, "torneos"), where("ownerUid", "==", uid), orderBy("createdAt", "desc"))
```

Sin él, Firestore en producción devuelve un error con un link para crear el índice manualmente. Con este archivo el índice se crea automáticamente al hacer `firebase deploy`.

- [ ] **Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: agregar índice compuesto ownerUid+createdAt para query de Panel"
```

---

## Task 5: Actualizar `firebase.json` y deploy

**Files:**
- Modify: `firebase.json` (la sección `firestore` ya fue agregada en Task 1 Step 3)

- [ ] **Step 1: Verificar que `firebase.json` tiene la sección `firestore` correcta**

El archivo debe tener exactamente esta estructura (la sección `emulators` es solo para desarrollo local y no afecta el deploy):

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "ui": { "enabled": false }
  }
}
```

- [ ] **Step 2: Correr el build de la app para verificar que nada se rompió**

```bash
npm run build
```

Salida esperada: `✓ built in X.XXs` sin errores. Las reglas de Firestore no afectan el build de la app — este paso confirma que ningún cambio en los archivos de config rompió algo.

- [ ] **Step 3: Deployar reglas e índices a Firestore**

```bash
firebase deploy --only firestore
```

Salida esperada:
```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

- [ ] **Step 4: Commit final**

```bash
git add firebase.json
git commit -m "feat: deployar reglas de seguridad e índices a Firestore producción"
```

---

## Referencia rápida: qué cubre cada regla

| Quién intenta | Operación | Resultado |
|---|---|---|
| Espectador anónimo | Leer torneo por código | ✅ Permitido |
| Espectador anónimo | Listar torneos | ❌ Denegado |
| Usuario A | Leer torneo de Usuario B por código | ✅ Permitido |
| Usuario A | Listar torneos de Usuario B | ❌ Denegado |
| Usuario A | Crear torneo con `ownerUid: "B"` | ❌ Denegado |
| Usuario A | Actualizar torneo de Usuario B | ❌ Denegado |
| Usuario A (dueño) | Cambiar `ownerUid` en update | ❌ Denegado |
| Usuario A (dueño) | Actualizar campo `data` | ✅ Permitido |
| Usuario A (dueño) | Borrar su torneo | ✅ Permitido |
| Cualquiera | Escribir a sub-colección `partidos` | ❌ Denegado (hasta implementar feature) |
