# Progreso

Se actualiza al cerrar cada hito. Detalle de cada plan en `docs/plans/M{n}.md`, decisiones en `docs/DECISIONS.md`, chequeos a mano en `docs/MANUAL-CHECKS.md`, bloqueos en `docs/BLOCKERS.md`.

## Estado

| Hito                                | Estado       | Notas                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Base del monorepo                | ✅ cerrado   | `pnpm dev` conecta web ↔ server (verificado en Chromium). Review hecha y aplicada.                                                                                                                                                                                                                                                                    |
| M1 Motor de reglas                  | ✅ cerrado   | Motor puro, 100% líneas/ramas, 600 partidas aleatorias en tests, simulación por consola. Mazos: Clásico 814, Argento 255.                                                                                                                                                                                                                             |
| M2 Salas y lobby                    | ✅ cerrado   | Crear/unirse por código o link, equipos, roles, host, kick, settings, reconexión por token. E2E con 4 jugadores: cambio de equipo en 11 ms.                                                                                                                                                                                                           |
| M3 Partida jugable                  | ✅ cerrado   | Partida completa con vista filtrada por jugador, pausa/reasignación de jefe, revancha. Anti-filtración por sockets reales en 3 escenarios. Review: 2 críticos de seguridad encontrados y arreglados.                                                                                                                                                  |
| M4 Arte y layout                    | ✅ cerrado   | Dirección de arte de expedientes, cartas y avatares SVG, layout desktop/mobile, modo daltónico, Ajustes. Palabras que nunca se cortan (E2E a 320/375/1440 con las 50 más anchas, ocultas y reveladas). axe sin violaciones serias. Bundle 130 KB gzip. Review aplicada.                                                                               |
| M5 Animaciones                      | ✅ cerrado   | Todo SPEC §4 en CSS (flip, sacudón, traidor, barrido de turno, máquina de escribir, contadores, confeti solo para ganadores). Movimiento reducido (sistema o Ajustes) sin flips ni sacudones, probado también con rival y traidor y al cambiarlo en plena partida. CPU ×4 en build de producción: mediana 16,7 ms, peor frame 33 ms. Review aplicada. |
| M6 Sonido                           | ✅ cerrado   | Efectos y dos músicas sintetizados con Web Audio (sin archivos, ADR-025), canales con volumen persistido, desbloqueo en el primer gesto, título que parpadea con la pestaña de fondo. iOS Safari queda para probar a mano. Lista de assets reales en `docs/AUDIO-ASSETS.md`.                                                                          |
| M7 Tutorial, reglas, social         | ⏳ siguiente |                                                                                                                                                                                                                                                                                                                                                       |
| M8 Deploy (preparado, sin deployar) | —            |                                                                                                                                                                                                                                                                                                                                                       |
| M9 Extras                           | —            |                                                                                                                                                                                                                                                                                                                                                       |

## ⚠️ Para revisar, Tomás

- **Desvío del SPEC §1.8 (ADR-022)**: el SPEC pide RNG con seed (`mulberry32`) para partidas reproducibles. La review de M3 demostró que con eso, cualquier agente reconstruía el mapa clave desde la consola en ~5 s a partir de los IDs de carta. En el server ahora el RNG es criptográfico; el motor sigue aceptando un RNG con seed para tests y simulación. Si querés replays, está anotado en el backlog cómo hacerlo sin abrir el agujero.
- **Jefe reemplazado** (ADR-022): si el host reasigna al jefe que se cayó, el viejo jefe queda como espectador el resto de esa partida (ya vio el mapa).

- **Bundle inicial +17 KB sobre M4** (151 KB, techo 250): Motion para el lobby, audio sintetizado y efectos. Explicado en `docs/RATCHET.md`. También separé en `size-limit` el bundle inicial del total con chunks lazy (antes se sumaban bajo el nombre "Initial"); los dos quedan bajo 250 KB.
- **E2E contra el build de producción** (ADR-026): `pnpm e2e` ahora hace `vite build` antes; si tenés `pnpm dev` corriendo en el 5173, Playwright reusa ese.

- **Tablas de ratchet** (BACKLOG #7): el floor guard marca cualquier número nuevo en `CONSTRAINTS.md`, incluso al anotar una medición. Dejé los valores en `docs/RATCHET.md` sin tocar CONSTRAINTS; decidí vos cómo querés resolverlo.

## Bloqueos

Ninguno.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Node 24 LTS (ADR-001), TypeScript 6.0 (ADR-007), ESLint 10 (ADR-010).
- `@clave/shared` se consume como fuente TS, sin `src/` (ADR-009, ADR-016).
- Server bundleado con tsup (ADR-011); Socket.IO rechaza orígenes por `allowRequest` (ADR-012).
- Floor guard en `commit-msg` con trailer `Floor-Test-Change` (ADR-015); reglas de hookify commiteadas (ADR-014).
- Modo autónomo desde M1 (ADR-017).
- `room:patch` manda la vista filtrada completa en vez de un diff (ADR-019); detalles de salas en ADR-020.
- Arte y accesibilidad (ADR-023): fuentes empaquetadas, variantes de color AA para texto, íconos de tipo siempre en la vista de jefe, doble tap con armado de 3 s en mobile. Valores medidos en `docs/RATCHET.md`.
- Partida: única salida por `toPublicView`, marcas de señalar solo para el equipo activo, pausa, host que cambia a los 60 s, volver al lobby en cualquier momento (ADR-021). RNG criptográfico y endurecimientos de la review (ADR-022).
- Animaciones en CSS y Motion solo para el layout del lobby (ADR-024); sonido sintetizado con Web Audio, sin Howler hasta que haya archivos (ADR-025); E2E sobre el build de producción (ADR-026).
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

Arte (M4): probá en el celu (misma red, ver MANUAL-CHECKS) el doble toque para dar vuelta y que no haga zoom; activá Ajustes → Modo daltónico y mirá íconos y tramas.

Animaciones (M5): en una partida, dá vuelta una carta propia (brillo y partículas), una rival (sacudón y borde de color), un civil (velo gris) y el traidor (viñeta, sacudón y la carta grande, que se van solos). Después Ajustes → "Reducir animaciones": tienen que quedar solo fundidos cortos. Si podés, grabá un perfil en Chrome de Android (MANUAL-CHECKS).

Sonido (M6): tocá cualquier cosa y sonó un clic; en la sala suena la música del lobby (en el celu arranca apagada). Ajustes → volúmenes, recargá y siguen igual. Dejá la pestaña de fondo cuando le toque a tu equipo: el título parpadea "⚠ ¡Te toca!". Probalo en un iPhone (MANUAL-CHECKS).
