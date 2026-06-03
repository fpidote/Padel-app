# Phase 3: Setup Validation and UX - Research

**Researched:** 2026-06-03
**Domain:** React component UI — dismissible warning banner + re-shuffle button in SetupAmericano.jsx
**Confidence:** HIGH

---

## Summary

Esta fase agrega dos piezas de UX a `SetupAmericano.jsx`: (1) un banner de advertencia suave cuando `useLevels=ON` y todos los jugadores tienen nivel 0 ("Sin definir"), y (2) un botón de re-shuffle que vuelve a llamar `precomputeAllRounds()` y reemplaza `precomputedRounds` en estado local sin persistir a Firestore hasta que el organizador pulse "Iniciar Torneo".

Todo el trabajo está contenido en un único archivo (`SetupAmericano.jsx`). No se requieren nuevas dependencias ni cambios en la capa de lógica. El patrón de banner colapsable ya existe en `PlayAmericano.jsx` (`WarningsBanner`) y puede usarse como referencia directa. El patrón de estado local + persist-on-action ya está establecido por `onStart()`.

**Primary recommendation:** Implementar ambos requisitos como adiciones quirúrgicas a `SetupAmericano.jsx` — un nuevo `useState` para el banner descartado, un nuevo `useState` para `localPrecomputedRounds`, y el botón de re-shuffle posicionado inmediatamente debajo de la barra de estado y antes del botón "Iniciar Torneo".

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Level validation gate — si `useLevels=ON` y ningún jugador tiene nivel asignado, mostrar advertencia suave antes de iniciar (el organizador puede confirmar y continuar) | La condición exacta se puede derivar del array `t.playerInputs` y el flag `useLevels`. El patrón de banner descartable existe en PlayAmericano como referencia. |
| SETUP-02 | Re-shuffle button — tras pre-cálculo inicial, el organizador puede volver a llamar `precomputeAllRounds()` para generar un nuevo schedule; el botón desaparece/se deshabilita una vez `t.status === "playing"` | `precomputeAllRounds(entities, t.config)` ya está importado. El estado local `localPrecomputedRounds` sigue el patrón de debounce ya establecido para otros campos. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Level validation gate (SETUP-01) | Browser / Client | — | Derivado de estado local `t.playerInputs` + `useLevels` — no requiere round-trip a Firebase |
| Re-shuffle button (SETUP-02) | Browser / Client | — | Llama a `precomputeAllRounds()` en memoria; el resultado vive en estado local hasta que `onStart()` lo persiste |
| Persist de precomputedRounds | API / Firebase (via useTournament) | — | Sigue el patrón existente: `onStart()` llama a `persist()` con `{ merge: true }` |

---

## Standard Stack

### Core

No se agregan dependencias externas. Todo el trabajo usa el stack existente.

| Librería | Versión | Uso |
|---------|---------|-----|
| React | 18.3.1 | `useState` para estado local del banner y del re-shuffle |
| Tailwind CSS v4 | (vite plugin) | Clases utilitarias para el banner y el botón |

[VERIFIED: codebase — package.json + CLAUDE.md]

### Paquetes externos nuevos

Ninguno.

---

## Package Legitimacy Audit

No se instalan paquetes externos en esta fase. Sección no aplicable.

---

## Architecture Patterns

### Flujo de datos de Phase 3

```
SetupAmericano.jsx
│
├── [Estado local]
│   ├── showUnratedWarning: bool  ← SETUP-01: controla visibilidad del banner
│   ├── warningDismissed: bool    ← SETUP-01: el organizador confirma y continua
│   └── localPrecomputedRounds: Array|null  ← SETUP-02: resultado en memoria
│
├── [Condición de advertencia — SETUP-01]
│   useLevels=ON && playerInputs.every(p => (p.level || 0) === 0)
│   → muestra banner amarillo antes del botón iniciar
│   → el organizador puede descartar (dismiss) y proceder
│
├── [Re-shuffle — SETUP-02]
│   Botón visible cuando: localPrecomputedRounds !== null && t.status !== "playing"
│   onClick → precomputeAllRounds(entities, t.config) → setLocalPrecomputedRounds(result.rounds)
│   No llama persist() — solo actualiza estado local
│
└── [onStart() — sin cambios estructurales]
    Lee localPrecomputedRounds (si existe) en vez de recalcular
    persist({ ...t, precomputedRounds: localPrecomputedRounds, ... })
```

### Estructura de archivos modificados

```
src/
└── components/
    └── setup/
        └── SetupAmericano.jsx   ← único archivo modificado
```

### Patrón 1: Banner de advertencia suave descartable (SETUP-01)

**Qué:** Banner amarillo que aparece cuando `useLevels=ON` y todos los jugadores están en nivel 0 ("Sin definir"). El organizador puede descartarlo y proceder. No bloquea el inicio.

**Cuándo usar:** Inmediatamente antes del botón "Iniciar Torneo", condicionado a `!warningDismissed && allUnrated`.

**Referencia en codebase:** `PlayAmericano.jsx` lines 853-879 — `WarningsBanner` sub-componente con `useState(false)` propio para colapsar/expandir. El patrón de banner en SetupAmericano es más simple (un-time dismiss, no expand/collapse).

```jsx
// [CITED: src/components/play/PlayAmericano.jsx:853-879]
// Patrón existente — banner colapsable en PlayAmericano (referencia de estilo)
function WarningsBanner({ warnings }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-amber-400 text-sm font-bold">⚠️ Restricciones relajadas</span>
        <span className="text-amber-500/60 text-xs font-bold">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-200/80 bg-amber-500/5 rounded-lg px-3 py-2">{w.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Adaptación para SETUP-01** (dismiss en vez de expand/collapse):

```jsx
// [ASSUMED] — patrón derivado de WarningsBanner existente + convenciones del proyecto
// Estado a agregar en SetupAmericano:
const [warningDismissed, setWarningDismissed] = useState(false);

// Condición de activación:
const allUnrated = useLevels && !isPairs &&
  (t.playerInputs || []).length > 0 &&
  (t.playerInputs || []).every(p => (p.level || 0) === 0);
const showUnratedWarning = allUnrated && !warningDismissed;

// JSX (insertar antes del botón Iniciar Torneo, dentro del bloque isAdmin):
{showUnratedWarning && (
  <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-yellow-400">⚠️ Ningún jugador tiene nivel asignado</div>
        <div className="text-xs text-yellow-300/70 mt-1">
          El emparejamiento por niveles no tendrá efecto. Puedes asignar niveles arriba o continuar sin ellos.
        </div>
      </div>
      <button
        onClick={() => setWarningDismissed(true)}
        className="text-yellow-500/60 hover:text-yellow-400 text-xs font-bold shrink-0 cursor-pointer transition-colors"
      >
        Continuar
      </button>
    </div>
  </div>
)}
```

### Patrón 2: Re-shuffle button (SETUP-02)

**Qué:** Botón que re-ejecuta `precomputeAllRounds()` y reemplaza `localPrecomputedRounds` en estado local. No persiste a Firestore. Solo visible cuando `t.status !== "playing"` (es decir, durante el setup).

**Cuándo usar:** Después de que `localPrecomputedRounds` existe (post-cálculo inicial) y antes de que el torneo haya iniciado.

**Estado actual relevante en `onStart()`** [CITED: src/components/setup/SetupAmericano.jsx:156-185]:

```js
// El onStart() actual calcula entities inline:
const entities = t.playerInputs.map((p, i) => ({
  id: i, name: p.name.trim(), level: p.level, pts: 0, gf: 0, gc: 0
}));
const result = precomputeAllRounds(entities, t.config);
precomputedRounds = result.rounds;
roundWarnings = result.warnings;
```

**Diseño para SETUP-02:**

```jsx
// [ASSUMED] — patrón derivado del diseño existente de onStart()
// Estado a agregar:
const [localPrecomputedRounds, setLocalPrecomputedRounds] = useState(null);
const [localRoundWarnings, setLocalRoundWarnings] = useState([]);

// Función de re-shuffle:
function handleReshuffle() {
  if (isPairs) return;
  const entities = (t.playerInputs || []).map((p, i) => ({
    id: i, name: p.name.trim(), level: p.level || 0, pts: 0, gf: 0, gc: 0
  }));
  const result = precomputeAllRounds(entities, t.config);
  setLocalPrecomputedRounds(result.rounds);
  setLocalRoundWarnings(result.warnings);
}

// Condición de visibilidad:
const canReshuffle = !isPairs &&
  (t.config.matchmaking || "americano") === "americano" &&
  localPrecomputedRounds !== null &&
  t.status !== "playing";

// JSX (insertar entre la barra de estado y el botón Iniciar Torneo):
{canReshuffle && (
  <button
    onClick={handleReshuffle}
    className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm border border-gray-700 bg-[#1f2937] text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors cursor-pointer"
  >
    🔀 Re-sortear emparejamiento
  </button>
)}
```

**Integración con `onStart()`:** Si `localPrecomputedRounds !== null`, usar ese valor en vez de recalcular:

```jsx
// [ASSUMED] — modificación quirúrgica en onStart()
// Antes:
const result = precomputeAllRounds(entities, t.config);
precomputedRounds = result.rounds;
roundWarnings = result.warnings;

// Después:
if (localPrecomputedRounds !== null) {
  precomputedRounds = localPrecomputedRounds;
  roundWarnings = localRoundWarnings;
} else {
  const result = precomputeAllRounds(entities, t.config);
  precomputedRounds = result.rounds;
  roundWarnings = result.warnings;
}
```

**Alternativa más simple:** Siempre recalcular en `onStart()` (ignorar `localPrecomputedRounds`). El re-shuffle es solo para previsualización visual; el cálculo final ocurre al iniciar. Esta alternativa es más simple pero el organizador no ve el schedule "aceptado". **Recomendación: usar el estado local para que lo que el organizador "ve" es lo que persiste.**

### Anti-Patterns a Evitar

- **No llamar `persist()` desde `handleReshuffle()`:** El punto central de SETUP-02 es que el re-shuffle es local hasta que el organizador presione "Iniciar". [CITED: REQUIREMENTS.md — "organizer must explicitly start the tournament to persist"]
- **No colocar el banner de advertencia como bloqueo hard:** SETUP-01 dice explícitamente "soft warning, organizer can confirm and proceed". El botón "Iniciar Torneo" debe seguir siendo clickeable.
- **No resetear `warningDismissed` si el organizador cambia los niveles:** Si el organizador asigna un nivel a algún jugador, `allUnrated` pasa a `false` naturalmente y el banner desaparece sin necesidad de resetear el estado.

---

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por qué |
|---------|-------------|----------------|---------|
| Cálculo de emparejamiento | Lógica propia inline | `precomputeAllRounds()` ya existe | La función está completa y testeada (82 tests pasan) |
| Estado de advertencias | Banners custom complejos | Patrón `WarningsBanner` de PlayAmericano | Patrón establecido, coherente visualmente |
| Toast/modal de confirmación | Componente modal complejo | Banner inline descartable | CLAUDE.md prohíbe `alert()` para UX; el banner inline es la alternativa correcta para este caso |

---

## Common Pitfalls

### Pitfall 1: Condición de "todos sin nivel" demasiado estricta o demasiado laxa

**Qué falla:** Si la condición incluye `(t.playerInputs || []).length === 0` (array vacío), el banner aparece cuando aún no hay jugadores, lo cual es confuso.
**Por qué ocurre:** El array vacío hace que `.every()` devuelva `true` (vacuous truth).
**Cómo evitar:** Agregar la guarda `(t.playerInputs || []).length > 0` en la condición `allUnrated`.
**Señales de alerta:** Banner visible inmediatamente al abrir el setup antes de agregar jugadores.

### Pitfall 2: Re-shuffle invalida `localPrecomputedRounds` al cambiar config

**Qué falla:** El organizador hace re-shuffle, luego cambia el número de pistas o rondas. `localPrecomputedRounds` ahora corresponde a una configuración antigua.
**Por qué ocurre:** `handleReshuffle()` captura `t.config` en el momento de la llamada; cambios posteriores no invalidan el estado local.
**Cómo evitar:** Opción A — resetear `localPrecomputedRounds` a `null` cada vez que cambia `t.config.courts` o `t.config.maxRounds`. Opción B — siempre recalcular en `onStart()` (más simple, menos fiel a la intención). **Recomendación: Opción B para esta fase, Opción A si surge feedback.**
**Señales de alerta:** El torneo inicia con un schedule calculado para una config diferente a la actual.

### Pitfall 3: `warningDismissed` persiste tras cambio de estado de niveles

**Qué falla:** El organizador ve el warning, lo descarta, luego resetea todos los niveles a 0. El warning no vuelve a aparecer.
**Por qué ocurre:** `warningDismissed` es un booleano que solo se resetea a `false` manualmente.
**Cómo evitar:** No es necesario intervenir — si el organizador descartó la advertencia, eligió proceder conscientemente. La condición natural `allUnrated && !warningDismissed` es correcta. Si asigna niveles y los vuelve a quitar, `allUnrated` vuelve a ser `true` pero `warningDismissed` ya está en `true` — el organizador ya fue advertido. Aceptable para v1.

### Pitfall 4: Botón re-shuffle visible cuando matchmaking = "mexicano"

**Qué falla:** El botón re-shuffle aparece aunque el organizador seleccionó Mexicano. `precomputeAllRounds()` en modo mexicano devuelve `{ rounds: null, warnings: [] }` y el botón no tendría sentido.
**Por qué ocurre:** La condición de visibilidad no chequea `t.config.matchmaking`.
**Cómo evitar:** Incluir `(t.config.matchmaking || "americano") === "americano"` en `canReshuffle`.

---

## Code Examples

### Firma exacta de precomputeAllRounds

```js
// [CITED: src/logic/americano.js:103-108]
export function precomputeAllRounds(entities, config)
// entities: Array<{ id: number, name: string, level: number, pts: 0, gf: 0, gc: 0 }>
// config: { courts: number, mode: string, maxRounds?: number, ... }
// Returns: { rounds: Array<{courts, sittingOut}> | null, warnings: Array<{round, constraint, message}> }
// rounds es null cuando mode === "pairs"
```

### Valor del nivel "Sin definir"

```js
// [CITED: src/components/setup/SetupAmericano.jsx:14-19]
const LEVELS = [
  { id: 0, label: "Sin definir",  short: "-", color: "#64748b" },
  { id: 1, label: "Principiante", short: "P", color: "#94a3b8" },
  { id: 2, label: "Intermedio",   short: "M", color: "#38bdf8" },
  { id: 3, label: "Avanzado",     short: "A", color: "#84cc16" },
];
// "Sin definir" = nivel 0. El código usa (p.level || 0) como fallback en toda la lógica.
// "Avanzado" es el nivel 3 — el umbral para highLevelClash() en americano.js.
```

### Estado de `ok` (condición de inicio existente)

```js
// [CITED: src/components/setup/SetupAmericano.jsx:80-82]
const ok = isPairs
  ? tot >= 2 && (t.pairInputs || []).every(p => p.p1.trim() && p.p2.trim())
  : tot >= 4 && (t.playerInputs || []).every(p => p.name.trim().length > 0);
// El botón "Iniciar" ya usa `ok` para habilitarse/deshabilitarse.
// SETUP-01 NO modifica `ok` — el warning es soft, no bloquea.
```

### Cómo `onStart()` ya persiste todo

```js
// [CITED: src/components/setup/SetupAmericano.jsx:156-185]
async function onStart() {
  const entities = t.playerInputs.map((p, i) => ({
    id: i, name: p.name.trim(), level: p.level, pts: 0, gf: 0, gc: 0
  }));
  // ...
  const result = precomputeAllRounds(entities, t.config);
  precomputedRounds = result.rounds;
  roundWarnings = result.warnings;
  await persist({
    ...t,
    players: entities,
    currentRound: courts,
    sittingOut,
    status: "playing",
    roundNum: 1,
    rounds: [],
    partnerHistory: {},
    sitOutHistory: {},
    precomputedRounds,   // ← Array o null
    roundWarnings,       // ← Array
  });
  onExitEdit?.();
}
// persist() en useTournament.js usa { merge: true } — nunca sobreescribe ownerUid/createdAt
```

### Botón Iniciar existente (punto de inserción para SETUP-01 y SETUP-02)

```jsx
// [CITED: src/components/setup/SetupAmericano.jsx:779-794]
{isAdmin && (
  <button
    onClick={onStart}
    disabled={!ok}
    className="w-full mt-8 py-4 rounded-2xl font-black text-lg transition-colors"
    style={{
      background: ok ? COLOR : "#374151",
      color:      ok ? "#fff" : "#64748b",
      cursor:     ok ? "pointer" : "not-allowed",
      opacity:    ok ? 1 : 0.5,
    }}
  >
    🎾 Iniciar Torneo
  </button>
)}
// SETUP-01: insertar el banner antes de este bloque (condicionado a showUnratedWarning)
// SETUP-02: insertar el botón re-shuffle entre la barra de estado y este botón
```

---

## Project Constraints (from CLAUDE.md)

Directivas aplicables a esta fase:

| Directiva | Impacto en Phase 3 |
|-----------|-------------------|
| Sin TypeScript | Todo código en JS puro |
| Sin Redux/Zustand | Estado local con `useState` — sin stores externos |
| Sin estilos inline (excepto colores dinámicos de formatos) | Usar clases Tailwind; el banner y el botón de re-shuffle deben usar solo clases Tailwind |
| `persist()` siempre con `{ merge: true }` | `handleReshuffle()` NO llama persist — solo setea estado local |
| Sin listeners en componentes Play/Setup | No aplica — esta fase no agrega listeners |
| Sin `console.log` en producción | Solo `console.error` en bloques catch |
| Todos los async/await con try/catch | `onStart()` ya lo tiene; si `handleReshuffle()` fuera async necesitaría try/catch, pero no lo es |
| Mobile-first, max-w-md | El banner y el botón de re-shuffle deben funcionar correctamente en 390px |
| Commits en español | Ejemplo: `feat: agregar validación de niveles y re-sorteo en SetupAmericano` |
| Sin `alert()` para errores UX | El warning es un banner inline, no un `alert()` |

---

## State of the Art

| Enfoque anterior | Enfoque actual | Cuándo cambió | Impacto |
|-----------------|----------------|---------------|---------|
| No había validación de niveles en el setup | Banner suave pre-inicio cuando todos los niveles son 0 | Phase 3 | El organizador recibe feedback antes de iniciar un torneo donde la feature de niveles no tiene efecto |
| `precomputeAllRounds()` se llamaba solo en `onStart()` | También se puede llamar desde el botón de re-shuffle en estado local | Phase 3 | El organizador puede regenerar el schedule antes de confirmar el inicio |

---

## Assumptions Log

| # | Claim | Section | Risk si es incorrecto |
|---|-------|---------|----------------------|
| A1 | El banner de advertencia de SETUP-01 debe insertarse inmediatamente antes del botón "Iniciar Torneo" (no al tope del componente) | Architecture Patterns / Pitfall 1 | Si debe ir al tope, la inserción cambia de lugar — impacto menor |
| A2 | `handleReshuffle()` debe usar el estado local `localPrecomputedRounds` para que lo que el organizador ve sea lo que persiste | Architecture Patterns — Pitfall 2 | Si se acepta recalcular siempre en `onStart()`, el estado local es solo previsualización — también válido, más simple |
| A3 | La condición `allUnrated` debe incluir guard de array vacío (`length > 0`) | Common Pitfalls / Pitfall 1 | Sin la guard, el banner aparece con la lista vacía — confuso pero no bloqueante |

---

## Open Questions

1. **¿El botón re-shuffle debe activar el cálculo inicial (antes de que exista `localPrecomputedRounds`)?**
   - Lo que sabemos: `onStart()` calcula `precomputedRounds` al iniciar el torneo. `localPrecomputedRounds` empieza en `null`.
   - Lo que es ambiguo: ¿El botón "Re-sortear" debe aparecer desde el primer momento (generando el schedule sin iniciar), o solo después de que el organizador haya presionado algún trigger inicial de cálculo?
   - Recomendación: Hacer que el botón re-shuffle esté visible desde que hay jugadores suficientes para un torneo válido (`ok === true`), y al hacer clic por primera vez calcule y muestre el schedule. Esto alinea con SETUP-02: "after initial pre-calculation" puede referirse a que el re-shuffle mismo hace el primer cálculo en local.

2. **¿Se debe mostrar algún feedback visual del schedule recién calculado en el setup?**
   - Lo que sabemos: `localPrecomputedRounds` existe en memoria pero el componente actual no tiene UI para mostrarlo en setup.
   - Lo que es ambiguo: El requisito SETUP-02 dice "replaces the schedule in local state" — puede ser solo estado interno sin visualización, o puede implicar mostrar algo.
   - Recomendación: Para v1, solo un cambio de texto en el botón ("✓ Emparejamiento listo — Re-sortear") como confirmación visual. No construir un panel de preview del schedule en esta fase.

---

## Environment Availability

Step 2.6: SKIPPED — esta fase no tiene dependencias externas. Solo modifica `SetupAmericano.jsx` usando el stack existente (React, Tailwind, lógica ya importada).

---

## Validation Architecture

> `workflow.nyquist_validation` está explícitamente en `false` en `.planning/config.json`. Sección omitida.

---

## Security Domain

Esta fase no introduce nueva superficie de amenaza:
- `handleReshuffle()` no llama a Firebase — es puramente en memoria
- `isAdmin` sigue siendo el guard correcto para mostrar el banner y el botón (`isAdmin && ...`)
- No se agregan campos nuevos de primer nivel en Firestore — `precomputedRounds` y `roundWarnings` siguen dentro del JSON de `data`

---

## Sources

### Primary (HIGH confidence)
- `src/components/setup/SetupAmericano.jsx` — estructura completa del componente, onStart(), LEVELS, ok condition, botón iniciar (lines 1-799)
- `src/logic/americano.js` — firma de `precomputeAllRounds()`, return shape, valor de nivel "Avanzado" = 3 (lines 103-231)
- `.planning/phases/01-core-penalty-engine/01-01-SUMMARY.md` — return shape `{ rounds, warnings }`, decisiones de diseño, roundWarnings persist pattern
- `.planning/phases/02-playamericano-wire-up/02-01-SUMMARY.md` — WarningsBanner pattern, tab condicional pattern
- `src/components/play/PlayAmericano.jsx` lines 853-879 — implementación de WarningsBanner

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — convenciones de código, regla de `persist({ merge: true })`, prohibición de estilos inline, mobile-first

### Tertiary (LOW confidence)
- Ninguno — toda la investigación se basa en fuentes de primer nivel (codebase real)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stack verificado en package.json y CLAUDE.md
- Architecture: HIGH — basado en lectura directa del componente y su lógica existente
- Pitfalls: HIGH — derivados del código actual y las decisiones de Phase 1/2

**Research date:** 2026-06-03
**Valid until:** N/A — investigación sobre codebase propio; válida hasta que los archivos cambien
