# Progreso

Se actualiza al cerrar cada hito. Detalle de cada plan en `docs/plans/M{n}.md`, decisiones en `docs/DECISIONS.md`, chequeos a mano en `docs/MANUAL-CHECKS.md`, bloqueos en `docs/BLOCKERS.md`.

## Estado

| Hito                                | Estado       | Notas                                                                                                                                                                                                |
| ----------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Base del monorepo                | ✅ cerrado   | `pnpm dev` conecta web ↔ server (verificado en Chromium). Review hecha y aplicada.                                                                                                                   |
| M1 Motor de reglas                  | ✅ cerrado   | Motor puro, 100% líneas/ramas, 600 partidas aleatorias en tests, simulación por consola. Mazos: Clásico 814, Argento 255.                                                                            |
| M2 Salas y lobby                    | ✅ cerrado   | Crear/unirse por código o link, equipos, roles, host, kick, settings, reconexión por token. E2E con 4 jugadores: cambio de equipo en 11 ms.                                                          |
| M3 Partida jugable                  | ✅ cerrado   | Partida completa con vista filtrada por jugador, pausa/reasignación de jefe, revancha. Anti-filtración por sockets reales en 3 escenarios. Review: 2 críticos de seguridad encontrados y arreglados. |
| M4 Arte y layout                    | ⏳ siguiente |                                                                                                                                                                                                      |
| M5 Animaciones                      | —            |                                                                                                                                                                                                      |
| M6 Sonido                           | —            |                                                                                                                                                                                                      |
| M7 Tutorial, reglas, social         | —            |                                                                                                                                                                                                      |
| M8 Deploy (preparado, sin deployar) | —            |                                                                                                                                                                                                      |
| M9 Extras                           | —            |                                                                                                                                                                                                      |

## ⚠️ Para revisar, Tomás

- **Desvío del SPEC §1.8 (ADR-022)**: el SPEC pide RNG con seed (`mulberry32`) para partidas reproducibles. La review de M3 demostró que con eso, cualquier agente reconstruía el mapa clave desde la consola en ~5 s a partir de los IDs de carta. En el server ahora el RNG es criptográfico; el motor sigue aceptando un RNG con seed para tests y simulación. Si querés replays, está anotado en el backlog cómo hacerlo sin abrir el agujero.
- **Jefe reemplazado** (ADR-022): si el host reasigna al jefe que se cayó, el viejo jefe queda como espectador el resto de esa partida (ya vio el mapa).

## Bloqueos

Ninguno.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Node 24 LTS (ADR-001), TypeScript 6.0 (ADR-007), ESLint 10 (ADR-010).
- `@clave/shared` se consume como fuente TS, sin `src/` (ADR-009, ADR-016).
- Server bundleado con tsup (ADR-011); Socket.IO rechaza orígenes por `allowRequest` (ADR-012).
- Floor guard en `commit-msg` con trailer `Floor-Test-Change` (ADR-015); reglas de hookify commiteadas (ADR-014).
- Modo autónomo desde M1 (ADR-017).
- `room:patch` manda la vista filtrada completa en vez de un diff (ADR-019); detalles de salas en ADR-020.
- Partida: única salida por `toPublicView`, marcas de señalar solo para el equipo activo, pausa, host que cambia a los 60 s, volver al lobby en cualquier momento (ADR-021). RNG criptográfico y endurecimientos de la review (ADR-022).
- Reglas ambiguas del SPEC resueltas en ADR-018: objeción (quién vota, mayoría estricta, resolución anticipada, penalización con agente al azar del equipo que objetó), plural básico (quitar s/es si quedan 3+ letras), modo mayoría con agentes conectados, revancha que arranca al toque rotando jefes, mezcla de palabras custom por porcentaje.

## Qué probar a mano en tu Mint (Node 24)

```bash
corepack enable && pnpm install
pnpm dev
```

Abrí http://localhost:5173 → "Conectado". Cortá el server (Ctrl+C) → "Se te cortó. Reconectando…".

Motor (M1): `pnpm --filter @clave/shared simulate 4242` imprime una partida completa entre bots, con el mapa clave y cada pista.

Lobby (M2): con `pnpm dev` levantado, abrí 4 ventanas (una normal y tres de incógnito, o distintos navegadores), creá una sala en una y entrá a `/sala/CÓDIGO` en las otras. Armá equipos, apretá F5 en cualquiera y fijate que vuelve a su lugar. E2E automático: `pnpm e2e`.

Partida (M3): con 4 ventanas, armá equipos con un jefe por lado y apretá Empezar. El jefe ve el mapa (cartas teñidas); los agentes no. Probá: una pista que esté en el tablero (te la marca en rojo), señalar y dar vuelta con el ✓, pasar turno, ganar, revancha. Cerrá la ventana del jefe en su turno: el resto ve la pausa; volvé a abrir `/sala/CÓDIGO` en esa misma ventana y sigue.
