# Progreso

Se actualiza al cerrar cada hito. Detalle de cada plan en `docs/plans/M{n}.md`, decisiones en `docs/DECISIONS.md`, chequeos a mano en `docs/MANUAL-CHECKS.md`, bloqueos en `docs/BLOCKERS.md`.

## Estado

| Hito                                | Estado       | Notas                                                                                                                                       |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Base del monorepo                | ✅ cerrado   | `pnpm dev` conecta web ↔ server (verificado en Chromium). Review hecha y aplicada.                                                          |
| M1 Motor de reglas                  | ✅ cerrado   | Motor puro, 100% líneas/ramas, 600 partidas aleatorias en tests, simulación por consola. Mazos: Clásico 814, Argento 255.                   |
| M2 Salas y lobby                    | ✅ cerrado   | Crear/unirse por código o link, equipos, roles, host, kick, settings, reconexión por token. E2E con 4 jugadores: cambio de equipo en 11 ms. |
| M3 Partida jugable                  | ⏳ siguiente |                                                                                                                                             |
| M4 Arte y layout                    | —            |                                                                                                                                             |
| M5 Animaciones                      | —            |                                                                                                                                             |
| M6 Sonido                           | —            |                                                                                                                                             |
| M7 Tutorial, reglas, social         | —            |                                                                                                                                             |
| M8 Deploy (preparado, sin deployar) | —            |                                                                                                                                             |
| M9 Extras                           | —            |                                                                                                                                             |

## Bloqueos

Ninguno.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Node 24 LTS (ADR-001), TypeScript 6.0 (ADR-007), ESLint 10 (ADR-010).
- `@clave/shared` se consume como fuente TS, sin `src/` (ADR-009, ADR-016).
- Server bundleado con tsup (ADR-011); Socket.IO rechaza orígenes por `allowRequest` (ADR-012).
- Floor guard en `commit-msg` con trailer `Floor-Test-Change` (ADR-015); reglas de hookify commiteadas (ADR-014).
- Modo autónomo desde M1 (ADR-017).
- `room:patch` manda la vista filtrada completa en vez de un diff (ADR-019); detalles de salas en ADR-020.
- Reglas ambiguas del SPEC resueltas en ADR-018: objeción (quién vota, mayoría estricta, resolución anticipada, penalización con agente al azar del equipo que objetó), plural básico (quitar s/es si quedan 3+ letras), modo mayoría con agentes conectados, revancha que arranca al toque rotando jefes, mezcla de palabras custom por porcentaje.

## Qué probar a mano en tu Mint (Node 24)

```bash
corepack enable && pnpm install
pnpm dev
```

Abrí http://localhost:5173 → "Conectado". Cortá el server (Ctrl+C) → "Se te cortó. Reconectando…".

Motor (M1): `pnpm --filter @clave/shared simulate 4242` imprime una partida completa entre bots, con el mapa clave y cada pista.

Lobby (M2): con `pnpm dev` levantado, abrí 4 ventanas (una normal y tres de incógnito, o distintos navegadores), creá una sala en una y entrá a `/sala/CÓDIGO` en las otras. Armá equipos, apretá F5 en cualquiera y fijate que vuelve a su lugar. E2E automático: `pnpm e2e`.
