# Dynamic Tournament Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `TOURNAMENT_RULES` object with a `generateRules(type, config)` function that returns rule text personalized to each tournament's configuration.

**Architecture:** Add `generateRules(type, config) → string[]` to `constants.js`, remove the static `TOURNAMENT_RULES` export, and update the 4 Play components to call `generateRules(t.type, t.config)` instead.

**Tech Stack:** JavaScript, React, Tailwind CSS, Vite

---

## File Map

| File | Change |
|---|---|
| `src/logic/constants.js` | Remove `TOURNAMENT_RULES`, add `generateRules(type, config)` |
| `src/components/play/PlayAmericano.jsx` | Replace `TOURNAMENT_RULES.americano` import + usage |
| `src/components/play/PlayRelampago.jsx` | Replace `TOURNAMENT_RULES.relampago` import + usage |
| `src/components/play/PlayMundialito.jsx` | Replace `TOURNAMENT_RULES.mundialito` import + usage |
| `src/components/play/PlayPozo.jsx` | Replace `TOURNAMENT_RULES.pozo` import + usage |

---

### Task 1: Add `generateRules` to constants.js and remove `TOURNAMENT_RULES`

**Files:**
- Modify: `src/logic/constants.js`

- [ ] **Step 1: Remove `TOURNAMENT_RULES` and add `generateRules`**

In `src/logic/constants.js`, delete the entire `export const TOURNAMENT_RULES = { ... }` block (lines 46–71) and add the following after the `TOURNAMENT_TYPES` array:

```js
export function generateRules(type, config) {
  function scoringDesc() {
    const s = config.scoringSystem || "timed";
    if (s === "rally") return `Partidos en rally scoring a ${config.rallyPoints ?? 24} puntos.`;
    if (s === "games") return `Partidos al primero en llegar a ${config.targetGames ?? 6} juegos.`;
    const metric = (config.timedMetric ?? "games") === "games" ? "juegos" : "puntos acumulados";
    return `Partidos de ${config.matchMinutes ?? 10} minutos. Se cuentan ${metric}.`;
  }

  function goldenPointDesc() {
    return config.goldenPoint !== false
      ? "En caso de empate se define con un Punto de Oro."
      : "Los empates cuentan como 1 punto para cada participante.";
  }

  switch (type) {
    case "americano": {
      const rules = [
        scoringDesc(),
        goldenPointDesc(),
        (config.mode === "individual" || !config.mode)
          ? "Modo individual: cada jugador rota solo según su clasificación."
          : "Modo parejas: las parejas rotan juntas según su clasificación.",
        config.maxRounds
          ? `El torneo tiene ${config.maxRounds} rondas en total.`
          : "Sin límite de rondas fijo; el organizador decide cuándo terminar.",
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego simultáneamente.`,
      ];
      if (config.useLevels) {
        rules.push("Los jugadores están divididos por nivel (N1/N2). Las rotaciones respetan los niveles.");
      }
      return rules;
    }
    case "relampago":
      return [
        "Eliminación directa. El que pierde pasa al cuadro de revancha y sigue jugando.",
        scoringDesc(),
        goldenPointDesc(),
        `${config.courts ?? 2} ${(config.courts ?? 2) === 1 ? "pista" : "pistas"} en juego. El cuadro se genera automáticamente.`,
      ];
    case "mundialito":
      return [
        `${config.groupCount ?? 2} ${(config.groupCount ?? 2) === 1 ? "grupo" : "grupos"} en fase inicial. Los ${config.advancePerGroup ?? 2} mejores de cada grupo avanzan a eliminatorias.`,
        "Victoria = 3 puntos · Empate = 1 punto · Derrota = 0 puntos.",
        "El desempate en tabla se define por diferencia de juegos (GF − GC).",
        scoringDesc(),
        goldenPointDesc(),
      ];
    case "pozo": {
      const courts = config.courts ?? 2;
      const rules = [
        `${courts} ${courts === 1 ? "pista" : "pistas"} en juego. La Pista 1 es El Pozo — el objetivo es llegar y mantenerse ahí.`,
        scoringDesc(),
        "Al sonar la campana: ganadores suben una pista, perdedores bajan una pista.",
      ];
      if (config.pozoMode === "fixed" && config.targetRounds) {
        rules.push(`El torneo tiene ${config.targetRounds} rondas en total.`);
      } else {
        rules.push("Sin límite de rondas fijo; el organizador para el torneo cuando lo decide.");
      }
      return rules;
    }
    default:
      return [];
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: `✓ built in X.XXs` with no errors.

---

### Task 2: Update PlayAmericano

**Files:**
- Modify: `src/components/play/PlayAmericano.jsx`

- [ ] **Step 1: Replace import**

Line 2 — change:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```
to:
```js
import { generateRules } from "../../logic/constants";
```

- [ ] **Step 2: Replace rules rendering**

Around line 424, change:
```jsx
{TOURNAMENT_RULES.americano.map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>
    {rule}
  </li>
))}
```
to:
```jsx
{generateRules(t.type, t.config).map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>
    {rule}
  </li>
))}
```

---

### Task 3: Update PlayRelampago

**Files:**
- Modify: `src/components/play/PlayRelampago.jsx`

- [ ] **Step 1: Replace import**

Line 3 — change:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```
to:
```js
import { generateRules } from "../../logic/constants";
```

- [ ] **Step 2: Replace rules rendering**

Around line 427, change:
```jsx
{TOURNAMENT_RULES.relampago.map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
))}
```
to:
```jsx
{generateRules(t.type, t.config).map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
))}
```

---

### Task 4: Update PlayMundialito

**Files:**
- Modify: `src/components/play/PlayMundialito.jsx`

- [ ] **Step 1: Replace import**

Line 3 — change:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```
to:
```js
import { generateRules } from "../../logic/constants";
```

- [ ] **Step 2: Replace rules rendering**

Around line 696, change:
```jsx
{TOURNAMENT_RULES.mundialito.map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>
    {rule}
  </li>
))}
```
to:
```jsx
{generateRules(t.type, t.config).map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>
    {rule}
  </li>
))}
```

---

### Task 5: Update PlayPozo

**Files:**
- Modify: `src/components/play/PlayPozo.jsx`

- [ ] **Step 1: Replace import**

Line 4 — change:
```js
import { TOURNAMENT_RULES } from "../../logic/constants";
```
to:
```js
import { generateRules } from "../../logic/constants";
```

- [ ] **Step 2: Replace rules rendering**

Around line 677, change:
```jsx
{TOURNAMENT_RULES.pozo.map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
))}
```
to:
```jsx
{generateRules(t.type, t.config).map((rule, i) => (
  <li key={i} style={{ marginBottom: 10 }}>{rule}</li>
))}
```

---

### Task 6: Final build + commit

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: `✓ built in X.XXs`

- [ ] **Step 2: Commit**

```bash
git add src/logic/constants.js \
        src/components/play/PlayAmericano.jsx \
        src/components/play/PlayRelampago.jsx \
        src/components/play/PlayMundialito.jsx \
        src/components/play/PlayPozo.jsx
git commit -m "feat: reglas dinámicas según configuración del torneo"
```
