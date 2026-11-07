# Clave — reglas permanentes del proyecto

Juego web de deducción por equipos con salas online. **`SPEC.md` es la fuente de verdad**: ante cualquier duda o contradicción, gana el SPEC y se avisa a Tomás. El SPEC solo se edita con su OK explícito.

**Leé `CONSTRAINTS.md` antes de escribir código. No lo debilites para que un cambio pase.**

## Stack (SPEC §0.3)
- Monorepo **pnpm workspaces**: `apps/web`, `apps/server`, `packages/shared`. Node 24 LTS (ver `docs/DECISIONS.md` ADR-001).
- Web: Vite + React + TypeScript, Tailwind + CSS variables (tokens), Motion, Zustand, Howler, cliente Socket.IO.
- Server: Node + TypeScript + Express + Socket.IO. Estado **en memoria** (Map de salas), sin DB.
- Validación: **Zod** en todo evento entrante. Tests: Vitest (unit) + Playwright (E2E, 4 navegadores).
- Deploy: web en Vercel Hobby, server en Render free. Presupuesto $0: nada que pida tarjeta.

## Estructura (SPEC §11)
```
apps/web/src/{screens,components,animations,audio,store,net,art,i18n/es-AR.ts}
apps/server/src/{rooms,handlers,views,index.ts}
packages/shared/{engine,schemas,types,words}
e2e/
docs/{DECISIONS.md,BACKLOG.md}
```

## Arquitectura
- **Motor de reglas puro** en `packages/shared/engine`: `applyAction(state, action, rng) → { state, events }`. Sin I/O, sin `Date.now()`, sin `Math.random()`: el RNG con seed (`mulberry32`) entra por parámetro. Acción inválida → error tipado y el estado no cambia.
- **Server autoritativo**: el cliente solo manda intenciones; el server valida (Zod + motor), aplica y emite.
- Cada `room:patch` lleva `seq` incremental; si el cliente ve un salto, pide `room:state`.

## Regla de oro anti-trampa (SPEC §2.1)
- **El mapa clave nunca llega a agentes ni espectadores.** Todo lo que sale del server hacia un jugador pasa por `toPublicView(state, playerId)` en `apps/server/src/views/`.
- `type` de una carta solo viaja si `revealed === true` o si el destinatario es jefe (o la sala habilitó "espectadores ven mapa" y es espectador).
- IDs de carta aleatorios por partida, nunca índices 0–24.
- **Cualquier cambio en vistas, payloads, eventos o serialización exige correr el test anti-filtración** (`apps/server/src/views/anti-leak.test.ts`, se crea en M3) y que pase.

## Copy y tono (SPEC §3.5)
- **Todo** texto visible va en `apps/web/src/i18n/es-AR.ts`. Nada de strings literales en JSX.
- Castellano rioplatense con voseo ("Pensá", "Mirá", "che"; "boludo" solo donde cuadra, como en el ejemplo del traidor). Errores del server también en castellano rioplatense.

## Arte, audio y nombre
- Arte 100% original. **Prohibido** usar el nombre, el arte, la lista de palabras o el estilo de la caja de "Código Secreto"/"Codenames". Nombre del juego: "Clave".
- Assets de audio/arte: solo CC0 o con licencia anotada en el `LICENSES.md` de su carpeta (ej. `apps/web/public/audio/LICENSES.md`).
- Animar solo `transform` y `opacity`; todo respeta `prefers-reduced-motion` y el toggle de ajustes.

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta web y server juntos |
| `pnpm test` | Vitest en todos los paquetes |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes |
| `pnpm e2e` | Playwright (desde M3) |
| `pnpm check:fast` / `check:task` / `check:full` | Ver `CONSTRAINTS.md` |

## Forma de trabajo (ver `docs/KICKOFF.md`)
- Un hito por vez (M0 → M9). Plan → OK de Tomás → build incremental → cierre con verificación de criterios de aceptación → OK.
- Un commit por tarea, Conventional Commits (`feat(engine): …`, `fix(server): …`).
- TDD en motor y handlers del server.
- Decisiones técnicas que no estén en el SPEC → `docs/DECISIONS.md` (ADR corto).
- Mejoras fuera del alcance del hito → `docs/BACKLOG.md`, no se implementan.
- Regla del juego ambigua → preguntar, no interpretar.
- No crear cuentas, no deployar, no instalar global con `sudo`, no agregar dependencias pagas.
