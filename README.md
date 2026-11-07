# Clave

Juego web de deducción por equipos con salas online, para jugar con amigos desde la compu o el celu.
Inspirado en juegos de deducción por equipos. Proyecto sin fines de lucro.

- Especificación: [`SPEC.md`](SPEC.md) (fuente de verdad)
- Reglas para agentes de código: [`CLAUDE.md`](CLAUDE.md)
- Vara de calidad: [`CONSTRAINTS.md`](CONSTRAINTS.md)
- Decisiones técnicas: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Requisitos

- Node 24 (`.nvmrc`; funciona desde Node 22)
- pnpm 10 vía Corepack: `corepack enable`

## Arranque rápido

```bash
corepack enable
pnpm install
pnpm dev
```

Abrí <http://localhost:5173>: el indicador tiene que decir **Conectado**. El server queda en <http://localhost:3001> (`/health`).

Variables de entorno opcionales: copiá `apps/server/.env.example` a `apps/server/.env` y `apps/web/.env.example` a `apps/web/.env`.

## Comandos

| Comando           | Qué hace                                                        |
| ----------------- | --------------------------------------------------------------- |
| `pnpm dev`        | Levanta web (Vite, :5173) y server (tsx watch, :3001)           |
| `pnpm test`       | Tests de todos los paquetes (Vitest)                            |
| `pnpm coverage`   | Tests con cobertura                                             |
| `pnpm lint`       | ESLint                                                          |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes                            |
| `pnpm format`     | Prettier                                                        |
| `pnpm build`      | Build de web (`apps/web/dist`) y server (`apps/server/dist`)    |
| `pnpm check:fast` | typecheck + lint + formato + floor guard (corre en cada commit) |
| `pnpm check:task` | `check:fast` + tests con cobertura                              |
| `pnpm check:full` | `check:task` + build                                            |

El hook de pre-commit corre `check:fast` y los tests de `packages/shared`.

## Estructura

```
apps/web        Vite + React + Tailwind (cliente)
apps/server     Express + Socket.IO (server autoritativo)
packages/shared contrato compartido, motor de reglas (M1), schemas Zod, mazos
scripts/        floor-guard.mjs (ver CONSTRAINTS.md)
docs/           decisiones, backlog, kickoff
```
