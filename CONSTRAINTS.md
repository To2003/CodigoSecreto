# Constraints — Clave

Última revisión: 2026-11-07 por @To2003

La vara de calidad del proyecto, sacada de SPEC §10 y §13 más las respuestas de la entrevista de arranque.
Cada número tiene su porqué. **Este archivo es la fuente canónica**: los scripts `check:*` de `package.json` lo reflejan; si difieren, gana este archivo.
Ajustarlo hacia abajo requiere OK explícito de @To2003 en un commit aparte del cambio que no pasaba.

## Piso (siempre, desde el primer commit)

Lo verifica `node scripts/floor-guard.mjs` sobre el diff (bloquea el commit, M0 en adelante):

- Sin comentarios de supresión nuevos: `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `istanbul ignore`, `nosemgrep`, `gitleaks:allow`.
- Sin stubs sin implementar: `throw new Error("Not implemented")`, `catch {}` vacío, `TODO` en lugar de código.
- Sin tests salteados (`.skip`, `.todo`, `xit`) ni tests borrados ni assertions quitadas sin motivo en el mensaje del commit.
- Sin secretos en el código (`.env` nunca se commitea; existe `.env.example`).
- Este archivo no se debilita para que un cambio pase.

## Con número, bloqueantes

| Dimensión                         | Regla                                                                                                          | Por qué este número                                                                          | Verifica                                                                                                                            | Corre en                     | Desde                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------- |
| Tipos                             | Cero errores, `strict: true`                                                                                   | Monorepo con tipos compartidos: un error en `shared` rompe web y server                      | `pnpm typecheck` (`tsc --noEmit` por paquete)                                                                                       | cada edición, pre-commit, CI | M0                      |
| Lint                              | Cero errores con nuestra config                                                                                | Errores de lint baratos de arreglar en el momento                                            | `pnpm lint` (ESLint flat config + Prettier)                                                                                         | cada edición, pre-commit, CI | M0                      |
| Copy centralizado                 | Sin strings literales en JSX                                                                                   | SPEC §3.5: todo el copy en `es-AR.ts`                                                        | regla ESLint `i18next/no-literal-string` (modo `jsx-text-only`) en `apps/web`                                                       | cada edición, CI             | M0                      |
| Tests de shared                   | Todos en verde                                                                                                 | El motor es la verdad del juego; romperlo rompe todo                                         | `pnpm --filter @clave/shared test`                                                                                                  | pre-commit, CI               | M0                      |
| Cobertura del motor               | ≥ 95% de líneas, ramas, funciones y sentencias en `packages/shared/engine`                                     | SPEC §1.8 y §12-M1: funciones puras, sin excusa para no cubrirlas                            | `vitest run --coverage` con `thresholds` en `packages/shared/vitest.config.ts`                                                      | task end, CI                 | M1                      |
| Calidad de mazos                  | 1 palabra, 3–11 letras, sin repetidas entre mazos, Clásico ≥ 400, Argento ≥ 200                                | SPEC §7: que entren en la carta y no se repitan                                              | test `packages/shared/words/words.test.ts`                                                                                          | pre-commit, CI               | M1                      |
| Anti-filtración                   | Ningún payload a agente/espectador contiene `type` de carta no revelada en una partida completa                | SPEC §2.1, regla de oro: imposible ver el mapa con DevTools                                  | test `apps/server/src/views/anti-leak.test.ts`                                                                                      | task end, CI                 | M3                      |
| Cobertura del server              | ≥ 80% de las líneas cambiadas en `apps/server`                                                                 | Los handlers son la frontera de seguridad; 80% fuerza un test sin trabar una línea de config | `vitest run --coverage` (lcov) + `node scripts/diff-coverage.mjs apps/server 80`                                                    | task end, CI                 | M2                      |
| E2E                               | Partida completa con 4 navegadores + reconexión del jefe con F5, en verde                                      | SPEC §10.1 y §12-M3                                                                          | `pnpm e2e` (Playwright, `--trace off`)                                                                                              | review, CI                   | M3                      |
| Accesibilidad (externa)           | Cero violaciones `critical`/`serious` de axe (WCAG 2.1 A/AA, incluye contraste AA) en landing, lobby y partida | SPEC §5.2 y §10: contraste AA, navegable con teclado                                         | `@axe-core/playwright` dentro de `pnpm e2e` contra `vite preview`                                                                   | review, CI                   | M4                      |
| Bundle inicial                    | ≤ 250 KB gzip (JS + CSS de la ruta inicial)                                                                    | SPEC §10: tutorial, reglas y audio van en lazy load                                          | `size-limit` (`pnpm size`) sobre `apps/web/dist`                                                                                    | review, CI                   | M4                      |
| Lighthouse landing                | Performance ≥ 90, Accesibilidad ≥ 95                                                                           | SPEC §10                                                                                     | `lighthouse $URL --only-categories=performance,accessibility --output=json` contra `vite preview` (local/CI) y el preview de Vercel | review, CI                   | M4 (warn), M8 (bloquea) |
| Seguridad: secretos (externa)     | Cero hallazgos                                                                                                 | Un secreto filtrado no se des-filtra                                                         | `gitleaks detect --redact --no-banner` (`--redact` obligatorio)                                                                     | CI                           | M8                      |
| Seguridad: dependencias (externa) | Nada en severidad high o mayor                                                                                 | Por debajo de high es mayormente ruido                                                       | `osv-scanner scan source -r .`                                                                                                      | CI                           | M8                      |
| Seguridad: código (externa)       | Cero hallazgos high                                                                                            | Server público que recibe input de cualquiera                                                | `semgrep scan --config p/default --config p/owasp-top-ten --config p/typescript`                                                    | CI                           | M8                      |

Escaneo de seguridad: **solo en CI** (GitHub Actions), sin instalar nada global en la máquina local.

## Medidos, todavía no bloqueantes (ratchet: no pueden empeorar)

| Métrica                          | Hoy            | Dirección                                          | Se mide desde |
| -------------------------------- | -------------- | -------------------------------------------------- | ------------- |
| Cobertura de `apps/web` (Vitest) | sin código aún | no puede bajar (tolerancia 0.5%)                   | M4            |
| Cobertura total de `apps/server` | sin código aún | no puede bajar (tolerancia 0.5%)                   | M2            |
| Tamaño del bundle inicial        | sin código aún | no puede crecer más de 5 KB por PR sin explicación | M4            |

Cuando se mida por primera vez, se anota el valor acá en un commit `chore(constraints): ratchet …`.

## Verificación manual por hito (sin herramienta automática)

Estos criterios del SPEC no tienen un checker que corra en CI. Se verifican a mano en el cierre del hito y se reporta cómo:

| Criterio                                    | Cómo se verifica                                                                                                      | Hito               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 60 fps en revelaciones (gama media)         | Trace de Performance en Chrome DevTools con throttling de CPU 4×; sin long frames > 16.7 ms durante el flip           | M5                 |
| Reduced motion sin flips ni shake           | Emulación `prefers-reduced-motion: reduce` + toggle de ajustes; screenshot/trace                                      | M5                 |
| Ninguna palabra se corta (375 px y 1440 px) | Test Playwright que recorre todas las palabras de todos los mazos y verifica `scrollWidth <= clientWidth` en la carta | M4 (se automatiza) |
| Audio desbloquea en iOS Safari              | Prueba manual de @To2003 en iPhone                                                                                    | M6                 |
| Cambio de equipo visible en < 200 ms local  | Medición en E2E con 4 contextos                                                                                       | M2                 |

## Dónde corre cada cosa

| Etapa                | Comando                 | Qué corre                                                                             | Presupuesto |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------- | ----------- |
| Edición              | `pnpm check:fast`       | typecheck + lint + floor-guard                                                        | < 10 s      |
| Pre-commit (bloquea) | hook `simple-git-hooks` | `check:fast` + tests de `packages/shared`                                             | < 30 s      |
| Fin de tarea         | `pnpm check:task`       | `check:fast` + tests con cobertura + diff-coverage                                    | < 90 s      |
| CI / cierre de hito  | `pnpm check:full`       | `check:task` + e2e + axe + size-limit + Lighthouse + gitleaks + osv-scanner + semgrep | sin límite  |

Las filas con "Desde" futuro se activan en ese hito (instalar la herramienta y agregarla al script es parte del hito). Antes de eso no cuentan como verificadas.

## Excepciones

| ID  | Regla | Ruta | Motivo | Dueño | Vence |
| --- | ----- | ---- | ------ | ----- | ----- |
| —   | —     | —    | —      | —     | —     |

Toda excepción nueva tiene dueño y vence en ≤ 90 días.
