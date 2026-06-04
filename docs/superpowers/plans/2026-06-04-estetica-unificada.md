# Unificación Estética Padeldesk — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar la estética de toda la app: Bricolage Grotesque como tipografía global, gradiente por formato en el header del torneo, tabs con acento lima, Panel rediseñado en Tailwind, y migración de inline styles legacy.

**Architecture:** 6 tareas independientes en orden de capas. La Tarea 1 (fundación) debe ir primero — instala la fuente que todas las demás asumen. Las Tareas 2–6 son autónomas entre sí.

**Tech Stack:** React 18, Tailwind CSS v4 (vite plugin), Vite, JavaScript ES2022.

**Spec:** `docs/superpowers/specs/2026-06-04-estetica-unificada-design.md`

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | Agregar Google Fonts (Bricolage Grotesque) |
| `src/index.css` | `font-family` del body |
| `src/Home.jsx` | Unificar colores de fondo, limpiar inline styles del dropdown |
| `src/components/shared/Components.jsx` | Reescribir THeader, Tabs, SimpleModal, PTag, PName, PairName en Tailwind |
| `src/Panel.jsx` | Rediseño completo en Tailwind, eliminar `B()` |
| `src/TournamentPage.jsx` | Migrar estado de carga, ajustar color CTA en error/notFound |
| `src/components/shared/History.jsx` | Unificar 2 colores hardcodeados |
| `src/components/shared/PairStandings.jsx` | Migrar inline styles a Tailwind |
| `src/components/play/PlayPozo.jsx` | Reemplazar 4 llamadas `B()` |
| `src/components/play/PlayMundialito.jsx` | Reemplazar 1 llamada `B()` |

---

## Tarea 1: Fundación global

**Archivos:** `index.html`, `src/index.css`, `src/Home.jsx`

- [ ] **Paso 1: Agregar Google Fonts en index.html**

Abrir `index.html`. Dentro de `<head>`, antes del `</head>`, agregar:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
```

- [ ] **Paso 2: Actualizar font-family en index.css**

En `src/index.css`, dentro de `@layer base { body { ... } }`, cambiar la línea de `font-family`:

```css
/* Antes */
font-family: system-ui, -apple-system, sans-serif;

/* Después */
font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
```

- [ ] **Paso 3: Unificar fondo en Home.jsx**

En `src/Home.jsx` línea 101, el wrapper principal:

```jsx
/* Antes */
<div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>

/* Después — quitar bg-[#111827] → bg-[#0f172a], eliminar style inline */
<div className="min-h-screen bg-[#0f172a] text-gray-50">
```

- [ ] **Paso 4: Unificar color de superficie en Home.jsx (modal)**

Línea ~115, el modal de selección de formato:

```jsx
/* Antes */
<div ref={modalRef} className="w-full max-w-sm bg-[#1f2937] rounded-2xl p-6">

/* Después */
<div ref={modalRef} className="w-full max-w-sm bg-[#1e293b] rounded-2xl p-6">
```

- [ ] **Paso 5: Migrar el dropdown del usuario a Tailwind**

En `src/Home.jsx`, buscar el bloque que empieza en `{menuOpen && (` (alrededor de línea 185). Reemplazar el div interior que usa el objeto de inline styles por:

```jsx
{menuOpen && (
  <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e293b] border border-[#374151] rounded-xl min-w-[180px] z-50 overflow-hidden">
    {[
      { icon: "📋", label: "Mis torneos", action: () => { setMenuOpen(false); navigate("/panel"); } },
      { icon: "👤", label: "Mi perfil",   action: () => { setMenuOpen(false); navigate("/perfil"); } },
    ].map((item) => (
      <button
        key={item.label}
        onClick={item.action}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-0 text-gray-50 text-sm cursor-pointer text-left hover:bg-[#374151] transition-colors"
      >
        <span>{item.icon}</span>{item.label}
      </button>
    ))}
    <div className="border-t border-[#374151] my-1" />
    <button
      onClick={() => { setMenuOpen(false); signOut(auth); }}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-0 text-gray-50 text-sm cursor-pointer text-left hover:bg-[#374151] transition-colors"
    >
      <span>🚪</span>Salir
    </button>
  </div>
)}
```

- [ ] **Paso 6: Build y verificar**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
```

Resultado esperado: build limpio sin errores. Verificar visualmente en el browser que la fuente cambió (el texto se ve diferente a system-ui).

- [ ] **Paso 7: Commit**

```bash
git add index.html src/index.css src/Home.jsx
git commit -m "style: aplicar Bricolage Grotesque y unificar colores de fondo"
```

---

## Tarea 2: Components.jsx — reescritura completa

**Archivo:** `src/components/shared/Components.jsx`

Este archivo define los 6 componentes compartidos que aparecen en todas las vistas de torneo. Se reescribe completo en Tailwind, eliminando todos los inline styles y la dependencia de `B()`.

- [ ] **Paso 1: Reemplazar el contenido completo del archivo**

Reemplazar todo el contenido de `src/components/shared/Components.jsx` con:

```jsx
// src/components/shared/Components.jsx
import { TOURNAMENT_TYPES } from '../../logic/constants';

export function THeader({ t, code, isAdmin, copyCode, subtitle, onEdit }) {
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];
  return (
    <div
      className="px-4 py-3.5 flex items-start justify-between"
      style={{
        background: `linear-gradient(135deg, ${typeInfo.color}22 0%, #0f172a 70%)`,
        borderBottom: `1px solid ${typeInfo.color}30`,
      }}
    >
      <div>
        <div className="text-lg font-black text-[#f1f5f9]">
          {typeInfo.icon} {t.config.name}
        </div>
        <div className="text-xs text-[#64748b] mt-0.5">{subtitle}</div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-[#64748b] hover:text-[#f1f5f9] bg-transparent border-0 cursor-pointer underline p-0 mt-1 transition-colors"
          >
            ✏️ Editar torneo
          </button>
        )}
      </div>
      <div className="flex gap-1.5 items-center flex-shrink-0 ml-3">
        {isAdmin && (
          <span className="bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/30 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
            👑 Admin
          </span>
        )}
        <button
          onClick={copyCode}
          className="bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer hover:text-[#f1f5f9] transition-colors whitespace-nowrap"
        >
          🔗 {code}
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, setActive }) {
  return (
    <div className="flex border-b border-[#1e293b]">
      {tabs.map(([tb, lbl]) => (
        <button
          key={tb}
          onClick={() => setActive(tb)}
          className={`flex-1 py-3 text-sm cursor-pointer bg-transparent border-0 border-b-2 transition-colors ${
            active === tb
              ? 'text-[#f1f5f9] font-bold border-[#84cc16]'
              : 'text-[#64748b] font-semibold border-transparent'
          }`}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

export function PTag({ p }) {
  if (!p || p.level === undefined) return null;
  const isLevel1 = p.level === 1;
  return (
    <span
      className={`inline-block text-[10px] rounded-full px-1.5 py-px ml-1 border ${
        isLevel1
          ? 'bg-[#0284c7]/10 text-[#38bdf8] border-[#0284c7]/30'
          : 'bg-[#16a34a]/10 text-[#4ade80] border-[#16a34a]/30'
      }`}
    >
      N{p.level}
    </span>
  );
}

export function PName({ pair }) {
  return (
    <>
      {pair.map((p, i) => (
        <span key={p.id}>
          {i > 0 && <span className="text-[#94a3b8]"> & </span>}
          {p.name}
          <PTag p={p} />
        </span>
      ))}
    </>
  );
}

export function PairName({ pair, showNames = true }) {
  if (!pair) return <span className="text-[#64748b]">TBD</span>;
  return (
    <span className="font-bold text-[#fbbf24]">
      {showNames ? `${pair.p1} / ${pair.p2}` : `Par ${pair.id + 1}`}
    </span>
  );
}

export function SimpleModal({ message, onClose, onConfirm, confirmLabel, icon }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-7 max-w-xs w-full text-center shadow-2xl">
        {icon && <div className="text-3xl mb-3">{icon}</div>}
        <div className="text-sm font-semibold text-[#f1f5f9] mb-5 leading-relaxed">{message}</div>
        <div className="flex gap-2.5 justify-center">
          {onConfirm && (
            <button
              onClick={onClose}
              className="flex-1 bg-[#334155] text-[#94a3b8] rounded-xl py-2.5 font-bold text-sm cursor-pointer border-0"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={onConfirm || onClose}
            className={`flex-1 rounded-xl py-2.5 font-bold text-sm cursor-pointer ${
              onConfirm
                ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                : 'bg-[#0284c7]/10 text-[#38bdf8] border border-[#0284c7]/20'
            }`}
          >
            {onConfirm ? (confirmLabel || 'Eliminar') : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Build y verificar**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Resultado esperado: build limpio, tests pasando. Abrir un torneo en el browser y verificar que el header muestra el gradiente del color del formato (azul para Americano, violeta para Relámpago, etc.) y que las tabs usan subrayado lima en el activo.

- [ ] **Paso 3: Commit**

```bash
git add src/components/shared/Components.jsx
git commit -m "refactor: reescribir Components.jsx en Tailwind — THeader con gradiente por formato, tabs con acento lima"
```

---

## Tarea 3: Panel.jsx — rediseño completo

**Archivo:** `src/Panel.jsx`

Rediseño completo: cards con borde del color del formato, botones con jerarquía visual clara, empty state, eliminar `B()`.

- [ ] **Paso 1: Reemplazar el bloque return completo**

Mantener todo el código antes del `return` (hooks, efectos, `onDelete`, constante `STATUS`) sin cambios. Reemplazar únicamente el `return (...)` con:

```jsx
  if (user === undefined) return null;

  return (
    <>
      <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] px-4 py-6">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-sm text-[#94a3b8] hover:text-[#f1f5f9] cursor-pointer transition-colors flex-shrink-0"
            >
              ←
            </button>
            <h1 className="text-xl font-black text-[#f1f5f9]">Mis torneos</h1>
            {!loading && torneos.length > 0 && (
              <span className="ml-auto text-sm font-semibold text-[#64748b]">
                {torneos.length} {torneos.length === 1 ? "torneo" : "torneos"}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <p className="text-[#64748b] text-center text-sm animate-pulse">Cargando...</p>
          )}

          {/* Empty state */}
          {!loading && torneos.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center text-3xl">
                🏓
              </div>
              <div>
                <p className="text-base font-bold text-[#f1f5f9] mb-1">Sin torneos todavía</p>
                <p className="text-sm text-[#64748b] leading-relaxed">
                  Creá tu primer torneo y compartilo con tus jugadores.
                </p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="bg-[#84cc16] text-[#14532d] font-black rounded-xl px-6 py-2.5 text-sm cursor-pointer border-0 mt-1"
              >
                + Crear torneo
              </button>
            </div>
          )}

          {/* Lista de torneos */}
          <div className="flex flex-col gap-3">
            {torneos.map((t) => {
              const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type);
              const s = STATUS[t.status] ?? STATUS.finished;
              return (
                <div
                  key={t.code}
                  className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden"
                >
                  {/* Card body */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderLeft: `3px solid ${typeInfo?.color ?? "#334155"}` }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${typeInfo?.color ?? "#334155"}18` }}
                    >
                      {typeInfo?.icon ?? "🏓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-[#f1f5f9] truncate">{t.name}</div>
                      <div className="text-xs text-[#64748b] mt-0.5">
                        {typeInfo?.name ?? t.type}
                        {t.createdAt && (
                          <>
                            {" · "}
                            {t.createdAt.toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-bold rounded-full px-2.5 py-0.5 border flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                      style={{ color: s.color, background: s.bg, borderColor: s.border }}
                    >
                      {t.status === "playing" && (
                        <span
                          className="animate-pulse w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: s.color }}
                        />
                      )}
                      {s.label}
                    </span>
                  </div>

                  {/* Card footer */}
                  <div className="flex border-t border-[#334155]">
                    <button
                      onClick={() => navigate(`/torneo/${t.code}`)}
                      className="flex-1 py-2.5 text-sm font-bold cursor-pointer bg-transparent border-0 transition-colors hover:bg-[#263349]"
                      style={{ color: typeInfo?.color ?? "#94a3b8" }}
                    >
                      Entrar →
                    </button>
                    <div className="w-px bg-[#334155]" />
                    <button
                      onClick={() => onDelete(t.code)}
                      className="px-4 py-2.5 text-sm text-[#64748b] hover:text-[#ef4444] hover:bg-[#ef4444]/5 cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {modalMsg && (
        <SimpleModal
          message={modalMsg.message}
          onClose={() => setModalMsg(null)}
          onConfirm={modalMsg.onConfirm}
          icon="🗑️"
        />
      )}
    </>
  );
```

- [ ] **Paso 2: Quitar el import de `B` en Panel.jsx**

Al inicio del archivo, cambiar:
```js
/* Antes */
import { TOURNAMENT_TYPES, B } from "./logic/constants";

/* Después */
import { TOURNAMENT_TYPES } from "./logic/constants";
```

- [ ] **Paso 3: Quitar el `style={{ fontFamily: "system-ui" }}` del wrapper raíz**

El wrapper raíz del return anterior tenía `fontFamily: "system-ui"` en inline style. Al reemplazar el return completo en el Paso 1 ya quedó eliminado — verificar que el nuevo JSX no lo contiene.

- [ ] **Paso 4: Build y verificar**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Resultado esperado: build limpio, tests pasando. Abrir `/panel` en el browser y verificar: cards con borde izquierdo de color, botón "Entrar" con color del formato, botón de borrar discreto (🗑), empty state si no hay torneos.

- [ ] **Paso 5: Commit**

```bash
git add src/Panel.jsx
git commit -m "refactor: rediseñar Panel en Tailwind — cards por formato, jerarquía de botones, empty state"
```

---

## Tarea 4: TournamentPage — estados de carga y error

**Archivo:** `src/TournamentPage.jsx`

- [ ] **Paso 1: Migrar el estado de carga inline a Tailwind**

En `src/TournamentPage.jsx`, buscar:

```jsx
if (!t)
  return (
    <div style={{ padding: 20, textAlign: "center", color: "#f1f5f9" }}>
      Cargando...
    </div>
  );
```

Reemplazar con:

```jsx
if (!t)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-sm font-semibold text-[#64748b] animate-pulse">Cargando torneo...</span>
    </div>
  );
```

- [ ] **Paso 2: Actualizar el botón CTA en el estado notFound**

Buscar el botón "Volver al inicio" dentro del bloque `if (notFound)`:

```jsx
/* Antes */
<button
  onClick={() => navigate("/")}
  className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-[#0284c7] hover:bg-sky-500 text-white cursor-pointer transition-colors"
>
  Volver al inicio
</button>
```

Reemplazar con:

```jsx
<button
  onClick={() => navigate("/")}
  className="mt-2 w-full py-3 rounded-xl font-black text-sm bg-[#84cc16] hover:bg-lime-400 text-[#14532d] cursor-pointer transition-colors"
>
  Volver al inicio
</button>
```

- [ ] **Paso 3: Actualizar el botón CTA en el estado de error**

Buscar el botón "Reintentar" dentro del bloque `if (error && !t)`:

```jsx
/* Antes */
<button
  onClick={() => window.location.reload()}
  className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-[#0284c7] hover:bg-sky-500 text-white cursor-pointer transition-colors"
>
  Reintentar
</button>
```

Reemplazar con:

```jsx
<button
  onClick={() => window.location.reload()}
  className="mt-2 w-full py-3 rounded-xl font-black text-sm bg-[#84cc16] hover:bg-lime-400 text-[#14532d] cursor-pointer transition-colors"
>
  Reintentar
</button>
```

- [ ] **Paso 4: Build y verificar**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
```

Resultado esperado: build limpio.

- [ ] **Paso 5: Commit**

```bash
git add src/TournamentPage.jsx
git commit -m "style: migrar estados de carga/error de TournamentPage a Tailwind"
```

---

## Tarea 5: History.jsx y PairStandings.jsx — migración de colores

**Archivos:** `src/components/shared/History.jsx`, `src/components/shared/PairStandings.jsx`

### History.jsx

History ya está mayormente en Tailwind. Solo hay dos colores inconsistentes.

- [ ] **Paso 1: Corregir superficie en History.jsx**

En `src/components/shared/History.jsx` línea 24:

```jsx
/* Antes */
<div key={ri} className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden">

/* Después */
<div key={ri} className="bg-[#1e293b] rounded-2xl border border-gray-700 overflow-hidden">
```

- [ ] **Paso 2: Corregir fondo de score en History.jsx**

Línea 65:

```jsx
/* Antes */
<div className="flex items-center gap-1.5 bg-[#111827] border border-gray-700 rounded-lg px-3 py-1.5">

/* Después */
<div className="flex items-center gap-1.5 bg-[#0f172a] border border-gray-700 rounded-lg px-3 py-1.5">
```

### PairStandings.jsx

- [ ] **Paso 3: Reemplazar el contenido completo de PairStandings.jsx**

Reemplazar todo el contenido de `src/components/shared/PairStandings.jsx` con:

```jsx
// src/components/shared/PairStandings.jsx

export default function PairStandings({ pairs, title, extra, scoringFormat = "games" }) {
  const sorted = [...(pairs || [])].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gf - b.gc !== a.gf - a.gc) return b.gf - b.gc - (a.gf - a.gc);
    return (
      (b.gamesFor || 0) - (b.gamesAgainst || 0) -
      ((a.gamesFor || 0) - (a.gamesAgainst || 0))
    );
  });

  return (
    <div className="bg-[#0f172a] rounded-xl overflow-hidden mb-4">
      <div className="px-4 pt-3.5 pb-2.5 text-base font-black text-[#f1f5f9]">
        🏆 {title}
      </div>
      {extra && <div className="px-4 pb-2.5">{extra}</div>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#0a1120]">
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">#</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-left">Jugador</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">PTS</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">GF</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">GC</th>
            <th className="px-2.5 py-2 text-[11px] font-bold text-[#475569] uppercase tracking-wide text-center">DIF</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const d = p.gf - p.gc;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <tr
                key={p.id}
                className="border-b border-[#1e293b]"
                style={{ background: i % 2 === 0 ? "#1e293b" : "#172033" }}
              >
                <td className="px-2.5 py-2.5 text-center">
                  {medal || <span className="text-[#64748b] text-sm">{i + 1}</span>}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-[#f1f5f9]">
                  {p.name || `${p.p1} / ${p.p2}`}
                </td>
                <td className="px-2.5 py-2.5 text-center text-sm font-black text-[#38bdf8]">{p.pts}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gf}</td>
                <td className="px-2.5 py-2.5 text-center text-sm text-[#94a3b8]">{p.gc}</td>
                <td
                  className="px-2.5 py-2.5 text-center text-sm font-bold"
                  style={{ color: d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#64748b" }}
                >
                  {d > 0 ? `+${d}` : d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

> Nota: `i % 2` y el color dinámico de la columna DIF usan inline style — son valores calculados, excepción aceptada por CLAUDE.md.

- [ ] **Paso 4: Build y verificar**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Resultado esperado: build limpio, tests pasando.

- [ ] **Paso 5: Commit**

```bash
git add src/components/shared/History.jsx src/components/shared/PairStandings.jsx
git commit -m "refactor: migrar History y PairStandings a Tailwind, unificar colores"
```

---

## Tarea 6: PlayPozo.jsx y PlayMundialito.jsx — eliminar B()

**Archivos:** `src/components/play/PlayPozo.jsx`, `src/components/play/PlayMundialito.jsx`

### PlayPozo.jsx (4 usos de B())

- [ ] **Paso 1: Reemplazar B() del botón timer (línea ~411)**

Buscar el botón `toggleTimer` que usa `style={B(t.timerRunning ? "#f59e0b" : "#10b981", ...)}`:

```jsx
/* Antes */
<button onClick={toggleTimer} style={B(t.timerRunning ? "#f59e0b" : "#10b981", { padding: "8px 24px", fontSize: 16 })}>

/* Después */
<button
  onClick={toggleTimer}
  className="font-bold rounded-lg px-6 py-2 text-base text-white cursor-pointer border-0 transition-colors"
  style={{ background: t.timerRunning ? "#f59e0b" : "#10b981" }}
>
```

> El color es dinámico (depende de `t.timerRunning`) — el inline style es la excepción correcta.

- [ ] **Paso 2: Reemplazar B() del botón neutro adyacente al timer (línea ~416)**

Buscar el botón con `style={B("#334155", { padding: "8px 14px" })}`:

```jsx
/* Antes */
<button ... style={B("#334155", { padding: "8px 14px" })}>

/* Después */
<button ... className="bg-[#334155] text-white font-bold rounded-lg px-3.5 py-2 cursor-pointer border-0">
```

- [ ] **Paso 3: Reemplazar B() del botón "Iniciar ronda" (línea ~568)**

Buscar el botón con `style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}`:

```jsx
/* Antes */
<button ... style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}>

/* Después */
<button ... className="w-full bg-[#10b981] text-white font-bold rounded-lg py-4 text-base cursor-pointer border-0">
```

- [ ] **Paso 4: Reemplazar B() del botón secundario de ronda (línea ~576)**

Buscar el botón con `style={B("#334155", { width: "100%", padding: 12, fontSize: 13, marginTop: 4 })}`:

```jsx
/* Antes */
<button ... style={B("#334155", { width: "100%", padding: 12, fontSize: 13, marginTop: 4 })}>

/* Después */
<button ... className="w-full mt-1 bg-[#334155] text-white font-bold rounded-lg py-3 text-sm cursor-pointer border-0">
```

- [ ] **Paso 5: Quitar el import de B en PlayPozo.jsx**

```js
/* Antes */
import { B, TOURNAMENT_RULES } from "../../logic/constants";

/* Después */
import { TOURNAMENT_RULES } from "../../logic/constants";
```

### PlayMundialito.jsx (1 uso de B())

- [ ] **Paso 6: Reemplazar B() del botón "Iniciar Fase Eliminatoria" (línea ~477)**

Buscar el botón con `style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}`:

```jsx
/* Antes */
<button
  onClick={onStartKnockout}
  style={B("#10b981", {
    width: "100%",
    padding: 16,
    fontSize: 16,
  })}
>
  Iniciar Fase Eliminatoria ⚡
</button>

/* Después */
<button
  onClick={onStartKnockout}
  className="w-full bg-[#10b981] text-white font-bold rounded-lg py-4 text-base cursor-pointer border-0"
>
  Iniciar Fase Eliminatoria ⚡
</button>
```

- [ ] **Paso 7: Quitar el import de B en PlayMundialito.jsx**

```js
/* Antes */
import { B, TOURNAMENT_RULES } from "../../logic/constants";

/* Después */
import { TOURNAMENT_RULES } from "../../logic/constants";
```

- [ ] **Paso 8: Build final y tests**

```bash
cd "/Users/ximeyfede/Desktop/Padel app"
npm run build
npx vitest run
```

Resultado esperado: build limpio, todos los tests pasando. Verificar en el browser que los botones de PlayPozo y PlayMundialito se ven correctos.

- [ ] **Paso 9: Commit**

```bash
git add src/components/play/PlayPozo.jsx src/components/play/PlayMundialito.jsx
git commit -m "refactor: reemplazar B() en PlayPozo y PlayMundialito por clases Tailwind"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ Bricolage Grotesque global → Tarea 1 Pasos 1–2
- ✅ `#111827` → `#0f172a` en Home → Tarea 1 Paso 3
- ✅ `#1f2937` → `#1e293b` en Home → Tarea 1 Paso 4
- ✅ Dropdown Home inline styles → Tailwind → Tarea 1 Paso 5
- ✅ THeader gradiente por formato → Tarea 2
- ✅ Tabs acento lima → Tarea 2
- ✅ SimpleModal + prop `icon` → Tarea 2
- ✅ PTag, PName, PairName → Tarea 2
- ✅ Panel rediseño completo + B() eliminado → Tarea 3
- ✅ TournamentPage loading state + CTA primario → Tarea 4
- ✅ History color unification → Tarea 5
- ✅ PairStandings inline → Tailwind → Tarea 5
- ✅ PlayPozo B() x4 → Tarea 6
- ✅ PlayMundialito B() x1 → Tarea 6

**Sin placeholders:** Todos los pasos tienen código concreto.

**Consistencia de tipos:** `SimpleModal` recibe `icon` como prop string en Tarea 2 y se pasa como `icon="🗑️"` en Tarea 3 — coincide.
