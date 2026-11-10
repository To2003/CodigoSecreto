# Valores medidos (ratchet)

Los valores de la tabla "Medidos, todavía no bloqueantes" de `CONSTRAINTS.md`. Viven acá porque el floor guard marca cualquier cambio de número sin dirección dentro de `CONSTRAINTS.md` (también registrar una medición, que endurece la vara). Ver BACKLOG #7. La regla es la misma: estos números no pueden empeorar.

| Métrica                                    | Valor  | Fecha      | Hito  | Cómo se mide                                                 |
| ------------------------------------------ | ------ | ---------- | ----- | ------------------------------------------------------------ |
| Cobertura de líneas de `apps/web` (Vitest) | 10.5 % | 2026-11-10 | M4    | `pnpm coverage` (la UI se cubre sobre todo con E2E, ADR-004) |
| Cobertura de líneas de `apps/server`       | 91.7 % | 2026-11-10 | M4    | `pnpm coverage`                                              |
| Bundle inicial (JS + CSS, gzip)            | 151 KB | 2026-11-10 | M5–M6 | `pnpm build` + `pnpm size` (entrada "Initial")               |
| Todo el JS + CSS, chunks lazy incluidos    | 188 KB | 2026-11-10 | M5–M6 | `pnpm size` (entrada "All")                                  |

**Por qué creció el bundle inicial (+17 KB sobre M4, CONSTRAINTS pide explicar más de 5 KB):** el núcleo de Motion para las filas del lobby (`m`, `LayoutGroup`, `MotionConfig`, `LazyMotion`; sus features, 33 KB, ya van aparte), el motor de audio sintetizado de M6 y los efectos de pantalla de M5. Antes de pasar Motion a `LazyMotion` eran 184 KB. Hasta M5 `size-limit` sumaba también los chunks lazy bajo el nombre "Initial"; ahora hay dos entradas y las dos tienen que quedar bajo 250 KB.
