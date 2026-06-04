# Diseño: Unificación Estética de Padeldesk

**Fecha:** 2026-06-04
**Alcance:** Todas las pantallas y componentes de la app
**Enfoque:** Extender la estética de `Home.jsx` como canon, mejorar mientras se migra

---

## Contexto

La app tiene dos capas de código coexistiendo:
- `Home.jsx`, `SetupAmericano`, `MatchCard` — Tailwind limpio, bien estructurado
- `Panel.jsx`, `Components.jsx` (THeader, Tabs, SimpleModal), estados de carga — inline styles legacy con la función `B()`

Además hay inconsistencias de color sutiles (`#111827` vs `#0f172a` como fondo, `#1f2937` vs `#1e293b` como superficie) y tipografía genérica (`system-ui`) en toda la app.

---

## Decisiones de diseño

### Tipografía
**Fuente elegida: Bricolage Grotesque**
- Pesos a importar: 400, 600, 700, 800
- Cargada vía Google Fonts en `index.html`
- Aplicada globalmente en `body` de `index.css`
- Carácter editorial-deportivo que distingue la app sin ser genérica

### Header del torneo (THeader)
**Opción elegida: Gradiente suave del color del formato**
- `background: linear-gradient(135deg, {typeColor}22 0%, #0f172a 70%)`
- `border-bottom: 1px solid {typeColor}30`
- El nombre del torneo pasa de cyan fijo a `text-[#f1f5f9]` — más legible
- Cada formato tiene su propio gradiente: azul (Americano), violeta (Relámpago), verde (Mundialito), naranja (El Pozo)
- Sin gradiente azul fijo — desacoplado del color de formato

### Color del indicador activo en Tabs
- Antes: `#38bdf8` (cyan)
- Después: `#84cc16` (lima) — color de marca de la app
- Texto activo: `#f1f5f9` con underline lima, texto inactivo: `#64748b`

### Jerarquía de botones CTA
- **Primario:** `bg-[#84cc16] text-[#14532d] font-black` — consistente en toda la app
- **Secundario/acción de formato:** color del tipo de torneo como `text-color` sin fondo sólido
- **Destructivo:** ghost rojo — `bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20`
- **Neutro:** `bg-[#334155] text-[#94a3b8]`

---

## Plan de implementación por capas

### Capa 1 — Fundación global

**`index.html`**
- Agregar `<link>` de Google Fonts para Bricolage Grotesque (pesos 400, 600, 700, 800)

**`src/index.css`**
- `font-family` del `body`: `'Bricolage Grotesque', system-ui, sans-serif`
- Sin cambios a las variables `@theme` — ya están bien definidas

**`src/Home.jsx`**
- Fondo del wrapper: `#111827` → `bg-bg` (equivale a `#0f172a`)
- Reemplazar todos los `bg-[#1f2937]` por `bg-card` (`#1e293b`)

---

### Capa 2 — Componentes compartidos (`Components.jsx`)

**THeader** — reescribir con Tailwind:
```jsx
// Gradiente dinámico con el color del formato
style={{ background: `linear-gradient(135deg, ${typeInfo.color}22 0%, #0f172a 70%)`,
         borderBottom: `1px solid ${typeInfo.color}30` }}
// Nombre del torneo: text-[#f1f5f9] font-black (ya no cyan)
// Badge Admin: sin cambios
// Botón código: bg-card border border-border text-muted
```

**Tabs** — migrar a Tailwind:
```jsx
// Contenedor: flex border-b border-[#1e293b]
// Tab activo: text-[#f1f5f9] font-bold border-b-2 border-[#84cc16]
// Tab inactivo: text-muted font-semibold
```

**SimpleModal** — migrar a Tailwind. Se agrega prop opcional `icon` (emoji string):
```jsx
// Signatura: SimpleModal({ message, onClose, onConfirm, confirmLabel, icon })
// Wrapper: fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6
// Card: bg-card border border-border rounded-2xl p-7 max-w-xs w-full text-center
// Ícono (si se pasa): <div className="text-3xl mb-3">{icon}</div>
// Mensaje: text-sm font-semibold text-ink mb-1 (título corto)
// Sub-mensaje (segunda línea si se divide): text-sm text-muted mb-6
// Botón cancelar: flex-1 bg-[#334155] text-muted rounded-xl py-3 font-bold
// Botón destructivo: flex-1 bg-danger/10 text-danger border border-danger/20 rounded-xl py-3 font-bold
// Los llamadores existentes (Panel.jsx) no se rompen — icon es opcional
```

**PTag, PName, PairName** — migración inline → Tailwind sin cambio visual.

---

### Capa 3 — Panel.jsx

**Header:**
- Botón back: `w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted`
- Título: `text-xl font-black text-ink`
- Contador: `text-sm font-semibold text-muted ml-auto`

**Cards de torneo:**
```
bg-card border border-border rounded-2xl overflow-hidden
├── Inner: border-l-4 (color del formato) + padding
│   ├── Ícono: w-9 h-9 rounded-xl bg-[typeColor]/10 flex items-center justify-center
│   ├── Nombre: text-sm font-bold text-ink
│   └── Meta: text-xs text-muted
├── Status badge: sin cambios (ya bien definidos)
└── Footer: flex border-t border-border
    ├── Botón Entrar: flex-1 text-center text-[typeColor] font-bold py-2.5
    ├── Separador: w-px bg-border
    └── Botón Borrar: text-muted hover:text-danger icono 🗑
```

**Empty state:**
```
Ícono en card: w-12 h-12 rounded-2xl bg-card border border-border
Título: text-base font-bold text-ink
Subtítulo: text-sm text-muted
CTA: bg-[#84cc16] text-[#14532d] font-black rounded-xl px-5 py-2.5
```

---

### Capa 4 — TournamentPage

**Estado de carga** (inline → Tailwind):
```jsx
<div className="min-h-screen flex items-center justify-center">
  <span className="text-sm font-semibold text-muted animate-pulse">Cargando torneo...</span>
</div>
```

**Estados error / notFound:** ya usan Tailwind. Un ajuste:
- Botón de acción: `bg-[#84cc16] text-[#14532d] font-black` (CTA primario consistente)

---

### Capa 5 — Componentes Play y Setup

**SetupAmericano / SetupPairs:**
- Eliminar `const COLOR = "#0284c7"` (ya no necesario con el sistema de diseño)
- Botones primarios de lanzar torneo: `bg-[#84cc16] text-[#14532d] font-black`
- Sin cambios de layout

**PlayAmericano / PlayRelampago / PlayMundialito / PlayPozo:**
- Reemplazar cada `B(color, extras)` por clases Tailwind equivalentes
- Patrón de sustitución: `B("#0284c7")` → `bg-[#0284c7] text-white font-bold rounded-lg px-4 py-2 cursor-pointer`

**PairStandings / History:**
- Migrar inline styles a Tailwind sin cambio visual

---

## Reglas del sistema resultante

1. **Font:** Bricolage Grotesque en toda la app — no agregar otras fuentes
2. **Fondo:** `#0f172a` (`bg-bg`) — sin `#111827` ni otros grises oscuros
3. **Superficie:** `#1e293b` (`bg-card`) — sin `#1f2937`
4. **CTA primario global:** `bg-[#84cc16] text-[#14532d] font-black` — el elemento más prominente de cada pantalla
5. **Header de torneo:** gradiente suave del color del formato — nunca azul fijo
6. **Tab activo:** lima (`#84cc16`) — no cyan
7. **Sin `B()`:** la función queda en `constants.js` pero no se usa en código nuevo ni migrado
8. **Sin estilos inline** excepto los colores dinámicos del formato (`style={{ color: tt.color }}`)

---

## Lo que NO cambia

- Estructura de rutas y componentes
- Lógica de negocio (americano.js, relampago.js, etc.)
- Colores de los formatos en `constants.js`
- Firebase / useTournament.js
- MatchCard (ya está bien en Tailwind)
- Commits en español con formato `tipo: descripción`
