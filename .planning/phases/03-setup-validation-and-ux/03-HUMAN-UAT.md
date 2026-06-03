---
status: resolved
phase: 03-setup-validation-and-ux
source: [03-VERIFICATION.md]
started: 2026-06-03T21:53:12Z
updated: 2026-06-03T21:53:12Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Banner aparece y no bloquea Iniciar
expected: Con useLevels=ON y todos los jugadores en nivel 0, aparece banner amarillo. Al pulsar "Continuar" desaparece. El botón "Iniciar Torneo" sigue habilitado.
result: approved (checkpoint humano 2026-06-03)

### 2. Botón re-sorteo cambia texto y onStart usa schedule local
expected: Pulsar "🔀 Generar emparejamiento" → cambia a "✓ Emparejamiento listo — Re-sortear". Al iniciar, PlayAmericano muestra el schedule del último re-sorteo.
result: approved (checkpoint humano 2026-06-03)

### 3. Botón ausente cuando status=playing
expected: Una vez que el torneo está iniciado (status=playing), el botón de re-sorteo no aparece en el setup.
result: approved (2026-06-04)

### 4. Botón ausente con matchmaking=mexicano
expected: En setup, al cambiar emparejamiento a "Mexicano", el botón de re-sorteo desaparece.
result: approved (2026-06-04)

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
