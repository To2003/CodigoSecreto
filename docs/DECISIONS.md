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
- **Estado**: Aceptada (2026-11-07, plan M0)
- **Contexto**: `eslint-plugin-react@7.37` (para `react/jsx-no-literals`, la regla que obliga a pasar el copy por `es-AR.ts`) declara peer `eslint ^9.7`.
- **Decisión**: ESLint 9 con flat config.

## ADR-009 — `@clave/shared` se consume como fuente TypeScript
- **Estado**: Aceptada (2026-11-07, plan M0)
- **Decisión**: `packages/shared` exporta `src/*.ts` directo vía `exports` en su `package.json`, sin paso de build. Vite (web), `tsx` (server en dev) y `tsup` (build del server) lo compilan. Todos los paquetes usan `moduleResolution: "Bundler"` y `tsc` solo para typecheck (`noEmit`).
- **Por qué**: cero builds intermedios ni `dist/` desactualizados en dev; los cambios del motor se ven al instante en web y server.
- **Descartadas**: project references con `tsc -b` (más configuración y un `dist/` que se desincroniza).
