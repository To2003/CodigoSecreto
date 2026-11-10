# Valores medidos (ratchet)

Los valores de la tabla "Medidos, todavía no bloqueantes" de `CONSTRAINTS.md`. Viven acá porque el floor guard marca cualquier cambio de número sin dirección dentro de `CONSTRAINTS.md` (también registrar una medición, que endurece la vara). Ver BACKLOG #7. La regla es la misma: estos números no pueden empeorar.

| Métrica                                    | Valor  | Fecha      | Hito | Cómo se mide                                                 |
| ------------------------------------------ | ------ | ---------- | ---- | ------------------------------------------------------------ |
| Cobertura de líneas de `apps/web` (Vitest) | 10.5 % | 2026-11-10 | M4   | `pnpm coverage` (la UI se cubre sobre todo con E2E, ADR-004) |
| Cobertura de líneas de `apps/server`       | 91.7 % | 2026-11-10 | M4   | `pnpm coverage`                                              |
| Bundle inicial (JS + CSS, gzip)            | 134 KB | 2026-11-10 | M4   | `pnpm build` + `pnpm size`                                   |
