# Valores medidos (ratchet)

Los valores de la tabla "Medidos, todavía no bloqueantes" de `CONSTRAINTS.md`. Viven acá porque el floor guard marca cualquier cambio de número sin dirección dentro de `CONSTRAINTS.md` (también registrar una medición, que endurece la vara). Ver BACKLOG #7. La regla es la misma: estos números no pueden empeorar.

| Métrica                                    | Valor  | Fecha      | Hito | Cómo se mide                                                 |
| ------------------------------------------ | ------ | ---------- | ---- | ------------------------------------------------------------ |
| Cobertura de líneas de `apps/web` (Vitest) | 10.9 % | 2026-11-10 | M7   | `pnpm coverage` (la UI se cubre sobre todo con E2E, ADR-004) |
| Cobertura de líneas de `apps/server`       | 93.2 % | 2026-11-10 | M7   | `pnpm coverage`                                              |
| Bundle inicial (JS + CSS, gzip)            | 159 KB | 2026-11-10 | M7   | `pnpm build` + `pnpm size` (entrada "Initial")               |
| Todo el JS + CSS, chunks lazy incluidos    | 208 KB | 2026-11-10 | M7   | `pnpm size` (entrada "All")                                  |

**Por qué creció el bundle inicial (+17 KB sobre M4, CONSTRAINTS pide explicar más de 5 KB):** el núcleo de Motion para las filas del lobby (`m`, `LayoutGroup`, `MotionConfig`, `LazyMotion`; sus features, 33 KB, ya van aparte), el motor de audio sintetizado de M6 y los efectos de pantalla de M5. Antes de pasar Motion a `LazyMotion` eran 184 KB. Hasta M5 `size-limit` sumaba también los chunks lazy bajo el nombre "Initial"; ahora hay dos entradas y las dos tienen que quedar bajo 250 KB.

**M7 (+8 KB sobre M6):** chat, emotes, objeción, anillo de timer, stats y ayudas van en el bundle inicial porque se usan en la sala; el copy de reglas y tutorial también, porque todo texto vive en `es-AR.ts` (CLAUDE.md). Las pantallas de reglas y tutorial son chunks aparte (11 KB gzip entre las dos).
