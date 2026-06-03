---
status: complete
phase: 02-playamericano-wire-up
source:
  - .planning/phases/02-playamericano-wire-up/02-01-SUMMARY.md
started: "2026-06-03T17:30:00.000Z"
updated: "2026-06-03T17:35:00.000Z"
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Avanzar rondas desde precomputedRounds
expected: En un torneo Americano con niveles activados (useLevels=ON, 8+ jugadores), al presionar "Siguiente Ronda" el torneo avanza usando las rondas pre-calculadas — las pistas y descansos corresponden al schedule del algoritmo, no a un sorteo nuevo en el momento.
result: pass

### 2. Torneo termina al agotar el schedule
expected: Después de jugar la última ronda del schedule pre-calculado, el botón "Siguiente Ronda" desaparece (o el torneo se marca como finalizado). No aparece una ronda extra más allá de las calculadas.
result: pass

### 3. Tab Descansos visible para todos
expected: En un torneo con precomputedRounds, aparece un 5to tab "💤 Descansos" tanto para el admin como para espectadores. Al abrirlo, se ven todas las rondas listadas con los jugadores que descansan en cada una. Las rondas sin descanso muestran "Nadie descansa".
result: pass

### 4. Ronda actual resaltada en Descansos
expected: En el tab Descansos, la fila de la ronda actualmente en juego tiene fondo amarillo (bg-yellow-400/10) y un marcador "●" junto al número de ronda. El resto de las filas tienen fondo gris estándar.
result: pass

### 5. WarningsBanner solo visible para admin
expected: Si el algoritmo relajó alguna restricción al calcular el schedule (por ejemplo, repitió pareja), el admin ve un banner colapsable en color ámbar sobre los tabs con el texto "⚠️ Restricciones relajadas". Al hacer clic el banner se expande mostrando los mensajes. Un espectador no ve ese banner.
result: skipped
reason: No tiene torneo con warnings disponible para testear

### 6. Fallback legacy sin precomputedRounds
expected: En un torneo Americano antiguo (sin precomputedRounds en Firestore), al presionar "Siguiente Ronda" el torneo avanza normalmente — sin errores ni pantalla rota. El tab Descansos no aparece. No hay WarningsBanner.
result: skipped
reason: No tiene torneo legacy disponible para testear

## Summary

total: 6
passed: 4
issues: 0
pending: 0
skipped: 2

## Gaps

[none yet]
