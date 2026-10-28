# Ayudantes de torneo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño de un torneo pueda dar acceso por correo de Google a ayudantes que cargan resultados, pasan de ronda y finalizan, sin romper ningún torneo existente.

**Architecture:** (1) Los guardados pasan a una transacción que comprueba la versión (`ver`) y descarta con aviso al que llega tarde. (2) Los ayudantes viven en la subcolección `torneos/{code}/helpers/{email}`; las reglas permiten actualizar `data` a dueño o ayudante. (3) El cliente separa `isOwner` de `canScore` y añade una pantalla "Ayudantes" solo para el dueño.

**Tech Stack:** React 18 + Vite, Firebase 12 (Auth Google, Firestore, transacciones web SDK), Vitest, `@firebase/rules-unit-testing`, Playwright contra emuladores. JavaScript puro.

**Spec:** `docs/superpowers/specs/2026-10-28-ayudantes-design.md`

## Global Constraints

- JavaScript puro, sin TypeScript; commits en español `tipo: descripción`; sin `console.log`; errores al usuario con `showToast`, nunca `alert`.
- `persist` sigue usando `{ merge: true }`; `ownerUid` y `createdAt` quedan como campos de primer nivel y no se añaden campos nuevos de primer nivel al documento del torneo (las reglas hoy solo permiten `data`, `ownerUid`, `createdAt`).
- No crear listeners fuera de `useTournament.js` (los ayudantes se leen con `getDoc`/`getDocs`, no con `onSnapshot`).
- Correos de ayudantes: guardados en minúsculas, sin espacios, **coincidencia exacta** (sin normalizar puntos ni alias). Máximo **5** ayudantes por torneo, aplicado solo en la pantalla.
- Los correos de ayudantes nunca viven en el documento del torneo (la lectura `get` es pública): solo en la subcolección `helpers`.
- Un ayudante solo puede cambiar `data`; no `ownerUid`, no `createdAt`, sin campos extra; no crea ni borra torneos ni gestiona ayudantes.
- Cambios de reglas: cubiertos en `firestore.rules.test.js` (`npm run test:rules`) antes de desplegar; el despliegue (`firebase deploy --only firestore:rules`) es manual y necesita la aprobación del dueño del producto en ese momento.
- Verificación final de cada tarea: `npx vitest run`, `npm run lint`, `npm run build`; e2e con `npx playwright test` contra emuladores (ver CLAUDE.md §0). Ningún torneo existente (sin `helpers`, sin `writeId`, `ver` posiblemente indefinido) puede dejar de cargar o guardar.

## Review Focus

1. Correo con mayúsculas o espacios ("  Ana@Gmail.COM "): se guarda como `ana@gmail.com` y solo entra quien inicia sesión con ese correo exacto. Tarea 4 y 3.
2. Token con `email_verified: false` o sin correo: no gana permisos de ayudante. Tarea 3.
3. Reintento propio tras un guardado que sí entró (timeout): no cuenta como conflicto. Tarea 1 y 2.
4. Torneos antiguos: sin `ver`, sin `writeId`, sin subcolección: cargan, guardan y no dan error en la comprobación de ayudante. Tarea 2, 4 y 6.
5. Ayudante al que le quitan el acceso con el torneo abierto: su siguiente guardado falla con un aviso claro y la pantalla vuelve a lo último guardado. Tarea 6.

## Estructura de archivos

- Crear `src/logic/saveTransaction.js` — `applyVersionedWrite`, comprobación de versión pura sobre un objeto `tx`.
- Modificar `src/logic/saveQueue.js` — `VersionConflictError` y `onConflict`.
- Modificar `src/hooks/useTournament.js` — usar transacción, `writeId`, `isOwner`/`canScore`/`isHelper`.
- Crear `src/logic/helpers.js` — correos y límite (lógica pura).
- Crear `src/hooks/useHelpers.js` — leer, añadir y quitar ayudantes (solo dueño).
- Crear `src/components/shared/HelpersModal.jsx` — pantalla "Ayudantes".
- Modificar `src/TournamentPage.jsx`, `src/components/shared/Components.jsx` (`THeader`), `firestore.rules`, `firestore.rules.test.js`, `e2e/helpers/seed.js`, `CLAUDE.md`.

---

### Task 1: La cola de guardado distingue un conflicto de versión

**Files:**
- Modify: `src/logic/saveQueue.js`
- Test: `src/logic/saveQueue.test.js`

**Interfaces:**
- Produces: `export class VersionConflictError extends Error { serverState }` (constructor `(serverState)`); `createSaveQueue({ write, onFailure, onConflict })` donde `onConflict(serverState)` se llama una vez por conflicto.

- [ ] **Step 1: Tests que fallan** (en `saveQueue.test.js`): `"un conflicto llama a onConflict una vez con el estado del servidor y no a onFailure"`; `"un conflicto descarta el guardado pendiente y resuelve false a todos"`; `"tras un conflicto la cola acepta nuevos guardados y el estado confirmado es el del servidor"`; `"un error que no es de versión sigue llamando a onFailure como antes"`.
- [ ] **Step 2:** Ejecutar `npx vitest run src/logic/saveQueue.test.js` → los nuevos fallan.
- [ ] **Step 3:** Implementar en `saveQueue.js`: en el `catch` de `run`, si `err instanceof VersionConflictError`, vaciar `current`/`next`, hacer `confirmed = err.serverState`, llamar `onConflict(err.serverState)` y resolver `false`; si no, el flujo actual.
- [ ] **Step 4:** Ejecutar el archivo de tests → pasa; `npx vitest run` completo en verde.
- [ ] **Step 5:** Commit `feat: la cola de guardado distingue los conflictos de versión`.

### Task 2: Guardado con control de versión (transacción)

**Files:**
- Create: `src/logic/saveTransaction.js`, `src/logic/saveTransaction.test.js`
- Modify: `src/hooks/useTournament.js` (`persist`, creación de la cola)
- Test: `e2e/tests/guardado-concurrente.spec.js`

**Interfaces:**
- Consumes: `VersionConflictError` (Tarea 1).
- Produces: `export async function applyVersionedWrite(tx, ref, state, baseVer)`: lee con `tx.get(ref)`; si `JSON.parse(snap.data().data)` tiene `writeId === state.writeId` no escribe (ya entró); si `(server.ver ?? 0) !== (baseVer ?? 0)` lanza `VersionConflictError(server)`; si no, `tx.set(ref, { data: JSON.stringify(state) }, { merge: true })`. Documento inexistente: `tx.set` igual (no se usa en la app, pero no debe romper).

- [ ] **Step 1: Tests unitarios con un `tx` falso** (`saveTransaction.test.js`): `"escribe cuando la versión del servidor es la base"`; `"lanza VersionConflictError con el estado del servidor cuando ya cambió"`; `"un reintento con el mismo writeId no escribe ni falla"`; `"un documento sin ver se trata como versión 0 en ambos lados"`.
- [ ] **Step 2:** Verlos fallar; implementar `applyVersionedWrite`; verlos pasar.
- [ ] **Step 3:** En `useTournament.js`: `persist` añade `writeId: crypto.randomUUID()` al estado (junto a `ver`); la cola se crea con `write: (state) => runTransaction(db, (tx) => applyVersionedWrite(tx, doc(db, "torneos", codeRef.current), state, queueRef.current.lastSaved()?.ver))` y `onConflict(serverState)` que hace `verRef.current = serverState.ver`, `setT(serverState)`, `showToast("Otro organizador guardó a la vez; se cargó la versión más reciente. Repite tu cambio.")`. Sin `lastSaved` (aún no llegó el snapshot) `persist` no escribe y avisa con `showToast`.
- [ ] **Step 4: Test e2e** `guardado-concurrente.spec.js`, con tres tests: (a) dos pestañas del dueño guardan a la vez partidos distintos de una Liga sembrada: el documento conserva uno, la otra pantalla muestra el aviso y el estado del servidor (repetir 5 veces dentro del test); (b) un guardado de A y después otro de B, ya con el snapshot de A recibido: ambos quedan; (c) varios guardados rápidos de una sola pestaña no dan conflicto.
- [ ] **Step 5:** Suite completa (`npx vitest run`, e2e completos) en verde; Commit `feat: los guardados comprueban la versión y avisan si otro organizador guardó antes`.

### Task 3: Reglas de Firestore para ayudantes

**Files:**
- Modify: `firestore.rules`
- Test: `firestore.rules.test.js`

**Interfaces:**
- Produces (contrato de datos): documento `torneos/{code}/helpers/{email}` con `{ addedAt }`; `email` = minúsculas. Regla del torneo `update`: dueño (como hoy) **o** `request.auth != null && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider != 'anonymous' && exists(/databases/$(database)/documents/torneos/$(code)/helpers/$(request.auth.token.email.lower()))` y `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['data'])`. Subcolección `helpers`: `get` para el dueño o para quien tenga `request.auth.token.email.lower() == email` y correo verificado; `list`, `create`, `update`, `delete` solo el dueño; nadie más.

- [ ] **Step 1: Tests que fallan** en `firestore.rules.test.js` (bloque `describe("ayudantes")`), usando `testEnv.authenticatedContext(uid, { email, email_verified })`: dueño añade y borra un ayudante; ayudante actualiza `data`; ayudante no cambia `ownerUid`, no cambia `createdAt`, no añade campos, no borra el torneo, no escribe en `helpers`; un extraño no actualiza; un token con `email_verified: false` no actualiza; una cuenta anónima no actualiza; un correo con mayúsculas en el token coincide con el documento en minúsculas; el ayudante lee solo su propio documento de `helpers` y no el de otro; `get` público del torneo sigue funcionando y no devuelve correos; un torneo sin subcolección se comporta igual que hoy (todos los tests existentes siguen en verde).
- [ ] **Step 2:** `npm run test:rules` → los nuevos fallan.
- [ ] **Step 3:** Implementar las reglas con los contratos de arriba.
- [ ] **Step 4:** `npm run test:rules` completo en verde. **No desplegar**.
- [ ] **Step 5:** Commit `feat: reglas de Firestore para ayudantes de torneo`.

### Task 4: Lógica de correos y de la lista de ayudantes

**Files:**
- Create: `src/logic/helpers.js`, `src/logic/helpers.test.js`

**Interfaces:**
- Produces: `normalizeEmail(raw: string): string` (trim + minúsculas); `isValidEmail(raw): boolean` (forma `algo@dominio.tld`); `MAX_HELPERS = 5`; `validateNewHelper(raw, currentEmails): string | null` devolviendo `"Escribe un correo válido"`, `"Ese correo ya es ayudante"`, `"Máximo 5 ayudantes por torneo"` o `null`.

- [ ] **Step 1: Tests**: `"normalizeEmail quita espacios y pasa a minúsculas"` (`"  Ana@Gmail.COM "` → `"ana@gmail.com"`); `"no normaliza puntos ni alias"` (`"a.na+x@gmail.com"` se conserva); `"validateNewHelper rechaza inválidos, repetidos (sin importar mayúsculas) y el sexto"`; `"acepta un correo nuevo con la lista vacía"`.
- [ ] **Step 2:** Verlos fallar; implementar; verlos pasar.
- [ ] **Step 3:** Commit `feat: lógica de correos de ayudantes`.

### Task 5: Hook para gestionar ayudantes y pantalla del dueño

**Files:**
- Create: `src/hooks/useHelpers.js`, `src/components/shared/HelpersModal.jsx`
- Modify: `src/components/shared/Components.jsx` (`THeader`: botón "👥 Ayudantes" solo si recibe `onHelpers`)
- Test: cubierto por el e2e de la Tarea 7

**Interfaces:**
- Consumes: `normalizeEmail`, `validateNewHelper` (Tarea 4).
- Produces: `useHelpers(code, enabled)` → `{ helpers: string[], loading, add(email): Promise<string|null>, remove(email): Promise<void> }` (`add` devuelve el mensaje de error o `null`; usa `getDocs`, `setDoc`, `deleteDoc` sobre `torneos/{code}/helpers`; sin listeners). `HelpersModal({ code, onClose })`: lista, campo de correo con texto "Debe ser el correo con el que esa persona inicia sesión en Google", confirmación mostrando el correo escrito antes de añadir, botón para quitar.

- [ ] **Step 1:** Implementar el hook y el modal (JS, Tailwind, mobile-first a 390px, estilos del proyecto); `THeader` muestra el botón solo si hay `onHelpers`.
- [ ] **Step 2:** `npm run lint` y `npm run build` limpios.
- [ ] **Step 3:** Commit `feat: pantalla de ayudantes para el dueño del torneo`.

### Task 6: Roles en el cliente

**Files:**
- Modify: `src/hooks/useTournament.js`, `src/TournamentPage.jsx`
- Test: `src/logic/` no aplica; cubierto por la Tarea 7

**Interfaces:**
- Consumes: reglas y contrato de datos (Tarea 3); `HelpersModal` (Tarea 5).
- Produces: `useTournament` devuelve además `isOwner` (lo que hoy es `isAdmin`), `isHelper` y `canScore = isOwner || isHelper`. `isHelper`: al haber `authUser` con correo verificado distinto del dueño y torneo cargado, una sola lectura `getDoc(torneos/{code}/helpers/{correo en minúsculas})`; error de permisos o inexistente → `false`, sin aviso. Se repite al cambiar `authUser`, sin recargar.

- [ ] **Step 1:** Implementar `isOwner`/`isHelper`/`canScore` en el hook (`isAdmin` se mantiene como alias de `isOwner` si algo lo usa fuera de la página).
- [ ] **Step 2:** `TournamentPage`: los componentes `Play*` reciben `isAdmin: canScore`; `SetupAmericano`/`SetupPairs` reciben `isAdmin: isOwner`; `onEditTournament` solo para `isOwner`; el botón "Ayudantes" (`onHelpers`) solo para `isOwner`; un ayudante ve un distintivo "Ayudante" cerca del título; quien no tiene sesión ve un enlace discreto "Iniciar sesión" que hace `signInWithPopup(auth, googleProvider)` con `try/catch` (ignorar `auth/popup-closed-by-user`).
- [ ] **Step 3:** Si el guardado de un ayudante es rechazado por permisos (acceso quitado), el `onFailure` ya revierte a lo último guardado; cambiar el mensaje a "No tienes permiso para guardar en este torneo. Puede que te hayan quitado el acceso." cuando `err.code === "permission-denied"`.
- [ ] **Step 4:** `npx vitest run`, `npm run lint`, `npm run build` en verde.
- [ ] **Step 5:** Commit `feat: roles de dueño y ayudante en la página del torneo`.

### Task 7: Pruebas e2e de ayudantes

**Files:**
- Modify: `e2e/helpers/seed.js` (`addHelper(code, email)`, y `getTestToken(uid, claims)` que acepte `{ email, email_verified }` como developer claims)
- Create: `e2e/tests/ayudantes.spec.js`

**Interfaces:**
- Consumes: todo lo anterior. **Antes de escribir los tests, comprobar** que con el emulador un token personalizado con `email`/`email_verified` llega a las reglas como `request.auth.token.email`; si no, documentar la alternativa en el commit.

- [ ] **Step 1: Tests** (cada uno contra una Liga o un Americano sembrado y en marcha): `"el ayudante carga un resultado, pasa de ronda y finaliza, y el dueño lo ve"`; `"el ayudante no ve Editar torneo, Ayudantes ni lanzar"`; `"un usuario con sesión que no es ayudante ve el torneo como espectador y no ve controles"`; `"el espectador sin sesión ve el enlace Iniciar sesión"`; `"dueño y ayudante guardando a la vez: uno recibe el aviso de conflicto y no se pierde nada del otro"`; `"si el dueño quita al ayudante, su siguiente guardado falla con el aviso de permiso y la pantalla vuelve a lo último guardado"`; `"el dueño añade un ayudante desde la pantalla Ayudantes y aparece en la lista; el sexto da el aviso de máximo"`.
- [ ] **Step 2:** Ejecutarlos contra los emuladores → deben pasar; la suite e2e completa sigue en verde.
- [ ] **Step 3:** Commit `test: pruebas e2e de ayudantes de torneo`.

### Task 8: Documentación y lista de despliegue

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Actualizar §4/§9 (roles dueño, ayudante y espectador; la subcolección `helpers`; control de versión con `writeId`) y §5 si procede; añadir el orden de despliegue: (1) publicar el control de versión (Tareas 1–2); (2) desplegar reglas a mano tras `npm run test:rules` en verde y con aprobación del dueño del producto; (3) publicar la interfaz (Tareas 4–7).
- [ ] **Step 2:** Commit `docs: roles y ayudantes en CLAUDE.md`.

---

## Autorevisión

- **Cobertura del spec:** control de versión → T1–T2; subcolección y reglas → T3; correos exactos, máximo 5 → T4–T5; dueño vs ayudante, enlace "Iniciar sesión", comprobación única y aviso si pierde acceso → T6; pruebas → T3 y T7; despliegue en orden → T8. Sin brechas.
- **Consistencia de nombres:** `VersionConflictError`, `applyVersionedWrite`, `onConflict`, `normalizeEmail`, `validateNewHelper`, `useHelpers`, `HelpersModal`, `isOwner`/`isHelper`/`canScore` se usan igual en todas las tareas.
- **Proporción:** el plan decide interfaces, valores y pruebas; los cuerpos los escribe quien implementa.
