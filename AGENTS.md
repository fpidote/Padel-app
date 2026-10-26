# AGENTS.md

Reglas del proyecto Padeldesk para agentes de código. El detalle completo está en CLAUDE.md.

## Stack
React 18 + Vite 5 + Firebase 12 (Auth + Firestore) + React Router 7 + Tailwind v4. JavaScript puro: **sin TypeScript**, sin Redux ni Zustand.

## Comandos
- `npm run dev` / `npm run build` / `npm run lint`
- `npm run test` (Vitest). Un archivo: `npx vitest run src/logic/americano.test.js`

## Reglas críticas
- Cada torneo es `torneos/{code}` con `{ data: string, ownerUid, createdAt }`. `ownerUid` y `createdAt` son campos de primer nivel, **nunca** dentro del JSON de `data`.
- El `persist` usa siempre `setDoc(..., { merge: true })` e incrementa `ver` en 1.
- Los listeners de Firestore viven solo en `src/hooks/useTournament.js`. No crear listeners en componentes Play/Setup.
- Admin = `auth.currentUser.uid === t.ownerUid`. Nunca usar localStorage para permisos.
- Toda operación async lleva try/catch con `console.error` en el catch. Sin `console.log`.
- Inputs que persisten: estado local inmediato + persist con debounce de 600ms.

## Estilos
- Tailwind en clases utilitarias. Sin estilos inline, salvo colores dinámicos de formatos (`style={{ color: tt.color }}`).
- Mobile-first (390px), contenido en `max-w-md mx-auto`.

## Estructura
- `src/logic/`: lógica pura de cada formato (americano, relampago, mundialito, pozo, liga) con sus tests.
- `src/components/{play,setup,shared}/`: UI.
- Mantener la lógica en `src/logic/` testeable y sin dependencias de React o Firebase.

## Flujo de trabajo
- No tocar archivos fuera de la tarea pedida. Hay cambios sin commitear en el árbol de trabajo.
- Ejecutar `npm run test` y `npm run build` antes de dar una tarea por terminada.
- Commits en español: `tipo: descripción corta` (`feat`, `fix`, `refactor`, `style`, `docs`, `chore`).
