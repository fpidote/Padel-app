# Firestore Security Rules — Padeldesk

**Fecha:** 2026-06-02
**Alcance:** Colección `torneos/{code}` y sub-colección `partidos/{matchId}`
**Objetivo:** Que nadie pueda sobrescribir un torneo o partido que no le corresponde, sin afectar el flujo actual de la app ni el acceso público de espectadores.

---

## Contexto

### Modelo de datos actual

```
torneos/{code}
  ├── data: string          — JSON.stringify de todo el estado del torneo
  ├── ownerUid: string      — UID del organizador (campo de primer nivel, queryable)
  └── createdAt: Timestamp  — Timestamp de creación (campo de primer nivel, queryable)
```

### Operaciones que realiza la app hoy

| Operación | Quién | Dónde en el código |
|---|---|---|
| `get` (lectura directa) | Cualquiera con el código | `useTournament.js` — `onSnapshot` |
| `list` (query por ownerUid) | Solo el dueño autenticado | `Panel.jsx` — `where("ownerUid","==",uid)` |
| `create` | Usuario autenticado | `Home.jsx` — `onCreate()` |
| `update` (merge) | Solo el dueño | `useTournament.js` — `persist()` |
| `delete` | Solo el dueño | `Panel.jsx` — `onDelete()` |

### Estado actual de las reglas

No existe `firestore.rules` en el proyecto — las reglas activas son las de desarrollo (allow all), lo que significa que cualquier persona puede leer, escribir o borrar cualquier torneo.

---

## Decisiones de diseño

### 1. get vs list separados

Se separan los permisos de lectura en `get` (lectura de un documento por ID) y `list` (queries sobre la colección):

- **`allow get: if true`** — cualquier espectador con el código puede leer el torneo sin autenticarse.
- **`allow list: if auth.uid == ownerUid`** — solo el dueño puede hacer queries. Impide que alguien haga `getDocs(collection("torneos"))` y enumere todos los torneos de la app.

### 2. Inmutabilidad de ownerUid y createdAt

Los campos de primer nivel `ownerUid` y `createdAt` son inmutables después de la creación:

- **En create:** `ownerUid` debe ser igual al UID del usuario autenticado que hace la petición. `createdAt` debe ser el timestamp del servidor (`request.time`).
- **En update:** ambos campos deben conservar el mismo valor que tenían antes de la escritura.

Esto impide el ataque de "robo de torneo": un actor malicioso que conozca el código no puede hacer un `setDoc` que le transfiera la propiedad.

### 3. Validación de tipo del campo data

El campo `data` debe ser `string` tanto en create como en update. Esto garantiza que `JSON.parse(snap.data().data)` nunca reciba un tipo inesperado que cause `SyntaxError` en el cliente.

### 4. Sub-colección partidos/{matchId} como punto de extensión

Se define la sub-colección `partidos/{matchId}` con `allow write: if false` para establecer el contrato de la feature futura de escrituras de jugadores. Cuando se implemente:

```js
// Relajar a:
allow write: if request.auth != null
          && request.auth.uid in resource.data.allowedPlayers;
```

Este diseño evita tener que migrar datos — la sub-colección ya existe en las reglas y se activa cambiando una línea.

---

## Reglas completas

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /torneos/{code} {

      // Lectura directa: cualquiera con el código (espectadores sin login)
      allow get: if true;

      // Query sobre la colección: solo el dueño (Panel.jsx)
      allow list: if request.auth != null
               && request.auth.uid == resource.data.ownerUid;

      // Creación: usuario autenticado, ownerUid propio, createdAt del servidor
      allow create: if request.auth != null
                 && request.resource.data.ownerUid == request.auth.uid
                 && request.resource.data.createdAt == request.time
                 && request.resource.data.data is string;

      // Actualización: solo el dueño, ownerUid y createdAt inmutables
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
        allow write: if false; // activar cuando se implemente la feature
      }
    }
  }
}
```

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `firestore.rules` | Crear — reglas completas |
| `firestore.indexes.json` | Crear — índice compuesto para query de Panel |
| `firebase.json` | Modificar — agregar sección `firestore` |

### firestore.indexes.json

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

---

## Invariantes garantizados

| Ataque / Error | Regla que lo previene |
|---|---|
| Espectador sobrescribe un torneo ajeno | `update` requiere `auth.uid == ownerUid` |
| Actor malicioso cambia el `ownerUid` para robar el torneo | `update` bloquea mutación de `ownerUid` |
| Alguien enumera todos los torneos de la plataforma | `list` restringido al dueño |
| `data` guardado como objeto en lugar de string | `data is string` en create y update |
| Creación con `ownerUid` de otro usuario | `ownerUid == request.auth.uid` en create |

---

## Lo que NO cambia

- El código de `useTournament.js`, `Home.jsx`, `Panel.jsx` y todos los componentes Play/Setup no necesita ninguna modificación. Las reglas son compatibles con todas las operaciones actuales.
- Los espectadores anónimos siguen pudiendo leer torneos con el código sin autenticarse.
- El organizador sigue pudiendo editar nombres, jugadores, resultados y configuración sin restricción — todo eso vive en el campo `data` que las reglas no inspeccionan.

---

## Próximos pasos (fuera de alcance de este spec)

- Cuando se implemente escritura de jugadores: migrar resultados de partidos a `torneos/{code}/partidos/{matchId}` y relajar la regla `allow write` de la sub-colección.
- Antes del deploy a producción: correr `firebase emulator:start` y verificar que las reglas pasan para todos los flujos (crear torneo, editar, borrar, Panel query, espectador).
