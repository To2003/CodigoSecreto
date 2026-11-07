# Decisiones (ADR corto)

Decisiones técnicas que no están en `SPEC.md`, o que lo corrigen. Una entrada por decisión, numeradas, nunca se borran: si cambia, se agrega una nueva que la reemplaza.
Formato: **Contexto → Decisión → Por qué → Alternativas descartadas**.

---

## ADR-001 — Node 24 LTS en lugar de Node 20

- **Estado**: Aceptada (2026-11-07, OK de @To2003)
- **Contexto**: SPEC §0.3 pide Node 20. Node 20 llegó a fin de vida en abril 2026; el entorno local es Node 24.
- **Decisión**: Node 24 LTS para server y CI. `.nvmrc` = `24`, `engines.node` = `>=22`.
- **Por qué**: un server público sin parches de seguridad es un riesgo; Node 24 es la LTS activa y Render la soporta.
- **Descartadas**: Node 20 (EOL); Node 22 (en mantenimiento, sin ventaja sobre 24).

## ADR-002 — Floor guard propio, adaptado de la referencia de agent-skills

- **Estado**: Aceptada (2026-11-07)
- **Contexto**: `CONSTRAINTS.md` define un "piso" (sin supresiones, stubs, tests salteados, umbrales relajados) que no tiene una herramienta estándar.
- **Decisión**: `scripts/floor-guard.mjs`, copia de la implementación de referencia de la skill `constraint-driven-development`, con dos cambios: (1) si no existe `main`/`origin/main`, compara contra el árbol vacío; (2) `.constraintsignore` exime archivos de los chequeos de patrones (los `.md` que nombran los patrones y el propio guard).
- **Por qué**: usar la referencia en vez de inventar un checker mantiene el contrato (exit 0/1/2) conocido; sin el fallback el guard no corre en un repo sin `main`.
- **Descartadas**: escribir uno desde cero; no tener guard.

## ADR-003 — Escaneo de seguridad solo en CI

- **Estado**: Aceptada (2026-11-07, OK de @To2003)
- **Contexto**: gitleaks, osv-scanner y Semgrep son binarios que no vienen por npm.
- **Decisión**: corren solo en GitHub Actions desde M8; bloquean el merge con hallazgos high o mayores. `gitleaks` siempre con `--redact`.
- **Por qué**: no instalar nada global en la máquina local (KICKOFF §5) y mantener una opinión externa sobre seguridad.
- **Descartadas**: correrlos también local (requiere instalación global); no escanear (ninguna opinión externa).

## ADR-004 — Cobertura: motor ≥ 95%, server ≥ 80% líneas cambiadas, web medida

- **Estado**: Aceptada (2026-11-07, OK de @To2003)
- **Contexto**: SPEC §1.8 solo fija ≥ 95% para el motor.
- **Decisión**: server ≥ 80% de las líneas cambiadas (lcov + `git diff`); web sin umbral, se mide y no puede bajar (ratchet). La UI se cubre principalmente con E2E.
- **Por qué**: los handlers del server son la frontera anti-trampa; en la UI, los tests de componentes rinden menos que los E2E con 4 navegadores.
- **Descartadas**: solo el motor; 80% en todo.

## ADR-005 — Qué bloquea y qué avisa

- **Estado**: Aceptada (2026-11-07, OK de @To2003)
- **Decisión**: el pre-commit bloquea si fallan typecheck, lint, tests de `packages/shared` o el floor guard. Lighthouse avisa hasta M8; el resto se activa en el hito indicado en `CONSTRAINTS.md`.
- **Por qué**: lo que corre en segundos va en el loop; lo lento va a CI para que nadie termine usando `--no-verify`.

## ADR-006 — `SPEC.md` en la raíz y `KICKOFF.md` en `docs/`

- **Estado**: Aceptada (2026-11-07)
- **Contexto**: el KICKOFF dice que `SPEC.md` está en la raíz, pero el repo estaba vacío; ambos llegaron como adjuntos.
- **Decisión**: `SPEC.md` copiado tal cual a la raíz; `KICKOFF.md` a `docs/KICKOFF.md` como referencia del proceso.

## ADR-007 — TypeScript 6.0.x fijado (no 7.x)

- **Estado**: Aceptada (2026-11-07, plan M0)
- **Contexto**: la última es TS 7 (compilador nativo). `typescript-eslint@8.72` declara peer `typescript >=4.8.4 <6.1.0`.
- **Decisión**: `typescript ~6.0.3` en la raíz. Se revisa cuando `typescript-eslint` soporte 7.
- **Por qué**: sin lint con información de tipos perdemos las reglas `strictTypeChecked`.

## ADR-008 — ESLint 9 (no 10)

- **Estado**: Reemplazada por ADR-010 (2026-11-07)
- **Contexto**: `eslint-plugin-react@7.37` (para `react/jsx-no-literals`, la regla que obliga a pasar el copy por `es-AR.ts`) declara peer `eslint ^9.7`.
- **Decisión**: ESLint 9 con flat config.

## ADR-009 — `@clave/shared` se consume como fuente TypeScript

- **Estado**: Aceptada (2026-11-07, plan M0)
- **Decisión**: `packages/shared` exporta `src/*.ts` directo vía `exports` en su `package.json`, sin paso de build. Vite (web), `tsx` (server en dev) y `tsup` (build del server) lo compilan. Todos los paquetes usan `moduleResolution: "Bundler"` y `tsc` solo para typecheck (`noEmit`).
- **Por qué**: cero builds intermedios ni `dist/` desactualizados en dev; los cambios del motor se ven al instante en web y server.
- **Descartadas**: project references con `tsc -b` (más configuración y un `dist/` que se desincroniza).

## ADR-010 — ESLint 10 con `@eslint-react` e `i18next/no-literal-string`

- **Estado**: Aceptada (2026-11-07, reemplaza ADR-008)
- **Contexto**: al instalar, ESLint 9 figura como deprecado (sin soporte) y `eslint-plugin-react` no se actualiza desde abril 2025.
- **Decisión**: ESLint 10 + `typescript-eslint` (strict + stylistic, con tipos) + `@eslint-react/eslint-plugin` (reglas de React) + `eslint-plugin-react-hooks` + `eslint-plugin-i18next` con `no-literal-string` en modo `jsx-text-only` sobre `apps/web/src/**/*.tsx` + `eslint-config-prettier`.
- **Por qué**: todos declaran soporte para ESLint 10; `no-literal-string` cumple la misma función que `react/jsx-no-literals` (obligar a que el copy salga de `es-AR.ts`) sin atarnos a un plugin abandonado. No usamos la librería i18next, solo la regla.
- **Descartadas**: ESLint 9 (EOL); `eslint-plugin-react` con ESLint 10 fuera de su rango de peers.
- **Actualización (review M0)**: modo `jsx-only` (también `{'…'}`) y validación de los atributos que se leen o se escuchan (`placeholder`, `title`, `alt`, `label`, `aria-label` y afines); el resto de los atributos no es copy.

## ADR-011 — Server: `tsx` en dev, `tsup` para el build

- **Estado**: Aceptada (2026-11-07, plan M0)
- **Decisión**: `pnpm dev` corre `tsx watch src/index.ts`; `pnpm build` genera `dist/index.js` (ESM) con `tsup`, bundleando `@clave/shared` (que es fuente TS, ADR-009) y dejando externas las dependencias npm.
- **Por qué**: Render ejecuta JS plano con `node dist/index.js`, sin compilar TS en el arranque (que con el server dormido ya tarda 30–60 s).

## ADR-012 — Socket.IO rechaza orígenes no permitidos con `allowRequest`

- **Estado**: Aceptada (2026-11-07, M0)
- **Contexto**: la opción `cors` de Socket.IO solo agrega headers para el polling HTTP; un handshake WebSocket desde otro sitio pasa igual (cross-site WebSocket hijacking).
- **Decisión**: `allowRequest` compara el header `Origin` con `CLIENT_ORIGIN` (lista separada por comas) y rechaza el resto. Express usa `cors` con la misma lista.
- **Por qué**: SPEC §2.5 pide CORS restringido; esto lo cumple también para WebSocket. No reemplaza al rate limit ni a la validación Zod.

## ADR-013 — Pre-commit con `simple-git-hooks`

- **Estado**: Aceptada (2026-11-07, plan M0)
- **Decisión**: `simple-git-hooks` instala el hook en `prepare` (corre solo con `pnpm install`). Pre-commit: `pnpm check:fast && pnpm --filter @clave/shared test`.
- **Por qué**: una dependencia sin archivos extra (la config vive en `package.json`); husky agrega una carpeta `.husky/` sin ganancia para un solo hook.
- **Nota**: el hook se puede saltear con `--no-verify` o `SKIP_SIMPLE_GIT_HOOKS=1`; la regla de hookify bloquea ambos para el agente, y en M8 CI vuelve a correr todo.

## ADR-014 — Las reglas de hookify se commitean

- **Estado**: Aceptada (2026-11-07, plan M0)
- **Contexto**: hookify sugiere ignorar `.claude/*.local.md` en git, pero las reglas del KICKOFF §4 son del proyecto, no de una máquina.
- **Decisión**: `.claude/hookify.*.local.md` va al repo: bloquear saltear el pre-commit, avisar al editar `SPEC.md` y avisar si se emite estado de cartas fuera de `toPublicView`.
- **Por qué**: así las reglas viajan con el repo y aplican en cualquier sesión de Claude Code (cloud o VS Code). `.claude/settings.local.json` sigue ignorado.

## ADR-015 — Floor guard en `commit-msg` con trailer `Floor-Test-Change`

- **Estado**: Aceptada (2026-11-07, cierre de M0)
- **Contexto**: el piso permite quitar o saltear tests "con motivo en el mensaje del commit", pero un pre-commit no puede leer el mensaje. La review de M0 pidió reemplazar un test que nunca podía fallar, y el guard lo bloqueó sin salida legítima.
- **Decisión**: el guard corre en el hook `commit-msg` (`--staged --commit-msg "$1"`). Los hallazgos de tests (`test-deleted`, `assertion-removed`, `test-made-easier`) pasan a aviso solo si el mensaje trae `Floor-Test-Change: <motivo>` (10+ caracteres). Todo lo demás sigue bloqueando.
- **Por qué**: implementa la regla como está escrita y deja el motivo en `git log`, a la vista en review. Sin esto, la única salida era `--no-verify` (bloqueado por hookify) o reescribir el test para engañar al guard.
- **Descartadas**: una excepción en CONSTRAINTS por cada cambio de test (demasiado ruido); no tener escape.

## ADR-016 — `packages/shared` sigue la estructura literal del SPEC (sin `src/`)

- **Estado**: Aceptada (2026-11-07, cierre de M0)
- **Contexto**: SPEC §11 define `packages/shared/{engine,schemas,types,words}` y CONSTRAINTS fija la cobertura del 95% sobre `packages/shared/engine`, pero el paquete había arrancado con `src/`. La review de M0 marcó que tsconfig y cobertura no iban a ver el motor.
- **Decisión**: el paquete no tiene `src/`: `index.ts` en la raíz del paquete (lo que exporta `exports`), y las carpetas del SPEC al lado. `tsconfig` incluye `**/*.ts`; la cobertura mide `packages/*/**/*.ts`. Precisa ADR-009: shared exporta `./index.ts`.
- **Por qué**: las rutas del SPEC, de CLAUDE.md y de CONSTRAINTS quedan iguales a las reales.
