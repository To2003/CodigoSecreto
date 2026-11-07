# Kickoff para Claude Code — proyecto "Clave"

Vas a construir el juego web descrito en `SPEC.md` (en la raíz del repo). Ese archivo es la **fuente de verdad**: leelo completo antes de hacer cualquier cosa. Si algo de este prompt contradice al SPEC, gana el SPEC y me avisás.

Contexto del entorno: Linux Mint, Node 24, sin presupuesto (nada que pida tarjeta de crédito). Deploy final: web en Vercel Hobby, server en Render free. Las cuentas y los deploys los hago yo; vos dejás todo listo y me decís qué clickear.

---

## 1. Antes de escribir código

1. **Inventario de herramientas**: listá qué skills, plugins, subagentes y MCP tenés disponibles en esta sesión. Comparalos con la tabla de la sección 3 y decime cuáles faltan. Si una skill no está, seguí sin ella; no inventes su contenido.
2. **CLAUDE.md**: creá un `CLAUDE.md` en la raíz con las reglas permanentes del proyecto (sacadas del SPEC):
   - Stack y estructura del monorepo (SPEC §0.3 y §11).
   - El motor de reglas es puro y vive en `packages/shared/engine`; el server es autoritativo.
   - **Regla de oro anti-trampa**: el mapa clave nunca llega a agentes ni espectadores (§2.1). Cualquier cambio en vistas o payloads requiere correr el test anti-filtración.
   - Todo el copy de UI va en `apps/web/src/i18n/es-AR.ts`, en castellano rioplatense con voseo ("che", "boludo" cuando cuadra), con el tono de §3.5.
   - Arte 100% original: nada de nombre, arte ni palabras de "Código Secreto"/"Codenames".
   - Assets de audio/arte solo CC0 o con licencia anotada en su `LICENSES.md`.
   - Comandos: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e`.
3. **Constraints**: usá la skill de constraints (`agent-skills:constraints`) para generar `CONSTRAINTS.md` con la vara de calidad del SPEC §10 y §13 (Lighthouse, bundle < 250 KB gzip, 60 fps, AA, cobertura ≥ 95% en engine). No me hagas la entrevista completa: la mayoría de las respuestas ya están en el SPEC. Preguntame solo lo que falte.
4. **Decisiones**: creá `docs/DECISIONS.md` (formato ADR corto, skill `agent-skills:documentation-and-adrs`). Cada decisión técnica que no esté en el SPEC va ahí con una línea de por qué.

## 2. Cómo trabajamos cada hito (M0 → M9)

Un hito por vez, en orden. Para cada hito:

1. **Plan**: entrá en plan mode y desglosá el hito en tareas chicas y verificables (`agent-skills:plan` / `writing-plans`). Mostrame el plan y **esperá mi OK** antes de implementar.
2. **Build incremental**: implementá tarea por tarea (`agent-skills:build` / `agent-skills:incremental-implementation`). Un commit por tarea, mensajes en formato Conventional Commits (`git-workflow-and-versioning`).
3. **Tests primero** donde aplique (`agent-skills:test-driven-development`), sobre todo en el motor y en los handlers del server.
4. **Si algo falla**: `systematic-debugging` antes de tocar código a ciegas.
5. **Cierre del hito**:
   - Corré lint, typecheck, tests y (desde M3) e2e. Todo en verde.
   - `verification-before-completion`: chequeá **uno por uno** los criterios de aceptación del hito en el SPEC §12 y decime cómo verificaste cada uno.
   - Review con un subagente que no haya escrito el código (`agent-skills:review` o `code-review`), enfocado en correctness y seguridad.
   - Resumen corto: qué quedó, qué decisiones tomaste, qué tengo que probar yo a mano. **Pará y esperá mi OK** para el siguiente hito.

Usá el subagente **Explore** para búsquedas amplias en el repo y el **Plan** para diseñar hitos grandes (M3, M4, M7). No lances subagentes para tareas triviales.

## 3. Skills y plugins por hito

| Hito | Skills / plugins a usar |
|---|---|
| M0 Base | `agent-skills:constraints`, `git-workflow-and-versioning`, `agent-skills:context-engineering` (para que el CLAUDE.md quede bien armado) |
| M1 Motor | `agent-skills:test-driven-development`, `agent-skills:code-simplification` al final |
| M2 Salas | `agent-skills:api-and-interface-design` (contrato de eventos Socket.IO + Zod), `agent-skills:security-and-hardening` |
| M3 Partida | `agent-skills:test-driven-development` (test anti-filtración primero), `agent-skills:browser-testing-with-devtools` + `chrome-devtools-mcp` para probar 4 pestañas |
| M4 Arte/layout | `frontend-design`, `impeccable`, `design-taste-frontend`, `web-design-guidelines`, `vercel-react-best-practices`, `agent-skills:frontend-ui-engineering`; `chrome-devtools-mcp:a11y-debugging` para contraste y foco; screenshots en 375 px y 1440 px |
| M5 Animaciones | `emil-design-eng`, `improve-animations`, y al cerrar `review-animations`; `agent-skills:performance-optimization` para los 60 fps |
| M6 Sonido | `systematic-debugging` si el audio no desbloquea en mobile |
| M7 Tutorial/social | `agent-skills:frontend-ui-engineering`, `impeccable` para pulir el tutorial |
| M8 Deploy | `agent-skills:ci-cd-and-automation` (GitHub Actions), `agent-skills:shipping-and-launch` / `agent-skills:ship`, `agent-skills:webperf`, `chrome-devtools-mcp:debug-optimize-lcp`, `agent-skills:observability-and-instrumentation` |
| M9 Extras | `brainstorming` + `agent-skills:spec` para escribir el spec del modo Cooperativo **antes** de codearlo |

Siempre que haya diseño visual, mirá el resultado con screenshots reales (DevTools MCP) en lugar de suponer cómo se ve.

## 4. Hooks recomendados

Con `hookify`, proponeme (no instales sin mostrarme) reglas para:
- Bloquear commits si fallan `pnpm typecheck` o los tests de `packages/shared`.
- Avisar si se edita `SPEC.md` (solo se cambia con mi OK).
- Avisar si aparece un `type` de carta no revelada en `apps/server/src/views/` sin pasar por `toPublicView`.

## 5. Límites

- No creés cuentas, no hagas deploy, no instales nada global con `sudo` sin preguntarme.
- No agregues dependencias pagas ni servicios que pidan tarjeta.
- No cambies el alcance de un hito: si ves algo para mejorar, anotalo en `docs/BACKLOG.md` y seguí.
- Si una regla del juego del SPEC te parece ambigua, preguntame; no la interpretes por tu cuenta.

---

**Arrancá ahora con la sección 1 y después mostrame el plan de M0.**
