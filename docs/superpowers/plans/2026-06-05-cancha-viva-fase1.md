# Cancha Viva Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar visualmente Home, THeader, Tabs, MatchCard y Panel con la dirección "Cancha Viva" — glow ambiental por formato, tipografía más audaz, Geist Mono para datos, atmósfera dark con profundidad.

**Architecture:** Cambios puramente visuales sobre la estructura existente. No se toca lógica de negocio, rutas, ni Firebase. Cada tarea es un componente o archivo independiente con su propio commit.

**Tech Stack:** React 18, Tailwind CSS v4 (vite plugin), Bricolage Grotesque + Geist Mono (Google Fonts), CSS keyframes

**Spec:** `docs/superpowers/specs/2026-06-05-cancha-viva-fase1-design.md`

---

## File Map

| Archivo | Cambio |
|---|---|
| `index.html` | Agregar Geist Mono a Google Fonts import |
| `src/index.css` | Agregar `--font-data` en `@theme`, clases `.bg-app` y `.bg-grid`, keyframes `pulse-dot` y `score-pop` |
| `src/Home.jsx` | Background mesh, hero tipografía, CTA glow, input código Geist Mono |
| `src/components/shared/Components.jsx` | THeader glow ambiental + format label + código Geist Mono; Tabs ajuste visual |
| `src/components/shared/MatchCard.jsx` | Glassmorphism sutil, scores Geist Mono, botón con glow de formato, score-pop |
| `src/Panel.jsx` | Background mesh, cards con glow por formato, empty state |

---

## Task 1: Fundación — Geist Mono + CSS utilities + keyframes

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Agregar Geist Mono a Google Fonts**

En `index.html`, reemplazar la línea del link de Bricolage Grotesque:

```html
<!-- ANTES -->
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">

<!-- DESPUÉS -->
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Agregar `--font-data` al `@theme` de `index.css`**

Dentro del bloque `@theme { ... }` existente, agregar la variable al final:

```css
@theme {
  /* ... variables existentes sin tocar ... */
  --font-data: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;
}
```

Esto crea la clase utilitaria `font-data` en Tailwind v4.

- [ ] **Step 3: Agregar clases `.bg-app` y `.bg-grid` en `index.css`**

Después del bloque `@layer base { ... }` existente, agregar:

```css
.bg-app {
  background:
    radial-gradient(ellipse 70% 35% at 50% 0%,  rgba(132,204,22,0.07)  0%, transparent 70%),
    radial-gradient(ellipse 50% 30% at 90% 85%, rgba(14,165,233,0.05)   0%, transparent 60%),
    radial-gradient(ellipse 40% 25% at 10% 60%, rgba(132,204,22,0.03)   0%, transparent 60%),
    #0f172a;
}

.bg-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

- [ ] **Step 4: Agregar keyframes `pulse-dot` y `score-pop` en `index.css`**

Después de las clases del paso anterior:

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}

@keyframes score-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 5: Verificar build limpio**

```bash
npm run build
```
Expected: sin errores. Si Geist Mono no existe en Google Fonts, el build igual pasa (fuentes no bloquean build) — el fallback `JetBrains Mono` actuará.

- [ ] **Step 6: Commit**

```bash
git add index.html src/index.css
git commit -m "style: agregar Geist Mono, clases bg-app/bg-grid y keyframes pulse-dot/score-pop"
```

---

## Task 2: Home.jsx — hero, fondo, CTA, input

**Files:**
- Modify: `src/Home.jsx`

- [ ] **Step 1: Cambiar fondo del wrapper principal**

En el `return` de `Home`, el div raíz:

```jsx
// ANTES
<div className="min-h-screen bg-[#0f172a] text-gray-50">

// DESPUÉS
<div className="min-h-screen bg-app bg-grid text-gray-50">
```

- [ ] **Step 2: Actualizar el header sticky**

```jsx
// ANTES
<header className="sticky top-0 z-10 w-full bg-[#0f172a]/90 backdrop-blur-sm border-b border-gray-800">

// DESPUÉS
<header className="sticky top-0 z-10 w-full bg-[#0f172a]/85 backdrop-blur-md border-b border-white/5">
```

- [ ] **Step 3: Actualizar el logo en el header**

```jsx
// ANTES
<span className="text-xl font-black text-lime-500 tracking-tight">Padeldesk</span>

// DESPUÉS
<span className="text-[18px] font-black tracking-tight text-[#f1f5f9]">
  Padeldesk<span className="text-[#84cc16]">•</span>
</span>
```

- [ ] **Step 4: Actualizar el badge "gratis · tiempo real" en el hero**

```jsx
// ANTES
<div className="inline-flex items-center gap-1.5 bg-green-900/60 text-lime-400 border border-green-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 select-none">
  ✅ 100% gratis · ⚡ Tiempo real
</div>

// DESPUÉS
<div className="inline-flex items-center gap-2 bg-[#84cc16]/8 border border-[#84cc16]/20 text-[#84cc16] text-[10px] font-bold tracking-[0.5px] px-3.5 py-1.5 rounded-full mb-5 select-none">
  <span
    className="w-1.5 h-1.5 rounded-full bg-[#84cc16] flex-shrink-0"
    style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
  />
  100% gratis · Tiempo real
</div>
```

- [ ] **Step 5: Actualizar el headline del hero**

```jsx
// ANTES
<h1 className="text-3xl font-black leading-tight mb-4 text-gray-50">
  Organiza. Comparte. Juega.
</h1>

// DESPUÉS
<h1 className="text-[42px] font-black leading-[1.0] tracking-[-0.05em] mb-4">
  Organiza.<br />
  Comparte.<br />
  <span className="text-[#84cc16]">Juega.</span>
</h1>
```

- [ ] **Step 6: Actualizar el subheadline**

```jsx
// ANTES
<p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs mx-auto">

// DESPUÉS
<p className="text-[#4a5568] text-sm font-medium leading-relaxed mb-8 max-w-xs mx-auto">
```

- [ ] **Step 7: Actualizar el botón CTA principal**

```jsx
// ANTES
<button
  onClick={handleCreateClick}
  className="w-full bg-lime-500 hover:bg-lime-400 text-green-950 font-black py-4 rounded-2xl text-base transition-colors cursor-pointer shadow-lg shadow-lime-500/20"
>

// DESPUÉS
<button
  onClick={handleCreateClick}
  className="w-full bg-[#84cc16] hover:bg-lime-400 text-[#14532d] font-black py-4 rounded-2xl text-base transition-colors cursor-pointer"
  style={{
    boxShadow: '0 0 0 1px rgba(132,204,22,0.4), 0 4px 20px rgba(132,204,22,0.25), 0 12px 40px rgba(132,204,22,0.1)',
  }}
>
```

- [ ] **Step 8: Actualizar el input de código**

```jsx
// ANTES
<input
  value={joinVal}
  onChange={(e) => setJoinVal(e.target.value.toUpperCase())}
  onKeyDown={(e) => e.key === "Enter" && onJoin()}
  maxLength={6}
  placeholder="CÓDIGO"
  className="flex-1 min-w-0 bg-[#1e293b] border border-gray-700 focus:border-lime-600 rounded-xl text-gray-50 text-xl font-bold tracking-[0.35em] text-center py-3 outline-none transition-colors placeholder:text-gray-600 placeholder:tracking-widest placeholder:text-sm placeholder:font-normal"
/>

// DESPUÉS
<input
  value={joinVal}
  onChange={(e) => setJoinVal(e.target.value.toUpperCase())}
  onKeyDown={(e) => e.key === "Enter" && onJoin()}
  maxLength={6}
  placeholder="CÓDIGO"
  className="flex-1 min-w-0 font-data bg-white/[0.03] border border-white/[0.07] focus:border-[#84cc16]/30 rounded-2xl text-[#f1f5f9] text-xl font-bold tracking-[0.35em] text-center py-3 outline-none transition-all placeholder:text-[#1e2a3a] placeholder:tracking-[4px] placeholder:text-sm placeholder:font-medium"
  style={{
    '--tw-ring-shadow': 'none',
  }}
  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(132,204,22,0.06)'; }}
  onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
/>
```

- [ ] **Step 9: Actualizar los íconos de beneficios**

Buscar los iconos de beneficios y cambiar el fondo:

```jsx
// ANTES
<div className="w-9 h-9 rounded-lg bg-[#14532d] flex items-center justify-center shrink-0 text-xl leading-none">

// DESPUÉS
<div className="w-9 h-9 rounded-lg bg-[#84cc16]/7 border border-[#84cc16]/10 flex items-center justify-center shrink-0 text-xl leading-none">
```

- [ ] **Step 10: Run build + tests**

```bash
npm run build && npm run test
```
Expected: build limpio, todos los tests en verde.

- [ ] **Step 11: Verificar visualmente**

```bash
npm run dev
```
Abrir `http://localhost:5173` y verificar:
- El fondo tiene el mesh de gradientes sutil (no es plano negro)
- El headline dice "Organiza. Comparte. **Juega.**" con "Juega." en lima
- El CTA tiene el glow eléctrico alrededor
- El input de código usa Geist Mono/monoespaciada con tracking amplio

- [ ] **Step 12: Commit**

```bash
git add src/Home.jsx
git commit -m "style: rediseñar Home con dirección Cancha Viva — hero, CTA glow, input Geist Mono"
```

---

## Task 3: Components.jsx — THeader glow ambiental + Tabs

**Files:**
- Modify: `src/components/shared/Components.jsx`

- [ ] **Step 1: Reescribir THeader**

Reemplazar la función `THeader` completa:

```jsx
export function THeader({ t, code, isAdmin, copyCode, subtitle, onEdit }) {
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];
  return (
    <div
      className="px-4 py-3.5 flex items-start justify-between relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${typeInfo.color}2e 0%, ${typeInfo.color}0a 40%, #0f172a 80%)`,
        borderBottom: `1px solid ${typeInfo.color}26`,
      }}
    >
      {/* Glow blob ambiental */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          left: -20,
          width: 140,
          height: 100,
          borderRadius: '50%',
          background: typeInfo.color,
          filter: 'blur(25px)',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10">
        {/* Etiqueta del formato */}
        <div
          className="text-[10px] font-bold tracking-[1.5px] uppercase mb-1.5 opacity-70"
          style={{ color: typeInfo.color }}
        >
          {typeInfo.icon} {typeInfo.name}
        </div>

        {/* Nombre del torneo */}
        <div className="text-[20px] font-black text-[#f1f5f9] tracking-[-0.5px] leading-tight">
          {t.config.name}
        </div>

        <div className="text-xs text-[#4a5568] mt-0.5 font-medium">{subtitle}</div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-[#4a5568] hover:text-[#f1f5f9] bg-transparent border-0 cursor-pointer underline p-0 mt-1 transition-colors"
          >
            ✏️ Editar torneo
          </button>
        )}
      </div>

      <div className="flex gap-1.5 items-center flex-shrink-0 ml-3 relative z-10 mt-0.5">
        {isAdmin && (
          <span className="bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/25 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
            👑 Admin
          </span>
        )}
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 bg-white/5 border border-white/[0.09] text-[#64748b] rounded-lg px-2.5 py-1.5 cursor-pointer hover:text-[#f1f5f9] transition-colors whitespace-nowrap"
        >
          <span className="text-[11px]">🔗</span>
          <span className="font-data text-[11px] font-bold tracking-[1px]">{code}</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar Tabs**

Reemplazar la función `Tabs` completa:

```jsx
export function Tabs({ tabs, active, setActive }) {
  return (
    <div className="flex border-b border-white/5 bg-black/20">
      {tabs.map(([tb, lbl]) => {
        const [icon, ...rest] = lbl.split(' ');
        const label = rest.join(' ');
        return (
          <button
            key={tb}
            onClick={() => setActive(tb)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-pointer bg-transparent border-0 border-b-2 transition-colors ${
              active === tb
                ? 'text-[#f1f5f9] font-bold border-[#84cc16]'
                : 'text-[#334155] font-semibold border-transparent'
            }`}
          >
            <span className="text-[15px] leading-none">{icon}</span>
            <span className="text-[9px] font-bold tracking-[0.3px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run build + tests**

```bash
npm run build && npm run test
```
Expected: build limpio, todos los tests en verde.

- [ ] **Step 4: Verificar visualmente**

```bash
npm run dev
```
Navegar a un torneo activo. Verificar:
- El THeader muestra el formato label pequeño encima del nombre (ej: "🔄 Americano")
- El gradiente de fondo en el header cambia por formato (azul para Americano, violeta para Relámpago, etc.)
- El código de torneo en el chip usa fuente monoespaciada
- Las tabs tienen el indicator lima activo

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Components.jsx
git commit -m "style: rediseñar THeader con glow ambiental por formato y Tabs con indicador lima"
```

---

## Task 4: MatchCard.jsx — glassmorphism, Geist Mono, glow de formato

**Files:**
- Modify: `src/components/shared/MatchCard.jsx`

- [ ] **Step 1: Actualizar el card wrapper**

```jsx
// ANTES
<div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden mb-3">

// DESPUÉS
<div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] overflow-hidden mb-3">
```

- [ ] **Step 2: Actualizar el header de la card**

```jsx
// ANTES
<div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700">

// DESPUÉS
<div className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 bg-black/15">
```

- [ ] **Step 3: Actualizar los score inputs (estado editando)**

Hay dos inputs en la card — el de `sA_games` y el de `sB_games`. Actualizar ambos:

```jsx
// ANTES — primer input (scoreA)
className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

// DESPUÉS — primer input (scoreA)
className="font-data w-11 h-11 rounded-xl bg-white/[0.04] border-[1.5px] border-white/10 text-center text-[22px] font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
style={{
  ...(ls[`${match.id}_A`] && {
    borderColor: `${accentColor}80`,
    boxShadow: `0 0 0 3px ${accentColor}10`,
    color: accentColor,
  }),
}}
```

```jsx
// ANTES — segundo input (scoreB)
className="w-11 h-11 rounded-xl bg-[#111827] border border-gray-700 text-center text-xl font-black text-sky-400 outline-none focus:border-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

// DESPUÉS — segundo input (scoreB)
className="font-data w-11 h-11 rounded-xl bg-white/[0.04] border-[1.5px] border-white/10 text-center text-[22px] font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
style={{
  ...(ls[`${match.id}_B`] && {
    borderColor: `${accentColor}80`,
    boxShadow: `0 0 0 3px ${accentColor}10`,
    color: accentColor,
  }),
}}
```

- [ ] **Step 4: Actualizar los score boxes del estado guardado (ganador/perdedor)**

En el bloque que renderiza `match.saved` (scores guardados sin sets):

```jsx
// ANTES — score ganador
className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreA) > parseInt(match.scoreB) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}

// DESPUÉS — div del score A
className={`font-data w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] font-bold transition-all ${parseInt(match.scoreA) > parseInt(match.scoreB)
  ? "bg-green-500/10 border border-green-500/25 text-green-400"
  : "bg-white/[0.04] border border-white/7 text-[#334155]"
} ${isAdmin ? "cursor-pointer" : ""}`}
style={
  parseInt(match.scoreA) > parseInt(match.scoreB)
    ? { animation: 'score-pop 0.3s ease-out' }
    : undefined
}
```

```jsx
// ANTES — score perdedor (scoreB)
className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black ${parseInt(match.scoreB) > parseInt(match.scoreA) ? "bg-green-500/10 border border-green-500/40 text-green-400" : "bg-gray-800 border border-gray-600 text-gray-400"} ${isAdmin ? "cursor-pointer" : ""}`}

// DESPUÉS — div del score B
className={`font-data w-11 h-11 rounded-[12px] flex items-center justify-center text-[22px] font-bold transition-all ${parseInt(match.scoreB) > parseInt(match.scoreA)
  ? "bg-green-500/10 border border-green-500/25 text-green-400"
  : "bg-white/[0.04] border border-white/7 text-[#334155]"
} ${isAdmin ? "cursor-pointer" : ""}`}
style={
  parseInt(match.scoreB) > parseInt(match.scoreA)
    ? { animation: 'score-pop 0.3s ease-out' }
    : undefined
}
```

- [ ] **Step 5: Actualizar los inputs del formato por sets**

En el bloque `isSetFormat && isAdmin && !match.saved`, los inputs de cada set:

```jsx
// ANTES
<input
  type="number" min="0"
  ...
  className="w-11 h-9 rounded-lg bg-[#0f172a] border-2 border-[#334155] text-center text-base font-black text-gray-50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>

// DESPUÉS — aplicar a AMBOS inputs (A y B) dentro del map de sets
className="font-data w-11 h-9 rounded-lg bg-white/[0.04] border-[1.5px] border-white/10 text-center text-base font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
```

También actualizar el contenedor de cada fila de set:
```jsx
// ANTES
<div key={idx} className="flex items-center justify-between bg-[#0f172a]/20 px-3 py-1.5 rounded-lg">

// DESPUÉS
<div key={idx} className="flex items-center justify-between bg-black/20 px-3 py-1.5 rounded-lg border border-white/[0.04]">
```

- [ ] **Step 7: Actualizar el indicador de ganador ("✓ Gana...")**

```jsx
// ANTES
<div className="text-center px-4 pb-2 text-sm text-green-400 font-bold">

// DESPUÉS
<div className="flex items-center justify-center gap-1.5 px-4 pb-2 text-[12px] text-green-400 font-bold">
  <span
    className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
    style={{ animation: 'pulse-dot 1.8s ease-in-out infinite' }}
  />
```

Nota: cerrar el `<div>` al final del contenido del indicador, no antes.

- [ ] **Step 8: Actualizar el botón "Guardar resultado"**

```jsx
// ANTES
<button
  ...
  className={`${isEditing ? "flex-1" : "w-full"} py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-colors`}
  style={{ background: isValidFinal ? accentColor : "#334155", opacity: isValidFinal ? 1 : 0.5 }}
>

// DESPUÉS
<button
  ...
  className={`${isEditing ? "flex-1" : "w-full"} py-3 rounded-xl text-[13px] font-black text-white cursor-pointer transition-all`}
  style={{
    background: isValidFinal ? accentColor : 'rgba(255,255,255,0.04)',
    color: isValidFinal ? 'white' : '#334155',
    boxShadow: isValidFinal ? `0 4px 16px ${accentColor}4d` : 'none',
    opacity: 1,
  }}
>
```

- [ ] **Step 9: Run build + tests**

```bash
npm run build && npm run test
```
Expected: build limpio, todos los tests en verde (MatchCard no tiene tests de lógica, los tests de americano/relampago/pozo no se tocan).

- [ ] **Step 10: Verificar visualmente**

```bash
npm run dev
```
Navegar a un torneo activo con partidos. Verificar:
- Las cards tienen el fondo semitransparente (no el gris sólido anterior)
- Los score inputs tienen el glow con el color del formato al escribir
- Los scores guardados: ganador en verde, perdedor en gris oscuro, ambos en Geist Mono
- El botón "Guardar" tiene el glow difuso del color del formato cuando está activo

- [ ] **Step 11: Commit**

```bash
git add src/components/shared/MatchCard.jsx
git commit -m "style: rediseñar MatchCard con glassmorphism, scores Geist Mono y glow de formato"
```

---

## Task 5: Panel.jsx — fondo mesh, cards con glow, empty state

**Files:**
- Modify: `src/Panel.jsx`

- [ ] **Step 1: Cambiar el fondo del wrapper principal**

```jsx
// ANTES
<div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] px-4 py-6">

// DESPUÉS
<div className="min-h-screen bg-app bg-grid text-[#f1f5f9] px-4 py-6">
```

- [ ] **Step 2: Actualizar el header del Panel**

```jsx
// ANTES
<div className="flex items-center gap-3 mb-7">
  <button
    onClick={() => navigate("/")}
    className="w-8 h-8 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-sm text-[#94a3b8] hover:text-[#f1f5f9] cursor-pointer transition-colors flex-shrink-0"
  >
    ←
  </button>
  <h1 className="text-xl font-black text-[#f1f5f9]">Mis torneos</h1>

// DESPUÉS
<div className="flex items-center gap-3 mb-7">
  <button
    onClick={() => navigate("/")}
    className="w-8 h-8 rounded-[10px] bg-white/5 border border-white/8 flex items-center justify-center text-sm text-[#64748b] hover:text-[#f1f5f9] cursor-pointer transition-colors flex-shrink-0"
  >
    ←
  </button>
  <h1 className="text-[18px] font-black text-[#f1f5f9] tracking-[-0.5px]">Mis torneos</h1>
```

- [ ] **Step 3: Agregar la función helper `hexToRgb` al inicio del componente**

Después de los imports, antes del componente `Panel`, agregar:

```js
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
```

- [ ] **Step 4: Actualizar las tournament cards**

El map de torneos renderiza cada card. Reemplazar la card completa:

```jsx
// ANTES
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

// DESPUÉS
<div
  key={t.code}
  className="rounded-[18px] overflow-hidden border border-white/7 relative"
  style={{ background: `rgba(${hexToRgb(typeInfo?.color ?? "#334155")}, 0.06)` }}
>
  {/* Glow radial izquierda */}
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 18,
      background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${typeInfo?.color ?? "#334155"}1a 0%, transparent 70%)`,
      pointerEvents: 'none',
    }}
  />

  {/* Card body */}
  <div
    className="flex items-center gap-3 px-4 py-3.5 relative"
    style={{ borderLeft: `3px solid ${typeInfo?.color ?? "#334155"}b3` }}
  >
    <div
      className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center text-xl flex-shrink-0"
      style={{ background: `${typeInfo?.color ?? "#334155"}12` }}
    >
```

- [ ] **Step 5: Actualizar la fecha en la card (Geist Mono)**

```jsx
// ANTES
<div className="text-xs text-[#64748b] mt-0.5">
  {typeInfo?.name ?? t.type}
  {t.createdAt && (
    <>
      {" · "}
      {t.createdAt.toLocaleDateString(...)}
    </>
  )}
</div>

// DESPUÉS
<div className="text-[11px] text-[#3d5070] mt-0.5 font-medium flex items-center gap-1.5">
  <span style={{ color: `${typeInfo?.color ?? "#334155"}99` }}>
    {typeInfo?.name ?? t.type}
  </span>
  {t.createdAt && (
    <>
      <span className="text-[#1e3040]">·</span>
      <span className="font-data text-[10px] text-[#2d3f55]">
        {t.createdAt.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    </>
  )}
</div>
```

- [ ] **Step 6: Actualizar el card footer**

```jsx
// ANTES
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

// DESPUÉS
<div className="flex border-t border-white/5 bg-black/15">
  <button
    onClick={() => navigate(`/torneo/${t.code}`)}
    className="flex-1 py-2.5 text-[12px] font-bold cursor-pointer bg-transparent border-0 transition-colors text-left px-4 hover:bg-white/[0.03]"
    style={{ color: typeInfo?.color ?? "#94a3b8" }}
  >
    Entrar →
  </button>
  <div className="w-px bg-white/5" />
  <button
    onClick={() => onDelete(t.code)}
    className="px-4 py-2.5 text-[14px] text-[#334155] hover:text-[#ef4444] hover:bg-[#ef4444]/5 cursor-pointer bg-transparent border-0 transition-colors"
  >
    🗑
  </button>
</div>
```

- [ ] **Step 7: Actualizar el empty state**

```jsx
// ANTES
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

// DESPUÉS
<div className="flex flex-col items-center gap-4 py-12 text-center">
  <div className="w-[60px] h-[60px] rounded-[20px] bg-white/[0.03] border border-white/7 flex items-center justify-center text-3xl">
    🏓
  </div>
  <div>
    <p className="text-[16px] font-black text-[#f1f5f9] mb-1.5">Sin torneos todavía</p>
    <p className="text-[13px] text-[#334155] leading-[1.55] max-w-[220px] mx-auto">
      Creá tu primer torneo y compartilo con tus jugadores.
    </p>
  </div>
  <button
    onClick={() => navigate("/")}
    className="bg-[#84cc16] text-[#14532d] font-black rounded-[12px] px-6 py-2.5 text-[13px] cursor-pointer border-0 mt-1"
    style={{ boxShadow: '0 4px 16px rgba(132,204,22,0.2)' }}
  >
    + Crear torneo
  </button>
</div>
```

- [ ] **Step 8: Run build + tests**

```bash
npm run build && npm run test
```
Expected: build limpio, todos los tests en verde.

- [ ] **Step 9: Verificar visualmente**

```bash
npm run dev
```
Navegar a `/panel`. Verificar:
- El fondo tiene el mesh de gradientes (mismo que Home)
- Cada card de torneo tiene un tinte muy sutil del color de su formato
- El glow irradia desde la izquierda en cada card
- La fecha usa fuente monoespaciada
- El botón "Entrar →" tiene el color del formato
- El empty state tiene el CTA con glow lima sutil

- [ ] **Step 10: Commit**

```bash
git add src/Panel.jsx
git commit -m "style: rediseñar Panel con fondo mesh, cards con glow por formato y empty state"
```

---

## Verificación final

- [ ] **Build de producción limpio**

```bash
npm run build
```
Expected: sin warnings, bundle sin errores.

- [ ] **Tests completos**

```bash
npm run test
```
Expected: todos los tests existentes pasan (americano, relampago, pozo, stats).

- [ ] **Checklist visual**

Recorrer estas pantallas y verificar coherencia:
1. `/` — Home: mesh de fondo, hero con "Juega." en lima, CTA eléctrico, input Geist Mono
2. Un torneo Americano: THeader azul, código en mono, tabs con indicator lima, MatchCard glassmorphism
3. Un torneo Relámpago: THeader violeta, glow violeta en header
4. Un torneo El Pozo: THeader naranja
5. `/panel` — cards con glow por formato, fechas en mono

- [ ] **Commit final de cierre (si hay ajustes menores)**

```bash
git add -p  # staging selectivo de ajustes
git commit -m "style: ajustes finales Cancha Viva Fase 1"
```
