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

## ADR-017 — Modo autónomo desde M1

- **Estado**: Aceptada (2026-11-10, instrucción de @To2003)
- **Decisión**: el agente encadena hitos sin esperar OK. Cada plan se guarda en `docs/plans/M{n}.md` y se ejecuta enseguida. Las ambigüedades del SPEC se resuelven con la opción más conservadora y alineada al SPEC, anotada acá. Lo que no se puede verificar en el contenedor va a `docs/MANUAL-CHECKS.md`; los bloqueos a `docs/BLOCKERS.md`; el estado a `docs/PROGRESS.md` en cada cierre. Review con `code-reviewer` antes de cerrar M3, M4, M5, M7 y M8.
- **Cooperativo**: va en M9 (SPEC §12 manda sobre las menciones a M8 en §1.2 y §1.7).
- **Assets**: sin descargas; sonido generado con Web Audio (M6) y arte SVG en código.
- **Deploy (M8)**: se deja todo listo y documentado en `docs/DEPLOY.md`, sin crear cuentas ni deployar.

## ADR-018 — Reglas ambiguas del SPEC resueltas para el motor (M1)

- **Estado**: Aceptada (2026-11-10, modo autónomo; criterio: la opción más conservadora y literal del SPEC)

1. **Objeción aceptada** (§1.6): se revela un agente no revelado del equipo que objetó (el rival del que dio la pista), elegido con el RNG de la partida. Si con eso completa sus agentes, gana. El turno pasa al equipo que objetó.
2. **Quién vota la objeción**: los jugadores de los equipos Rojo y Azul, conectados al abrirse la votación, menos el jefe que dio la pista. Los espectadores no votan (§1.2: "no actúa"). El voto del jefe que objeta cuenta como "acepto".
3. **Mayoría de la objeción**: se acepta solo si los votos "acepto" superan la mitad de los votantes habilitados. Empate o no votar = se rechaza (gana el statu quo). Se resuelve apenas el resultado no puede cambiar (ya hay mayoría de "acepto", o los votos que faltan no alcanzan para llegar), o cuando vence el timer de 15 s (`TIMER_EXPIRED`).
4. **Cuándo se puede objetar**: solo el jefe rival, en fase de adivinanza, antes de la primera revelación de ese turno, y una sola vez por pista. Si se rechaza, la adivinanza sigue igual.
5. **Plural básico** (§1.6): una palabra se compara también sin `s` o `es` final, solo si lo que queda tiene 3+ letras (así "MES" no se reduce a "ME"). La regla de "contener / estar contenida" usa esas mismas formas.
6. **Palabras compuestas**: con la opción activa se permite un guion entre dos grupos de letras; se valida la palabra entera y cada parte.
7. **Número de la pista**: 0–9 o `"inf"` (∞). Intentos: número + 1; con 0 o ∞, ilimitados. Hay que revelar al menos una carta antes de "Pasar turno".
8. **Timer vencido**: en fase pista, el turno pasa al otro equipo sin pista; en adivinanza, termina el turno aunque no haya intentos.
9. **Modo "Mayoría de su equipo"** (§1.7): la carta se revela cuando la señalan más de la mitad de los agentes **conectados** del equipo activo. En ese modo `REVEAL_CARD` directo no está permitido.
10. **Señalar**: cada agente señala una carta a la vez (señalar otra mueve la marca; `null` la saca). Las marcas se borran al cambiar de turno.
11. **Revancha** (§9): `REMATCH` arranca una partida nueva al toque con los mismos equipos, rotando jefes (el siguiente jugador del equipo en orden de llegada pasa a jefe), salvo `keepSpymasters`. Las palabras de la partida anterior se evitan. "Volver al lobby" es del server (descarta la partida). Lectura de la flecha `GAME_OVER → LOBBY (revancha)` del diagrama §1.8: la revancha pasa por el armado de lobby de forma instantánea.
12. **Mezcla con palabras custom** (§7): si hay mazos y palabras custom, `customShare` (0–100, default 50) es el porcentaje de las 25 que sale de las custom (hasta donde alcancen). Sin mazos, hacen falta ≥ 25 custom.
13. **Mínimo para arrancar** (§1.2): modo clásico, cada equipo con exactamente 1 jefe y al menos 1 agente (→ 4 jugadores mínimo). Cooperativo devuelve error hasta M9.
14. **Errores del motor**: código tipado (`WRONG_PHASE`, `NOT_YOUR_TURN`, …) sin texto. El texto en castellano rioplatense lo ponen el server y la web según el código.

## ADR-019 — `room:patch` lleva la vista filtrada completa

- **Estado**: Aceptada (2026-11-10, M2)
- **Contexto**: SPEC §2.2 pide `room:patch` con "diff + lista de eventos" y `seq` incremental.
- **Decisión**: el patch manda `{ seq, view, events }`: la vista completa ya filtrada para ese jugador (unos pocos KB) en lugar de un diff JSON. Los eventos siguen siendo la lista para animar, y el `seq` detecta saltos (el cliente pide el estado de nuevo con `room:join` + token).
- **Por qué**: un diff agrega una clase entera de bugs (orden, parches perdidos, merge en el cliente) para ahorrar bytes que no importan con ≤ 16 jugadores. Y cada vista pasa por el mismo filtro que `room:state`, lo que simplifica la garantía anti-trampa de M3.

## ADR-020 — Detalles de salas resueltos en M2

- **Estado**: Aceptada (2026-11-10, M2, modo autónomo)
- **Equipo al entrar**: en el lobby, el que entra va como agente al equipo con menos jugadores; si hay partida en curso, entra como espectador.
- **Token inválido**: si el `playerId` existe pero el token no coincide, se le da un lugar nuevo (no se rechaza): es el caso típico de un token viejo.
- **Echar ≠ banear**: el SPEC no pide ban; un jugador echado puede volver a entrar con el código como jugador nuevo.
- **Sala vacía**: se borra 30 min después de que no quede nadie conectado, contando desde la creación si nunca entró nadie. El lugar de un desconectado se libera a los 60 s solo en el lobby (durante la partida se decide en M3).
- **Sortear**: equipos balanceados al azar y un jefe al azar en cada uno; los espectadores no se tocan.
- **E2E desde M2**: Playwright se instala en M2 (CONSTRAINTS lo ponía en M3) porque es la única forma de verificar los criterios de M2 con 4 pestañas.

## ADR-021 — Partida en el server y vistas (M3)

- **Estado**: Aceptada (2026-11-10, M3, modo autónomo)
- **Única salida**: el estado de partida sale del server solo por `toPublicView` (`apps/server/src/views/gameView.ts`). `type` va si la carta está revelada, si terminó la partida (§3.1: mapa completo al final), si quien mira es jefe, o si es espectador y la sala habilitó "espectadores ven el mapa". Quien entra a mitad de partida mira como espectador.
- **Marcas de señalar**: las ven solo los integrantes del equipo activo (y sus eventos `CARD_POINTED` se filtran igual). Es charla interna del equipo; el SPEC no dice que el rival las vea.
- **Pausa** (§2.4): la partida está en pausa mientras el jefe del equipo activo no esté conectado (en cualquier fase de su turno). Durante la pausa se rechazan las acciones de juego (`GAME_PAUSED`). El host reasigna con un compañero conectado del mismo equipo (`SET_SPYMASTER`).
- **Lugares en partida**: durante la partida no se liberan lugares por desconexión (el motor necesita a los jugadores). Si el **host** lleva 60 s desconectado, el rol de host pasa al jugador conectado más antiguo, para que siempre haya alguien que pueda reasignar un jefe y la partida no quede trabada.
- **Volver al lobby**: el host puede volver al lobby en cualquier momento de la partida (no solo al final), para destrabar partidas que perdieron jugadores. Las palabras de esa partida se evitan en la próxima.
- **Timers y objeciones**: el motor ya los soporta, pero su UI y los timers del server van en M7, como lista el SPEC §12.

## ADR-022 — RNG criptográfico en el server y endurecimientos de la review de M3

- **Estado**: Aceptada (2026-11-10, review de M3, modo autónomo). **Desvía del SPEC §1.8**: avisar a Tomás.
- **Contexto**: SPEC §1.8 pide "RNG con seed (ej. `mulberry32`) → partidas reproducibles". La review de M3 mostró (con prueba de concepto, reproducida) que con mulberry32 sembrado con 31 bits, los IDs de carta públicos alcanzan para probar todas las seeds y reconstruir el mapa clave en ~5 s desde la consola del navegador. Eso rompe la regla de oro (§2.1).
- **Decisión**:
  1. El server usa un RNG criptográfico (`crypto.randomInt`, `apps/server/src/rooms/rng.ts`) para todo lo que le pasa al motor. El motor sigue puro y sigue recibiendo el RNG por parámetro: los tests, el fuzz y `simulate` usan mulberry32 con seed y siguen siendo reproducibles. Un test falla si aparece mulberry32 en código del server que no sea test.
  2. Reasignar jefe solo durante una pausa por ausencia del jefe activo, para ese equipo, con un agente conectado, y solo si el equipo conserva al menos un agente conectado (si no, el host puede terminar la partida).
  3. El jefe reemplazado queda **en la banca como espectador** hasta el final de esa partida: ya vio el mapa, no puede volver a adivinar.
  4. "Espectadores ven el mapa" aplica solo a espectadores que estaban al empezar (o a jefes en la banca). Quien entra a mitad de partida nunca lo ve; si no, cualquier agente podría abrir otra ventana como espectador.
  5. También hay pausa si el equipo activo está adivinando sin ningún agente conectado. El host puede terminar la partida desde el header o desde el overlay de pausa.
  6. La revancha se arma con quienes están en la sala (los que se fueron quedan afuera, los que entraron a mitad juegan como espectadores) y exige jefe y agente conectados por equipo. Para empezar también se exige que el jefe esté conectado y que haya al menos un agente conectado.
  7. Echar a alguien en partida le avisa al motor (presencia), para que el modo mayoría y las votaciones no lo esperen.
- **Si se quiere replay**: guardar en el server una seed de 256 bits para un DRBG, que nunca salga del server. Queda en el backlog.

## ADR-023 — Arte, layout y accesibilidad (M4)

- **Estado**: Aceptada (2026-11-10, M4, modo autónomo)
- **Fuentes empaquetadas**: Oswald, Special Elite e Inter salen del bundle vía Fontsource (OFL / Apache-2.0), no de Google Fonts en runtime: sin terceros, sin layout shift por red lenta y funciona offline. Licencias en `apps/web/src/art/LICENSES.md`.
- **Arte en código**: avatares, dorsos y sellos son SVG en componentes; la textura de papel es ruido SVG inline en CSS. Cero imágenes.
- **Contraste AA vs. paleta del SPEC**: el rojo `#D6453D` y el azul `#2F6FB3` del SPEC no llegan a 4,5:1 como texto sobre el fondo oscuro ni con texto papel encima. Se agregan variantes `-ink` (texto de color sobre fondo oscuro) y `-deep` (fondos de color con texto papel), calculadas para ≥ 4,5:1 también en la paleta daltónica. Los tokens del SPEC quedan para bandas, ilustraciones y bordes (SPEC §5.2 pide "Contraste AA en todos los textos").
- **Modo daltónico**: paleta Okabe–Ito (naranja `#C75A00` / azul `#0072B2`), íconos ▲ ● ■ ✕ en la vista de jefe y en los contadores, y tramas (rayas para rojo, puntos para azul) en bandas, solapas y dorsos.
- **Mobile**: la zona de acción es una hoja fija abajo; equipos e historial en un panel con pestañas; el primer toque señala y el segundo sobre la misma carta la da vuelta (también queda el ✓).
- **Lighthouse**: queda para M8 (se mide contra el build en preview); M4 cubre accesibilidad con axe en los E2E.
- **Íconos en la vista de jefe siempre** (review de M4): SPEC §3.2 dice "color de fondo tenue + ícono del tipo" para el jefe y §5.6 dice que en modo daltónico los íconos aparecen "también" ahí. Se elige lo más accesible: el jefe siempre ve el ícono, con o sin modo daltónico (los tintes solos contrastan poco y un error del jefe cuesta caro).
- **Doble tap en mobile** (review de M4): el primer toque señala y "arma" la carta por 3 s (estado local, no espera al server), el nombre accesible pasa a "Dar vuelta X" y aparece "Tocá de nuevo"; pasado ese tiempo, otro toque quita la marca en vez de revelar. `touch-action: manipulation` evita el zoom por doble toque en iOS.

## ADR-024 — Animaciones en CSS, Motion solo para layout (M5)

- **Estado**: Aceptada (2026-11-10, M5, modo autónomo)
- **Decisión**: las animaciones predeterminadas (cascada, flip 3D, sacudidas, destellos, barrido de turno, máquina de escribir, contadores) son keyframes CSS sobre `transform` y `opacity`, que corren fuera del hilo principal. Motion (SPEC §0.3) se usa donde aporta: las filas del lobby que viajan de columna (layout animations). `canvas-confetti` se carga solo al ganar.
- **Movimiento reducido**: el sistema (`prefers-reduced-motion`) o el toggle de Ajustes ponen `data-motion="reduce"`; toda animación de movimiento lleva `.anim-move` y pasa a un fundido de 150 ms; el flip directamente no se renderiza. Motion recibe `reducedMotion="always"`.
- **Rendimiento**: las cartas se memorizan con props derivadas, así un patch solo re-renderiza lo que cambió. Medido con CPU ×4 sobre el build de producción (ADR-026): mediana 16,7 ms, p95 16,8 ms y el peor frame (el del patch) 33 ms.
- **Review de M5**: el flip arranca en el mismo render que trae la carta revelada (patrón "prop anterior", sin esperar un efecto); los efectos de cada revelación y de pantalla viven en estado local con timers, así el patch siguiente no los corta; el sacudón del traidor va sobre el tablero y no sobre `<main>` (sacudir un ancestro de los overlays `fixed` los vuelve relativos a él); la viñeta entra y sale sola en ~2,9 s; con movimiento reducido no hay barrido, sacudón ni carta grande. Lo que ya terminó lleva `data-anim-done` (un listener global de `animationend`) y no se vuelve a reproducir al prender o apagar el movimiento reducido. Motion se usa con `LazyMotion` + `m` y sus features se cargan aparte.
- **Descartadas**: todo en Motion (sus `x`/`y` corren en el hilo principal y caen frames bajo carga); WAAPI a mano (más código para lo mismo que CSS).

## ADR-025 — Sonido sintetizado con Web Audio, sin Howler por ahora (M6)

- **Estado**: Aceptada (2026-11-10, M6, instrucción de Tomás: sin descargar assets)
- **Decisión**: cada efecto del SPEC §6.2 y las dos músicas se generan con Web Audio (`apps/web/src/audio/engine.ts`). La API (`unlock`, `play`, `setMusic`, `setIntensity`, `setVolumes`) es la que va a usar la versión con archivos reales; `docs/AUDIO-ASSETS.md` lista qué buscar y cómo armar el sprite con Howler (SPEC §6.4).
- **Por qué**: cero descargas y cero peso; Howler no aporta nada sin archivos.
- **Detalles**: el contexto se crea y se reanuda en el primer gesto (iOS/Chrome); canales master/música/efectos persistidos; música apagada por defecto en mobile; el traidor silencia la música 3 s; "te toca" con la pestaña oculta hace parpadear el título y vibrar el celu.

## ADR-026 — Los E2E corren contra el build de producción

- **Estado**: Aceptada (2026-11-10, M5, modo autónomo)
- **Decisión**: Playwright levanta la web con `vite build && vite preview` (con `VITE_SERVER_URL` apuntando al server de dev), no con `vite dev`.
- **Por qué**: el criterio de M5 (60 fps en revelaciones) y el presupuesto de bundle hablan de lo que se publica. En dev, React renderiza dos veces (StrictMode) y suma chequeos: el frame del patch medía 100–117 ms bajo CPU ×4 contra 33 ms en producción. Además los E2E prueban el mismo bundle que va a Vercel.
- **Costo**: ~10 s más por corrida para el build. Localmente, si ya hay un server en el puerto 5173, Playwright lo reusa (puede ser el de dev).
- **Higiene**: cada spec cierra en `afterEach` los contextos que abrió (`closePlayers`). Antes quedaban ~90 páginas vivas con su audio y sus sockets al final de la corrida, y el test de audio fallaba solo en la corrida completa.

## ADR-027 — Timers, objeciones, chat y tutorial (M7)

- **Estado**: Aceptada (2026-11-10, M7, modo autónomo)
- **Timers en el server**: cada fase guarda su timer en la sala (`syncTimer`), con una clave por instancia de fase, así un patch cualquiera no lo reinicia. La vista manda `remainingMs` medido al enviar, no una hora absoluta: el cliente cuenta desde que llega la vista y no depende de que su reloj coincida con el del server. Un intervalo de 250 ms corre `TIMER_EXPIRED` cuando vence (un timer termina a lo sumo 250 ms tarde). En pausa el timer se congela y sigue donde estaba.
- **Bonus del primer turno**: SPEC §1.7 dice "+30 s al primer turno de cada equipo". Se aplica a las dos fases de ese turno (pista y adivinanza), que es lo más generoso con quien recién arranca.
- **Objeción rechazada**: la fase de adivinanza vuelve con el tiempo completo. La objeción solo se puede hacer antes de la primera carta, así que los agentes casi no usaron su tiempo; devolvérselo entero es lo conservador.
- **Chat**: el SPEC prohíbe escribir a los jefes durante la partida. Se extiende a los espectadores que ven el mapa (opción "espectadores ven mapa"): un mensaje suyo sería una pista extra. Mensajes de equipo: los reciben los del equipo en el momento del envío (jefe incluido, como en la mesa real); el historial que llega al entrar tiene las líneas públicas y solo las de equipo que esa persona recibió. Chat y emotes viajan en eventos propios, no en `room:patch` (no tocan el estado de la partida ni el `seq`). Últimas 50 líneas en memoria; 1 línea/s y 1 emote cada 2 s por jugador.
- **Tutorial**: guionado, en el cliente, con el motor de `shared` y un RNG con seed (no hay nada secreto en un tablero de práctica). El chip "¿Primera vez?" abre el tutorial en otra pestaña para no perder el asiento en la sala. Saltear cuenta como completado (SPEC §8.1).
- **Ayudas**: se muestran hasta que se cierran con "Entendido"; un toggle en Ajustes las apaga todas.
- **E2E de timers**: el timer mínimo del SPEC es de 60 s (90 con bonus). El vencimiento se prueba por sockets con reloj inyectado (`server.tick()`); en el navegador se prueba que el anillo arranca en el tiempo del server y baja.
- **Review de M7**: (1) el chat silencia a todos los que vieron el mapa en la partida (jefes del arranque, jefes nombrados durante una pausa y espectadores con mapa), aunque después queden en el banco como espectadores; el server manda `chatMuted` en la vista y el cliente no lo deduce por su cuenta. (2) Los emotes aparecen en una esquina con el avatar de quien los mandó, no encima del avatar en el panel de equipos: en el celu los paneles están guardados en una hoja y el emote no se vería. (3) Los timers usan un reloj que no salta (`performance.timeOrigin + performance.now()`), así un ajuste de NTP no estira ni acorta un turno. (4) El chat conserva el unificador de ancho cero (emoji compuestos) y corta en 3 las marcas combinadas seguidas ("zalgo"). (5) En el tutorial, el agente bot solo "entiende" pistas de una lista de palabras afines; con otra pista avisa y deja mandarla igual.
