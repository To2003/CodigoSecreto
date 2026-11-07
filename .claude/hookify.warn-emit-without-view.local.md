---
name: warn-emit-without-view
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: apps/server/src/(?!views/).*(?<!\.test)\.ts$
  - field: content
    operator: regex_match
    pattern: \.emit\(
  - field: content
    operator: regex_match
    pattern: cards|keyMap|\.type\b
  - field: content
    operator: not_contains
    pattern: toPublicView
---

⚠️ **Posible filtración del mapa clave (SPEC §2.1).**

Este código emite algo que menciona cartas/tipos y no pasa por `toPublicView(state, playerId)`.

- Todo estado de partida que viaja a un jugador sale de `apps/server/src/views/`.
- El `type` de una carta no revelada solo puede llegar a un jefe.
- Corré el test anti-filtración (`apps/server/src/views/anti-leak.test.ts`) antes de seguir.

Es una heurística: si el emit no lleva estado de cartas, ignorá el aviso.
