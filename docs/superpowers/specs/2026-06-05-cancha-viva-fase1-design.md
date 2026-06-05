# Diseño: Cancha Viva — Fase 1

**Fecha:** 2026-06-05  
**Alcance:** Fundación CSS + Home + THeader + Tabs + MatchCard + Panel  
**Dirección estética:** Cancha Viva — dark theme con atmósfera, glow ambiental por formato, glassmorphism sutil, tipografía más audaz  
**Fase siguiente:** Fase 2 cubrirá Play components (PlayAmericano, PlayRelampago, PlayMundialito, PlayPozo) y Setup components

---

## 1. Decisiones de diseño globales

### Tipografía
- **Bricolage Grotesque** (ya instalada) — UI general, copy, labels, headlines
- **Geist Mono** (nueva) — exclusivamente para datos técnicos: scores, códigos de torneo, fechas, números de ronda
- Pesos a cargar de Geist Mono: 400, 500, 700
- Cargar vía Google Fonts en `index.html`. Si Geist Mono no está disponible, usar **JetBrains Mono** como fallback (mismo carácter técnico, sí disponible en Google Fonts)
- Stack de fallback: `'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace`

### Animaciones
- CSS-only (`@keyframes` en `index.css` + `transition-*` de Tailwind)
- Sin librerías nuevas (Framer Motion queda para Fase 2)
- Animaciones clave a definir:
  - `pulse-dot` — punto vivo pulsante (live indicator)
  - `glow-breathe` — glow ambiental que respira suavemente (opcional, solo si no impacta perf)
  - `score-pop` — microinteracción al guardar resultado (escala 1→1.08→1)

### Logo
- Archivo fuente: `src/assets/logo-light.png` (wordmark sobre fondo blanco — versión de referencia)
- **Pendiente:** versión blanca sobre transparente (PNG o SVG) para uso en headers oscuros
- **Workaround hasta tener el SVG:** recrear el wordmark en CSS — `"Padeldesk"` en Bricolage 700 + `•` en `#84cc16`
- Tamaños: 130px en Home header, 110px en headers de torneo, 120px en Panel

### Colores — sin cambios a los tokens existentes
Los `@theme` variables de `index.css` ya están correctos. No se tocan. Lo nuevo son efectos y composiciones sobre los colores existentes.

---

## 2. Fundación CSS (`index.css`)

### Nuevas keyframes
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

### Nueva fuente en `body`
```css
body {
  font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
}
```
(Bricolage ya está, solo confirmar que Geist Mono esté disponible como clase utilitaria `font-mono` apuntando a ella)

### Clase de fondo mesh (reutilizable)
```css
.bg-app {
  background:
    radial-gradient(ellipse 70% 35% at 50% 0%,  rgba(132,204,22,0.07)  0%, transparent 70%),
    radial-gradient(ellipse 50% 30% at 90% 85%, rgba(14,165,233,0.05)   0%, transparent 60%),
    radial-gradient(ellipse 40% 25% at 10% 60%, rgba(132,204,22,0.03)   0%, transparent 60%),
    #0f172a;  /* --color-bg sin cambios */
}
```

### Clase de grid sutil (reutilizable)
```css
.bg-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

---

## 3. Home (`Home.jsx`)

### Background
- Wrapper principal: `bg-app bg-grid` (clases nuevas definidas arriba)
- Ya no `bg-[#0f172a]` plano

### Header sticky
```
backdrop-blur-md bg-[#0f172a]/85 border-b border-white/5
```
- Logo: recreación CSS del wordmark hasta tener SVG. Sustituir `<span className="text-xl font-black text-lime-500 tracking-tight">Padeldesk</span>` por `<span>Padeldesk<span className="text-[#84cc16]">•</span></span>` con Bricolage 800, o usar `<img>` cuando esté el SVG transparente

### Hero
| Elemento | Antes | Después |
|---|---|---|
| Headline | `text-3xl font-black` | `text-[42px] font-black leading-[1.0] tracking-[-0.05em]` |
| "Juega." | color blanco igual que resto | `text-[#84cc16]` — único momento de color en el copy |
| Subheadline | `text-gray-400` | `text-[#4a5568] font-medium` — más sutil |
| Badge "gratis" | static pill | live dot pulsante + mismo estilo |

### CTA principal
```
bg-[#84cc16] text-[#14532d] font-black py-4 rounded-2xl
shadow-[0_0_0_1px_rgba(132,204,22,0.4),0_4px_20px_rgba(132,204,22,0.25),0_12px_40px_rgba(132,204,22,0.1)]
```
Triple `box-shadow` para el efecto "eléctrico".

### Input de código
```
font-['Geist_Mono'] tracking-[0.35em] text-xl font-bold
bg-white/[0.03] border border-white/[0.07] rounded-2xl
focus:border-[#84cc16]/30 focus:shadow-[0_0_0_3px_rgba(132,204,22,0.06)]
```

### Format cards (informativas)
Sin cambio de layout. Ajuste:
- `border-left: 3px solid {color}` con más saturación (actualmente `{color}40` → subir a `{color}99`)
- Nombre del formato en color del formato (igual que ahora, sin cambio)

### Beneficios
- Iconos en `bg-[#84cc16]/7 border border-[#84cc16]/10` (antes `bg-[#14532d]` — era muy opaco)

---

## 4. THeader (`Components.jsx`)

### Gradiente ambiental
```js
// Fórmula: el color del formato irradia desde esquina sup-izquierda
background: `linear-gradient(135deg, ${typeInfo.color}2e 0%, ${typeInfo.color}0a 40%, #0d1525 80%)`
borderBottom: `1px solid ${typeInfo.color}26`
```
Opacidades hex: `2e` = ~18%, `0a` = ~4%, `26` = ~15%

### Glow blob (CSS puro, no Tailwind)
```jsx
<div
  style={{
    position: 'absolute', top: -30, left: -20,
    width: 140, height: 100, borderRadius: '50%',
    background: typeInfo.color,
    filter: 'blur(25px)',
    opacity: 0.35,
    pointerEvents: 'none',
  }}
/>
```
El wrapper del THeader necesita `position: relative; overflow: hidden`.

### Nombre del torneo
```
text-[20px] font-black text-[#f1f5f9] tracking-[-0.5px] leading-tight
```
(antes era `text-lg` — lo subimos a 20px)

### Format label (nuevo elemento)
Encima del nombre del torneo, pequeña etiqueta del formato:
```jsx
<div className="text-[10px] font-bold tracking-[1.5px] uppercase mb-1.5 opacity-70"
     style={{ color: typeInfo.color }}>
  {typeInfo.icon} {typeInfo.name}
</div>
```

### Código de torneo — chip
```
bg-white/5 border border-white/[0.09] rounded-lg px-2.5 py-1.5
```
Texto del código: `font-['Geist_Mono'] text-[11px] font-bold text-[#64748b] tracking-[1px]`

---

## 5. Tabs (`Components.jsx`)

Sin cambio estructural. Ajustes visuales:
```
Contenedor:  flex border-b border-white/5 bg-black/20
Tab activo:  text-[#f1f5f9] font-bold border-b-2 border-[#84cc16]
Tab inactivo: text-[#334155] font-semibold
Emoji:       text-[15px] leading-none
Label:       text-[9px] font-bold tracking-[0.3px]
```

---

## 6. MatchCard (`MatchCard.jsx`)

### Card wrapper
```
bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden
```
(antes `bg-[#1f2937]` sólido — ahora semitransparente)

### Header de la card
```
bg-black/15 border-b border-white/5 px-3.5 py-2.5
```

### Score boxes — estado guardado
**Ganador:**
```
bg-green-500/10 border border-green-500/25 text-green-400
font-['Geist_Mono'] text-[22px] font-bold
w-11 h-11 rounded-[12px]
```
**Perdedor:**
```
bg-white/[0.04] border border-white/7 text-[#334155]
font-['Geist_Mono'] text-[22px] font-bold
w-11 h-11 rounded-[12px]
```

### Score inputs — estado editando
```
bg-white/[0.04] border-[1.5px] border-white/10 rounded-[12px]
font-['Geist_Mono'] text-[22px] font-bold text-[#f1f5f9]
w-11 h-11
```
**Focus/activo** (con valor ingresado):
```
border-[accentColor]/50 shadow-[0_0_0_3px_{accentColor}10]
text-[accentColor]
```
El `accentColor` viene de la prop del componente — cada formato usa su color.

### Botón "Guardar resultado" — estado activo
```
background: accentColor (el color del formato)
box-shadow: 0 4px 16px {accentColor}4d  (30% opacity)
font-black text-white rounded-xl py-3
```

### Indicador ganador
```
text-green-400 font-bold text-[12px] flex items-center gap-1.5
```
+ punto verde animado con `pulse-dot`

### Microinteracción al guardar
Al cambiar `saved` de false → true, aplicar `score-pop` keyframe al score box del ganador.

---

## 7. Panel (`Panel.jsx`)

### Background
Mismo `bg-app bg-grid` que Home.

### Header
```
backdrop-blur-md bg-[#0f172a]/85 border-b border-white/5
```
Título: `text-[18px] font-black tracking-[-0.5px]`  
Botón back: `bg-white/5 border border-white/8 rounded-[10px] w-8 h-8`

### Tournament cards
```
rounded-[18px] overflow-hidden border border-white/7
background: rgba({formatColor}, 0.06)  ← tinte muy suave del formato
```

**Glow radial izquierda:**
```js
style={{
  background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${color}1a 0%, transparent 70%)`
}}
```
(`1a` = ~10% opacity)

**Border left:** `3px solid {formatColor}b3` (~70% opacity)

**Ícono format:** `bg-{formatColor}/12 rounded-[13px] w-[42px] h-[42px]`

**Nombre:** `text-[14px] font-bold text-[#f1f5f9]`

**Subtítulo:** `text-[11px] text-[#3d5070]` — formato en color del formato muy apagado + fecha en Geist Mono

**Fecha:** `font-['Geist_Mono'] text-[10px] text-[#2d3f55]`

### Status badges
Sin cambio de colores, solo ajuste de tamaño y font:
```
text-[10px] font-bold px-2.5 py-1 rounded-full border
```
Live dot: `w-[5px] h-[5px] rounded-full animate-[pulse-dot_1.8s_ease-in-out_infinite]`

### Card footer
```
bg-black/15 border-t border-white/5
```
Botón "Entrar →": color del formato, `font-bold text-[12px]`  
Botón delete: `text-[#334155] hover:text-[#ef4444] hover:bg-[#ef4444]/5`

### Empty state
```
Ícono:   bg-white/3 border border-white/7 rounded-[20px] w-[60px] h-[60px]
Título:  text-[16px] font-black
Sub:     text-[13px] text-[#334155] leading-[1.55]
CTA:     bg-[#84cc16] text-[#14532d] font-black rounded-[12px] shadow-[0_4px_16px_rgba(132,204,22,0.2)]
```

---

## 8. Logo — plan de integración

| Contexto | Solución temporal (sin SVG) | Solución definitiva |
|---|---|---|
| Home header | CSS: `Padeldesk` Bricolage 800 + `•` lima | `<img src="/logo-white.svg">` 130px |
| THeader / Panel | CSS: misma recreación | `<img>` 110–120px |
| Landing hero (futuro) | CSS enlarged | `<img>` con tamaño mayor |

**Acción pendiente:** exportar wordmark blanco sobre fondo transparente → guardar como `src/assets/logo-white.svg` (preferido) o `logo-white.png`.

---

## 9. Lo que NO cambia en Fase 1

- Estructura de rutas y lógica de negocio
- `useTournament.js` y Firebase layer
- Lógica de formatos (`americano.js`, `relampago.js`, etc.)
- Layout y estructura HTML de los componentes Play y Setup (Fase 2)
- Variables `@theme` en `index.css` — no se modifican, se construye encima
- Commits en español, formato `tipo: descripción`

---

## 10. Orden de implementación sugerido

1. `index.html` — agregar Geist Mono a Google Fonts import
2. `index.css` — agregar `.bg-app`, `.bg-grid`, keyframes `pulse-dot` y `score-pop`
3. `Home.jsx` — background + hero + CTA + input código
4. `Components.jsx` — THeader (glow ambiental + format label + código Geist Mono) + Tabs + SimpleModal sin cambios visuales
5. `MatchCard.jsx` — glassmorphism sutil + scores Geist Mono + botón con color de formato
6. `Panel.jsx` — background + cards con glow + empty state

Cada paso es un commit independiente con build limpio.
