---
phase: 03-setup-validation-and-ux
plan: 01
subsystem: setup-ui
tags: [setup, americano, validation, ux, reshuffle, levels]
requires: [01-01-SUMMARY.md]
provides: [SETUP-01, SETUP-02]
affects: [src/components/setup/SetupAmericano.jsx]
tech_stack:
  added: []
  patterns: [local-state-precompute, dismissible-banner, isAdmin-gate]
key_files:
  modified:
    - src/components/setup/SetupAmericano.jsx
decisions:
  - "canReshuffle no requiere localPrecomputedRounds !== null — el botón también dispara el primer cálculo (Open Question 1 del research resuelto)"
  - "Banner usa token yellow en lugar de amber para distinguir visualmente 'sin nivel' de 'restricciones relajadas'"
  - "handleReshuffle es síncrono sin try/catch — no toca Firebase, no requiere manejo de error"
metrics:
  duration: "2m"
  completed: "2026-06-03T20:27:56Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 1
---

# Phase 03 Plan 01: Setup Americano — Validación de Niveles y Re-sorteo

Banner de advertencia suave para niveles sin asignar (SETUP-01) y botón de re-sorteo de emparejamiento con estado local (SETUP-02) en SetupAmericano.

## What Was Built

Dos features de UX en `SetupAmericano.jsx` que cierran los requisitos SETUP-01 y SETUP-02:

**SETUP-01 — Banner de niveles sin asignar:**
- Aparece cuando `useLevels=ON` y todos los jugadores tienen nivel 0
- Incluye guarda `(t.playerInputs || []).length > 0` para evitar vacuous-truth en array vacío
- Descartable con botón "Continuar" (no bloquea el botón Iniciar Torneo)
- Desaparece automáticamente cuando un jugador recibe nivel distinto de 0
- Gated por `isAdmin` — espectadores no lo ven

**SETUP-02 — Botón de re-sorteo:**
- Visible durante setup cuando matchmaking=americano y ok=true (suficientes jugadores)
- Llama `precomputeAllRounds()` síncrono y guarda resultado SOLO en estado local
- `handleReshuffle` no llama `persist()` — Firestore no muta hasta "Iniciar Torneo"
- Texto dinámico: "🔀 Generar emparejamiento" → "✓ Emparejamiento listo — Re-sortear"
- Oculto cuando `t.status === "playing"` y cuando `matchmaking !== "americano"`

**Integración en onStart():**
- Si `localPrecomputedRounds !== null`, usa el schedule local aceptado por el organizador
- Fallback a `precomputeAllRounds()` si no se re-sorteó antes de iniciar

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Estado local, condiciones derivadas y handleReshuffle | db32ec9 | SetupAmericano.jsx (+23 lines) |
| 2 | Banner SETUP-01, botón SETUP-02 y onStart integrado | 34282c9 | SetupAmericano.jsx (+38 lines, -3 lines) |

## Verification Results

- `npm run build`: limpio (✓ built in ~1s)
- `npm test`: 82 tests passed (3 test files)
- Source: `grep -c "isAdmin && showUnratedWarning\|isAdmin && canReshuffle"` = 2 (ambos gated)
- Source: `handleReshuffle` no contiene `persist(`
- Sin `console.log` introducido
- Sin estilos inline nuevos (solo Tailwind en los bloques nuevos)

## Deviations from Plan

None — plan ejecutado exactamente como escrito.

## Security (T-03-01, T-03-02)

- T-03-01 (Elevation of Privilege): ambos bloques nuevos gated por `{isAdmin && ...}`. `isAdmin` se deriva de `auth.currentUser.uid === t.ownerUid`, no de localStorage.
- T-03-02 (Tampering): `handleReshuffle` no llama `persist()`. El schedule local no llega a Firestore hasta `onStart()` que usa `{ merge: true }` (sin sobreescribir `ownerUid`/`createdAt`).

## Known Stubs

None. El plan no tiene stubs — los dos features están completamente cableados.

## Threat Flags

None. No se introdujeron nuevos endpoints, rutas de auth, ni accesos a archivos fuera del scope previsto.

## Checkpoint Pending

**Task 3 (checkpoint:human-verify):** Verificación visual/funcional en navegador a 390px. Requiere `npm run dev` y confirmación manual por el organizador de que:
1. El banner amarillo aparece/desaparece/se descarta correctamente
2. El botón de re-sorteo funciona y el texto cambia tras el primer cálculo
3. Al iniciar el torneo, el schedule acepta el último re-sorteo
4. El botón desaparece cuando `status=playing` y cuando `matchmaking=mexicano`

## Self-Check: PASSED

- [x] `src/components/setup/SetupAmericano.jsx` existe y fue modificado
- [x] Commit db32ec9 existe: `feat(03-01): agregar estado local, condiciones derivadas y handleReshuffle`
- [x] Commit 34282c9 existe: `feat(03-01): renderizar banner SETUP-01 y botón re-sorteo SETUP-02 en JSX`
- [x] Build limpio, 82 tests verdes
