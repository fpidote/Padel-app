# Americano Manual — Diseño

**Fecha:** 2026-06-10  
**Estado:** Aprobado por el usuario  
**Scope:** Modo de emparejamiento manual para el torneo Americano individual

---

## 1. Resumen

El organizador puede armar los emparejamientos, parejas y rondas del Americano completamente a mano, en lugar de depender del algoritmo automático. El modo Manual se integra como tercera opción de emparejamiento (junto a Americano y Mexicano) y produce la misma estructura de datos `precomputedRounds` que ya consume `PlayAmericano` — sin cambios al componente de juego.

---

## 2. Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Cuándo se arman los emparejamientos? | En Setup, antes de lanzar (todas las rondas upfront) |
| ¿Modelo de interacción? | Dropdowns por slot (A1, A2 vs B1, B2) |
| ¿Dónde vive el builder? | Pantalla dedicada con ← Volver al setup |
| ¿Quién descansa? | Automático: los jugadores no asignados a ninguna cancha |
| ¿Coexiste con el automático? | Sí, "Manual" es la 3ra opción de emparejamiento |
| ¿Cuántas rondas? | El builder mismo controla la cantidad (botón +). No usa `maxRounds`. |
| ¿Gate de lanzamiento? | Al menos 1 ronda, todas las rondas agregadas completas |
| ¿Aplica a modo `pairs`? | No. Solo para modo `individual`. |

---

## 3. Arquitectura y flujo de datos

```
SetupAmericano
  └── [cuando matchmaking === "manual"]
       └── botón "✏️ Armar rondas"
            └── monta ManualRoundBuilder (pantalla full)
                     ↓ onChange(rounds)
              localManualRounds (estado local en SetupAmericano)
                     ↓ al presionar "Iniciar"
              t.precomputedRounds (mismo formato de siempre)
                     ↓ consume
              PlayAmericano (sin cambios)
```

**Ningún cambio a `PlayAmericano`.** El componente de juego ya sabe consumir `precomputedRounds` y no necesita saber si las rondas fueron generadas automáticamente o manualmente.

---

## 4. Cambios en `SetupAmericano`

### 4.1 Selector de emparejamiento

En la sección "Configuración avanzada", el selector pasa de 2 a 3 opciones:

```
[ Americano ]  [ Mexicano ]  [ Manual ]
```

Descripción debajo de cada opción:
- **Americano:** "Parejas aleatorias cada ronda"
- **Mexicano:** "Desde ronda 2, los mejores juegan entre sí"
- **Manual:** "Vos elegís los emparejamientos de cada ronda"

### 4.2 Sección "Rondas" en modo Manual

Cuando `matchmaking === "manual"`, la sección "Rondas" (con los botones 4/6/8/10/12/Ilimitadas) se **oculta**. La cantidad de rondas la determina el builder.

### 4.3 Nuevo botón y tracker de estado

Cuando `matchmaking === "manual"`, aparece una nueva sección entre el selector de emparejamiento y el CTA de lanzar:

```
── ✏️ Rondas manuales ──────────────────

  [ ✏️ Armar rondas ]

  Estado: 2 de 3 rondas completas   ← actualiza en tiempo real
```

El tracker se calcula desde `localManualRounds`:
- `0 rondas agregadas` → "Sin rondas armadas"
- Rondas parciales → "N de M rondas completas" (texto amarillo)
- Todas completas → "✓ N rondas listas" (texto verde)

### 4.4 Gate en el botón "Revisar y lanzar"

```js
const manualReady = (t.config.matchmaking !== "manual") || (
  localManualRounds.length >= 1 &&
  localManualRounds.every(r =>
    r.courts.every(c =>
      c.pairA.length === 2 && c.pairA.every(Boolean) &&
      c.pairB.length === 2 && c.pairB.every(Boolean)
    )
  )
);

const ok = /* condición actual */ && manualReady;
```

### 4.5 Modal "Revisar y lanzar"

Cuando el modo es manual, la tab "Emparejamientos" muestra `localManualRounds` con el mismo render que hoy usa para los pre-calculados automáticos. Sin cambios en el modal.

### 4.6 `onStart` en modo manual

```js
if (matchmaking === "manual") {
  precomputedRounds = localManualRounds.map(r => ({
    ...r,
    sittingOut: calcularDescansos(entities, r.courts)
  }));
  const firstRound = precomputedRounds[0];
  currentRound = firstRound.courts.map(c => ({ ...c, scoreA: "", scoreB: "", saved: false }));
  sittingOut = firstRound.sittingOut;
}
```

`calcularDescansos(entities, courts)` devuelve los jugadores de `entities` que no aparecen en ningún slot de `courts`.

---

## 5. Componente `ManualRoundBuilder`

**Archivo:** `src/components/setup/ManualRoundBuilder.jsx`

**Props:**
```js
ManualRoundBuilder({
  players,    // array de jugadores (de t.playerInputs mapeados con id/name/level)
  courts,     // número de canchas (t.config.courts)
  rounds,     // array actual de rondas manuales (localManualRounds)
  onChange,   // callback(newRounds) — llamado en cada cambio
  onBack,     // callback — vuelve al setup
})
```

### 5.1 Layout de la pantalla

```
← Volver al setup                    Armar Rondas
──────────────────────────────────────────────────

[ R1 ✓ ] [ R2 ✗ ] [ R3 ✗ ] [ + ]    ← tabs de rondas

──────────────────────────────────────────────────

  PISTA 1
  ┌─────────────┐   vs   ┌─────────────┐
  │  Elegir ▾   │        │  Elegir ▾   │
  │  Elegir ▾   │        │  Elegir ▾   │
  └─────────────┘        └─────────────┘

  PISTA 2
  ┌─────────────┐   vs   ┌─────────────┐
  │  Lucas  ▾   │        │  Elegir ▾   │
  │  Mati   ▾   │        │  Elegir ▾   │
  └─────────────┘        └─────────────┘

  ⏳ Descansan: Fer, Santi

  ✗ Faltan 3 jugadores por asignar
```

### 5.2 Tabs de rondas

- Una tab por ronda en `rounds`
- Indicador: ✓ verde (completa) | ✗ gris (incompleta)
- Tab activa: resaltada con `#0284c7`
- Último elemento: botón `[ + ]` que agrega una nueva ronda vacía al final
- Las rondas vacías se inicializan con `courts` canchas, cada una con 4 slots `null`

### 5.3 Dropdowns por slot

Cada cancha tiene 4 `<select>` nativos del browser:
- Posición izquierda (pairA): slots A1 y A2
- Posición derecha (pairB): slots B1 y B2

**Opciones de cada dropdown:**
1. `"— elegir —"` (value `""`)
2. Jugadores disponibles en esa ronda = `players` que no están asignados en ningún otro slot de esa ronda, **más** el jugador actualmente seleccionado en ese slot (para que no desaparezca su opción activa)

Orden de las opciones: el jugador actualmente seleccionado primero, luego el resto en orden de aparición.

### 5.4 Descansos automáticos

Línea de solo lectura debajo de las canchas:
- Si hay jugadores sin asignar: *"⏳ Descansan: [nombres separados por coma]"*
- Si todos están asignados: no se muestra

### 5.5 Indicador de estado por ronda

Debajo de las canchas, una línea que muestra:
- ✗ rojo: *"Faltan N jugadores por asignar"* (cuando algún slot está vacío)
- ✓ verde: *"Ronda completa"* (cuando todos los slots tienen jugador)

---

## 6. Modelo de datos

### 6.1 Formato de `localManualRounds`

```js
[
  {
    courts: [
      {
        pairA: [
          { id: 0, name: "Mati", level: 2, pts: 0, gf: 0, gc: 0 },
          { id: 1, name: "Lucas", level: 1, pts: 0, gf: 0, gc: 0 }
        ],
        pairB: [
          { id: 2, name: "Fer", level: 3, pts: 0, gf: 0, gc: 0 },
          { id: 3, name: "Santi", level: 0, pts: 0, gf: 0, gc: 0 }
        ],
        scoreA: "",
        scoreB: "",
        saved: false
      }
    ],
    sittingOut: []  // se rellena al lanzar, no durante el builder
  }
]
```

Este formato es **idéntico** al producido por `precomputeAllRounds`. No se requiere transformación — solo agregar `sittingOut` al lanzar.

### 6.2 Representación interna en el builder

Durante la edición, `pairA` y `pairB` son siempre arrays de longitud 2, pero los elementos pueden ser `null` (slot vacío) o un objeto jugador (slot asignado):

```js
// Ronda en construcción — slots parcialmente asignados
{
  courts: [
    {
      pairA: [{ id: 0, name: "Mati", ... }, null],   // A1 asignado, A2 vacío
      pairB: [null, null],                            // B1 y B2 vacíos
      scoreA: "", scoreB: "", saved: false
    }
  ],
  sittingOut: []
}
```

`Boolean(null) === false`, por eso la validación usa `c.pairA.every(Boolean)`. Los slots `null` nunca llegan a Firestore — el gate de lanzamiento los bloquea.

---

## 7. Casos borde

| Caso | Comportamiento |
|---|---|
| El organizador cambia el nº de canchas con rondas ya armadas | `localManualRounds` se resetea a `[]`. Banner: *"Cambiaste las pistas — el armado manual se reinició."* |
| El organizador cambia de modo Manual a Americano/Mexicano | `localManualRounds` se descarta silenciosamente |
| El organizador vuelve a Manual | Empieza con `localManualRounds = []` |
| Menos jugadores que `4 × courts` | El builder funciona normalmente. Habrá menos jugadores disponibles en los dropdowns y algunos descansos. |
| Exactamente `4 × courts` jugadores | Todos asignados, sin descansos. |
| Un jugador ya fue seleccionado en otro slot de la misma ronda | No aparece en las opciones de los demás dropdowns de esa ronda. |
| Modo `pairs` (Parejas Fijas) | La opción "Manual" no aparece en el selector de emparejamiento. Solo aplica a modo `individual`. |

---

## 8. Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `src/components/setup/SetupAmericano.jsx` | Modificación: selector de emparejamiento, nueva sección, gate de lanzamiento, `onStart` |
| `src/components/setup/ManualRoundBuilder.jsx` | **Nuevo componente** |
| `src/logic/americano.js` | Sin cambios |
| `src/components/play/PlayAmericano.jsx` | Sin cambios |
| `src/logic/initTournament.js` | Sin cambios |

---

## 9. Lo que queda fuera de scope

- Modo Manual para Parejas Fijas (`mode === "pairs"`)
- Edición de rondas durante el torneo (mid-tournament manual overrides)
- Sugerencias automáticas como punto de partida (auto-completado)
- Drag & drop como modelo de interacción alternativo
