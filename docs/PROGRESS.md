# Progreso

Se actualiza al cerrar cada hito. Detalle de cada plan en `docs/plans/M{n}.md`, decisiones en `docs/DECISIONS.md`, chequeos a mano en `docs/MANUAL-CHECKS.md`, bloqueos en `docs/BLOCKERS.md`.

## Estado

| Hito                                | Estado       | Notas                                                                              |
| ----------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| M0 Base del monorepo                | ✅ cerrado   | `pnpm dev` conecta web ↔ server (verificado en Chromium). Review hecha y aplicada. |
| M1 Motor de reglas                  | ⏳ siguiente |                                                                                    |
| M2 Salas y lobby                    | —            |                                                                                    |
| M3 Partida jugable                  | —            |                                                                                    |
| M4 Arte y layout                    | —            |                                                                                    |
| M5 Animaciones                      | —            |                                                                                    |
| M6 Sonido                           | —            |                                                                                    |
| M7 Tutorial, reglas, social         | —            |                                                                                    |
| M8 Deploy (preparado, sin deployar) | —            |                                                                                    |
| M9 Extras                           | —            |                                                                                    |

## Bloqueos

Ninguno.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Node 24 LTS (ADR-001), TypeScript 6.0 (ADR-007), ESLint 10 (ADR-010).
- `@clave/shared` se consume como fuente TS, sin `src/` (ADR-009, ADR-016).
- Server bundleado con tsup (ADR-011); Socket.IO rechaza orígenes por `allowRequest` (ADR-012).
- Floor guard en `commit-msg` con trailer `Floor-Test-Change` (ADR-015); reglas de hookify commiteadas (ADR-014).
- Modo autónomo desde M1 (ADR-017).

## Qué probar a mano en tu Mint (Node 24)

```bash
corepack enable && pnpm install
pnpm dev
```

Abrí http://localhost:5173 → "Conectado". Cortá el server (Ctrl+C) → "Se te cortó. Reconectando…".
