# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Padeldesk — Guía de Desarrollo para Claude

> Este archivo define los estándares, convenciones y contexto técnico del proyecto.
> Trátalo como si fuera el handbook de ingeniería de una empresa de producto seria.
> Cada decisión aquí existe por una razón — respétala o justifica el cambio antes de modificarla.

---

## 0. Comandos

```bash
npm run dev          # Servidor de desarrollo (Vite, puerto 5173)
npm run build        # Build de producción (dist/)
npm run preview      # Previsualizar el build de producción
npm run lint         # ESLint sobre todo el proyecto
npm run test         # Ejecutar todos los tests con Vitest
npx vitest run src/logic/americano.test.js   # Ejecutar un archivo de test individual
npx vitest run --reporter=verbose            # Tests con output detallado
npm run test:rules   # Tests de Firestore Security Rules (requiere emulador)
```

Los tests usan **Vitest**. Para mockear dependencias no-deterministas (como `shuffle`) usar `vi.mock('./utils.js', ...)`.

---

## 1. Contexto del Producto

**Padeldesk** (padeldesk.app) es una web app de organización de torneos de pádel en tiempo real.
- Los **organizadores** crean torneos, configuran jugadores y cargan resultados.
- Los **jugadores/espectadores** siguen el torneo en vivo desde un link compartido por WhatsApp.
- No hay backend propio — Firebase es la única infraestructura.
- El producto es **gratuito**, con monetización futura vía Google AdSense.

---

## 2. Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.3.1 | UI |
| Vite | 5.x | Bundler |
| Firebase | 12.x | Auth + Firestore |
| React Router DOM | 7.x | Routing |
| Tailwind CSS | v4 (vite plugin) | Estilos |
| JavaScript | ES2022 | Sin TypeScript |

**Sin TypeScript.** No sugerirlo, no introducirlo. El proyecto es JavaScript puro y así se queda hasta decisión explícita del equipo.

---

## 3. Arquitectura del Proyecto

```
src/
├── App.jsx                  # Solo rutas, sin lógica
├── Home.jsx                 # Landing page + creación de torneos
├── TournamentPage.jsx       # Dispatcher: carga torneo y renderiza el componente correcto
├── Panel.jsx                # Panel del organizador (mis torneos)
├── firebase.js              # Inicialización de Firebase (db, auth, googleProvider)
├── index.css                # Tailwind + @theme con variables de color
├── main.jsx                 # Entry point con BrowserRouter
├── components/
│   ├── play/                # PlayAmericano, PlayRelampago, PlayMundialito, PlayPozo
│   ├── setup/               # SetupAmericano, SetupPairs
│   └── shared/              # Components.jsx, History.jsx, MatchCard.jsx, PairStandings.jsx
├── hooks/
│   └── useTournament.js     # Hook central: Firebase listener + persist + auth
└── logic/
    ├── americano.js         # Lógica de rondas del Americano
    ├── relampago.js         # Lógica de bracket (double elimination)
    ├── mundialito.js        # Lógica de grupos + KO
    ├── pozo.js              # Lógica de King of the Hill
    ├── initTournament.js    # buildInitialTournament(type, ownerUid)
    ├── constants.js         # TOURNAMENT_TYPES, generateRules(type, config), B() (legacy)
    ├── stats.js             # calculateStats(matches) — estadísticas agregadas por jugador
    └── utils.js             # shuffle, pk, genCode
```

### Rutas

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `Home` | Landing page pública |
| `/torneo/:code` | `TournamentPage` | Vista del torneo (admin + espectador) |
| `/panel` | `Panel` | Panel del organizador (requiere auth) |
| `/perfil` | Perfil (pendiente) | Perfil del usuario |

### TournamentPage — lógica de dispatch

`TournamentPage` hace lazy loading de todos los componentes Play/Setup con `React.lazy` + `Suspense`. El dispatch sigue esta lógica:

- Si `t.status === "setup"` **o** `editMode === true` → renderiza Setup
- Si no → renderiza Play según `t.type`
- `editMode` se bloquea cuando `t.scoringStarted === true` (el organizador no puede editar una vez que hay resultados)

---

## 4. Firebase y Data Layer

### Estructura del documento en Firestore

Cada torneo es un documento en la colección `torneos/{code}`:

```js
{
  data: string,        // JSON.stringify del estado completo del torneo
  ownerUid: string,    // UID del organizador (campo de primer nivel, queryable)
  createdAt: Timestamp // Timestamp de creación (campo de primer nivel, queryable)
}
```

> ⚠️ CRÍTICO: `ownerUid` y `createdAt` son campos de primer nivel —
> NO van dentro del JSON de `data`. Esto permite hacer queries en Firestore.
> Nunca moverlos dentro de `data`.

### Regla de oro del persist

```js
// SIEMPRE usar { merge: true } en el persist para no sobreescribir ownerUid/createdAt
await setDoc(doc(db, "torneos", code), {
  data: JSON.stringify(newT),
}, { merge: true });
```

> Sin `{ merge: true }`, cada `persist` borra `ownerUid` y `createdAt` del documento.
> Este bug ya ocurrió — no repetirlo.

### Versioning anti-race-condition

El estado del torneo tiene un campo `ver` (integer). Cada `persist` incrementa `ver` en 1.
El listener de `onSnapshot` ignora actualizaciones con `ver <= verRef.current` para evitar loops.

```js
// En useTournament.js
if (!data || data.ver <= verRef.current) return;
verRef.current = data.ver;
setT(data);
```

### Auth

- Organizadores: **Google Auth** (`signInWithPopup` con `GoogleAuthProvider`)
- Espectadores/jugadores: acceso anónimo sin login
- `isAdmin = auth.currentUser.uid === t.ownerUid`
- El flag de admin **no** usa localStorage — es puro Firebase Auth

---

## 5. Formatos de Torneo

| ID | Nombre | Componentes | Descripción |
|---|---|---|---|
| `americano` | Americano | `SetupAmericano` + `PlayAmericano` | Rotativo por nivel, parejas cambian cada ronda |
| `relampago` | Relámpago | `SetupPairs` + `PlayRelampago` | Double elimination (bracket principal + revancha) |
| `mundialito` | Mundialito | `SetupPairs` + `PlayMundialito` | Fase de grupos estilo FIFA + eliminatorias |
| `pozo` | El Pozo | `SetupPairs` + `PlayPozo` | King of the Hill con timer por ronda |

### Ciclo de vida de un torneo

```
status: "setup"   → usuario configura jugadores/parejas
status: "playing" → torneo en curso, rondas activas
status: "finished"→ torneo terminado (pendiente implementar)
```

---

## 6. Convenciones de Código

### Nomenclatura

- **Componentes**: PascalCase — `PlayAmericano`, `SetupPairs`
- **Hooks**: camelCase con prefijo `use` — `useTournament`
- **Funciones de lógica**: camelCase descriptivo — `buildRoundAmericano`, `advanceBracket`
- **Constantes**: UPPER_SNAKE_CASE — `TOURNAMENT_TYPES`, `TOURNAMENT_RULES`
- **Variables locales**: camelCase — `currentRound`, `isAdmin`
- **Archivos**: camelCase para lógica/hooks, PascalCase para componentes

### Estructura de componentes React

```jsx
// 1. Imports (React primero, luego librerías, luego internos)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { TOURNAMENT_TYPES } from "../logic/constants";

// 2. Componente con nombre descriptivo
export default function NombreComponente({ prop1, prop2 }) {
  // 3. Hooks al inicio
  const [estado, setEstado] = useState(null);

  // 4. Efectos
  useEffect(() => { ... }, []);

  // 5. Handlers (funciones async con try/catch)
  async function handleAccion() {
    try {
      // lógica
    } catch (err) {
      console.error("Contexto del error:", err);
      // feedback al usuario si corresponde
    }
  }

  // 6. Render
  return ( ... );
}
```

### Manejo de errores

**Siempre** usar try/catch en operaciones async. Nunca dejar Promesas sin manejar.

```js
// ✅ Correcto
async function onCreate() {
  try {
    await setDoc(...);
    navigate(`/torneo/${code}`);
  } catch (err) {
    console.error("Error al crear torneo:", err);
    alert("No se pudo crear el torneo. Intenta de nuevo.");
  }
}

// ❌ Incorrecto
async function onCreate() {
  await setDoc(...); // sin try/catch
  navigate(`/torneo/${code}`);
}
```

### Commits

- En **español**
- Formato: `tipo: descripción corta`
- Tipos: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`
- Ejemplos:
  - `feat: agregar timer por ronda en El Pozo`
  - `fix: corregir persist con merge true para no sobreescribir ownerUid`
  - `refactor: dividir useTournament en hooks más pequeños`

---

## 7. Estilos y Diseño

### Sistema de colores (definido en `index.css` con `@theme`)

```css
--color-bg: #0f172a          /* Fondo principal */
--color-card: #1e293b        /* Cards y superficies */
--color-card-hover: #263349  /* Hover de cards */
--color-border: #334155      /* Bordes */
--color-accent: #38bdf8      /* Cyan — acento secundario */
--color-accent-dark: #0284c7
--color-ink: #f1f5f9         /* Texto principal */
--color-muted: #64748b       /* Texto secundario */
--color-success: #22c55e
--color-warning: #f59e0b
--color-danger: #ef4444
```

**Acento principal de la landing:** `#84cc16` (verde lima) — solo en `Home.jsx`.

### Colores de formatos (dinámicos, en `constants.js`)

```js
americano: "#0284c7"   // azul
relampago: "#7c3aed"   // violeta
mundialito: "#059669"  // verde
pozo: "#d97706"        // naranja/dorado
```

### Reglas de estilo

1. **Tailwind CSS** para todos los estilos — clases utilitarias en el JSX
2. **Sin estilos inline** excepto colores dinámicos de formatos (`style={{ color: tt.color }}`)
3. **Mobile-first** — diseñar para 390px primero, luego ajustar para desktop
4. **Max width**: `max-w-md` (448px) centrado con `mx-auto` para el contenido principal
5. La función `B()` de `constants.js` es legado — no usarla en componentes nuevos, usar Tailwind
6. **Nunca** mezclar Tailwind con estilos inline en el mismo elemento

### Jerarquía visual

- **CTA principal**: `bg-[#84cc16] text-[#14532d] font-black` — siempre el elemento más prominente
- **Cards**: `bg-[#1f2937] rounded-2xl border border-[#374151]`
- **Texto primario**: `text-gray-50`
- **Texto secundario**: `text-gray-400`

---

## 8. Buenas Prácticas de Performance

### Inputs y debounce

Los inputs que persisten a Firestore **deben tener estado local** separado del estado remoto.
El estado local se actualiza instantáneamente (sin debounce). El persist a Firestore usa debounce de 600ms.

```jsx
// ✅ Correcto — input fluido
const [localValue, setLocalValue] = useState(initialValue);
const debRef = useRef(null);

function handleChange(val) {
  setLocalValue(val);                          // Actualización inmediata
  clearTimeout(debRef.current);
  debRef.current = setTimeout(() => {          // Persist con debounce
    persist({ ...t, field: val });
  }, 600);
}

// ❌ Incorrecto — input lento
function handleChange(val) {
  persist({ ...t, field: val }); // Bloquea el input esperando Firebase
}
```

### Listeners de Firestore

- Siempre limpiar los listeners en el return del `useEffect`
- El `onSnapshot` principal vive en `useTournament.js` — no crear listeners adicionales en componentes

```js
useEffect(() => {
  const unsub = onSnapshot(ref, handler);
  return () => unsub(); // Limpieza obligatoria
}, [dependency]);
```

---

## 9. Seguridad

- **Admin**: verificado siempre via `auth.currentUser.uid === t.ownerUid`
- **Nunca** usar `localStorage` para determinar permisos de admin
- **Nunca** confiar en datos del cliente para operaciones sensibles
- Las Firestore Rules deben validar `ownerUid` en producción (pendiente reforzar antes del deploy)

---

## 10. Lo que NO hacer

| ❌ Prohibido | ✅ Alternativa |
|---|---|
| Usar TypeScript | JavaScript puro |
| Usar Redux o Zustand | `useTournament.js` hook central |
| Estilos inline (excepto colores dinámicos) | Clases Tailwind |
| `setDoc` sin `{ merge: true }` en `persist` | Siempre `{ merge: true }` |
| Crear listeners en componentes Play/Setup | Solo en `useTournament.js` |
| `console.log` en producción | `console.error` solo en catch |
| Strings de routing hardcodeados en componentes | `useNavigate` de React Router |
| `alert()` para errores de UX | Componente de error/toast (pendiente implementar) |
| Guardar `ownerUid` dentro del JSON de `data` | Campo de primer nivel en Firestore |

---

## 11. Deuda Técnica Conocida (no introducir más)

- `useTournament.js` mezcla sync, auth y persist — candidato a dividir en el futuro
- Componentes de Play y Setup aún usan la función `B()` y estilos inline — migrar a Tailwind progresivamente
- Sin manejo formal de errores de Firestore (timeout, offline) — mostrar estado de error al usuario
- Sin tests — prioridad baja por ahora pero no empeorar la testabilidad del código

---

## 12. Checklist antes de cada PR

- [ ] Build limpio (`npm run build` sin errores)
- [ ] Probado en mobile (390px) y desktop
- [ ] Sin `console.log` en el código
- [ ] Todos los async/await tienen try/catch
- [ ] El `persist` usa `{ merge: true }`
- [ ] Sin estilos inline nuevos (excepto colores dinámicos de formatos)
- [ ] Commit en español con formato correcto
