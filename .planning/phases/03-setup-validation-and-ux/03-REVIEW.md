---
phase: 03-setup-validation-and-ux
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/setup/SetupAmericano.jsx
findings:
  critical: 3
  warning: 2
  info: 1
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Se revisó `SetupAmericano.jsx` con foco en los cambios de la Fase 03: banner de advertencia (`showUnratedWarning`/`allUnrated`), botón de re-sorteo (`canReshuffle`/`handleReshuffle`), estado local (`warningDismissed`, `localPrecomputedRounds`, `localRoundWarnings`) y la integración de `localPrecomputedRounds` en `onStart()`.

Se encontraron **3 blockers** relacionados con la caché de `localPrecomputedRounds` que puede quedar obsoleta y persistir datos incorrectos a Firestore. El problema central es la ausencia de invalidación de la caché cuando el estado del torneo cambia después de un re-sorteo. Adicionalmente, `onStart` carece de `try/catch` en violación directa de `CLAUDE.md`.

---

## Critical Issues

### CR-01: `localPrecomputedRounds` se usa sin invalidar cuando la lista de jugadores cambia después del re-sorteo

**File:** `src/components/setup/SetupAmericano.jsx:190`

**Issue:** `handleReshuffle` genera rondas pre-calculadas basadas en el snapshot actual de `t.playerInputs` (con IDs `0..N-1`). Si el usuario luego **agrega o elimina un jugador**, `t.playerInputs` cambia: los IDs de los jugadores se re-asignan en `onStart` (línea 184: `map((p, i) => ({ id: i, ... }))`), pero `localPrecomputedRounds` sigue referenciando los IDs del snapshot anterior. `onStart` en la línea 190 consume `localPrecomputedRounds` sin verificar si sigue siendo válida.

Consecuencia: las rondas pre-calculadas se persisten a Firestore con IDs de jugadores que ya no corresponden al array `players` real del torneo. `PlayAmericano` (línea 134) usa esas rondas para construir la siguiente ronda, produciendo asignaciones de pista incorrectas o referencias a jugadores inexistentes.

**Fix:** Invalidar la caché cuando `t.playerInputs` cambia. La forma más directa es resetear en las funciones `addPlayer` y en el botón de eliminar jugador:

```js
function addPlayer() {
  if (!newName.trim()) return;
  setLocalPrecomputedRounds(null); // invalida caché obsoleta
  setLocalRoundWarnings([]);
  persist({ ...t, playerInputs: [...(t.playerInputs || []), { name: newName.trim(), level: useLevels ? newLvl : 0 }] });
  setNewName("");
  nameInputRef.current?.focus();
}
```

Y en el botón de eliminar (línea 646):
```js
onClick={() => {
  setEditingIdx(null);
  setLocalPrecomputedRounds(null);
  setLocalRoundWarnings([]);
  persist({ ...t, playerInputs: t.playerInputs.filter((_, idx) => idx !== i) });
}}
```

---

### CR-02: `localPrecomputedRounds` no se invalida cuando cambia el número de pistas después del re-sorteo

**File:** `src/components/setup/SetupAmericano.jsx:190`

**Issue:** Las rondas pre-calculadas se generan para un número fijo de pistas (`t.config.courts` en el momento del re-sorteo). Si el usuario cambia el número de pistas después (línea 367, botón de selección de pistas), `t.config.courts` cambia inmediatamente vía `persist`, pero `localPrecomputedRounds` sigue siendo el resultado del sorteo anterior con la cantidad de pistas previa. El botón de re-sorteo muestra "✓ Emparejamiento listo" engañando al usuario.

Cuando `onStart` persiste a Firestore con estas rondas obsoletas, `PlayAmericano` opera con un desajuste entre la cantidad de pistas configurada y las rondas pre-calculadas.

**Fix:** Invalidar la caché al cambiar el número de pistas:

```js
onClick={() => {
  setLocalPrecomputedRounds(null);
  setLocalRoundWarnings([]);
  persist({ ...t, config: { ...t.config, courts: n } });
}}
```

Aplicar el mismo patrón al cambiar `maxRounds` (línea 783) y `useLevels` (línea 522), ya que ambos afectan el resultado de `precomputeAllRounds`.

---

### CR-03: `localPrecomputedRounds` (modo individual) se usa en `onStart` cuando la modalidad cambia a "Parejas" después del re-sorteo

**File:** `src/components/setup/SetupAmericano.jsx:189-193`

**Issue:** `handleReshuffle` tiene guarda `if (isPairs) return` (línea 154), por lo que la caché solo se genera en modo individual. Sin embargo, si el usuario activa el re-sorteo en modo individual y luego cambia la modalidad a "Parejas", `localPrecomputedRounds` sigue siendo no-`null` (contiene rondas de modo individual con arrays de jugadores en `pairA`/`pairB`).

`onStart` a la línea 189 comprueba `matchmaking === "americano"` pero **no comprueba `isPairs`**. En modo "Parejas" con `matchmaking="americano"` (valor por defecto), la condición es `true` y entra al bloque que usa `localPrecomputedRounds` (línea 190-192). Se persisten rondas con estructura individual (`pairA: [jugador, jugador]`) en un torneo de parejas fijas (`pairA: objetoPareja`), provocando un crash o datos incoherentes en `PlayAmericano`.

**Fix:** Agregar guarda `!isPairs` en la condición de uso de la caché dentro de `onStart`:

```js
if (!isPairs && (t.config.matchmaking || "americano") === "americano") {
  if (localPrecomputedRounds !== null) {
    precomputedRounds = localPrecomputedRounds;
    roundWarnings = localRoundWarnings;
  } else {
    const result = precomputeAllRounds(entities, t.config);
    precomputedRounds = result.rounds;
    roundWarnings = result.warnings;
  }
}
```

---

## Warnings

### WR-01: `onStart` es una función `async` sin `try/catch` — violación de CLAUDE.md

**File:** `src/components/setup/SetupAmericano.jsx:179`

**Issue:** `onStart` hace `await persist(...)` en la línea 199 y luego `onExitEdit?.()` en la línea 212, pero no está envuelta en `try/catch`. Si `persist` falla (timeout de Firestore, usuario sin conexión), la promesa rechazada queda sin manejar, el torneo no inicia, y el usuario no recibe ningún feedback. CLAUDE.md §6 establece explícitamente: "Siempre usar try/catch en operaciones async. Nunca dejar Promesas sin manejar."

**Fix:**

```js
async function onStart() {
  try {
    let entities;
    // ... lógica existente ...
    await persist({ ... });
    onExitEdit?.();
  } catch (err) {
    console.error("Error al iniciar el torneo:", err);
    // TODO: mostrar toast de error al usuario (pendiente componente toast)
  }
}
```

---

### WR-02: `warningDismissed` es permanente dentro de la sesión — el banner no vuelve a mostrarse si el estado cambia

**File:** `src/components/setup/SetupAmericano.jsx:55,93`

**Issue:** Una vez que el usuario hace clic en "Continuar", `warningDismissed` se establece en `true` y nunca se resetea. Si el usuario luego borra todos los jugadores y los vuelve a agregar sin niveles (o activa `useLevels` después de haberlo desactivado), `allUnrated` sería `true` de nuevo, pero `showUnratedWarning` permanece `false`. El organizador no recibe el aviso aunque la situación que lo justificaba haya reaparecido.

**Fix:** Resetear `warningDismissed` cuando cambia el estado de `useLevels` o cuando se modifica la lista de jugadores:

```js
// En el toggle de useLevels (línea 522):
onClick={() => {
  setWarningDismissed(false); // resetea el aviso al cambiar la configuración
  persist({ ...t, config: { ...t.config, useLevels: !useLevels } });
}}
```

Alternativamente, calcular `showUnratedWarning` de forma derivada sin estado `dismissed` persistente:
usar un `useRef` para rastrear el `playerInputs.length` en el momento del dismiss, e invalidar si la lista cambia.

---

## Info

### IN-01: Inconsistencia en el mapeo de `level` entre `handleReshuffle` y `onStart`

**File:** `src/components/setup/SetupAmericano.jsx:156,184`

**Issue:** `handleReshuffle` mapea `level: p.level || 0` (línea 156) mientras que `onStart` mapea `level: p.level` sin fallback (línea 184). Si un jugador tiene `level` no definido (datos legacy de Firestore), las entidades pre-calculadas usan `0` pero las entidades persistidas al campo `players` tienen `undefined`. `PlayAmericano` normaliza `undefined` a `0` con `p.level || 0` o `p.level ?? 0` en todos sus usos, por lo que no hay fallo funcional en la versión actual. La inconsistencia es un riesgo de regresión si futuros cambios en `PlayAmericano` no normalizan el nivel.

**Fix:** Unificar el mapeo en `onStart`:

```js
entities = t.playerInputs.map((p, i) => ({
  id: i,
  name: p.name.trim(),
  level: p.level || 0, // consistente con handleReshuffle
  pts: 0,
  gf: 0,
  gc: 0,
}));
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
