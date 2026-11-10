# Deploy de Clave (paso a paso)

Todo gratis y sin tarjeta: el server va a **Render free** y la web a **Vercel Hobby** (SPEC §0.3). El repo ya trae `render.yaml`, `apps/web/vercel.json` y el CI (`.github/workflows/ci.yml`). Son unos 20 minutos.

El orden importa: primero el server (para tener su URL), después la web (que necesita esa URL), y al final se le dice al server cuál es la URL de la web (CORS).

## 0. Antes de empezar

1. Mergeá la rama `claude/sweet-wozniak-r3mw7t` a `main` (un PR en GitHub y "Merge"). Render y Vercel van a deployar desde `main`.
2. En GitHub → pestaña **Actions**: el workflow **CI** tiene que estar en verde en `main`. Corre solo en cada push y en cada PR. Si algún job falla, el log dice cuál (tipos, lint, tests, E2E, Lighthouse o seguridad).

## 1. Server en Render

1. Entrá a https://render.com y registrate con **"Sign in with GitHub"** (plan gratis, no pide tarjeta).
2. Arriba a la derecha: **New + → Blueprint**.
3. Elegí el repo `To2003/CodigoSecreto` (si no aparece: "Configure account" y dale acceso a ese repo). Rama: `main`.
4. Render lee `render.yaml` y muestra el servicio **clave-server** (plan Free, región Virginia). Te pide un valor para **`CLIENT_ORIGIN`**: por ahora poné `http://localhost:5173` (lo cambiás en el paso 3).
5. **Apply**. El primer build tarda 3–5 minutos.
6. Cuando diga **Live**, copiá la URL del servicio (algo como `https://clave-server.onrender.com`).
7. Probá en el navegador: `https://clave-server.onrender.com/health` tiene que mostrar `{"ok":true,"uptimeSec":…}`.

## 2. Web en Vercel

1. Entrá a https://vercel.com y registrate con **"Continue with GitHub"** (plan Hobby, gratis).
2. **Add New… → Project** e importá `To2003/CodigoSecreto`.
3. En la configuración del proyecto:
   - **Root Directory**: `apps/web` (botón "Edit"). Dejá tildado "Include files outside the root directory" (lo necesita el monorepo).
   - **Framework Preset**: Vite (lo toma de `vercel.json`).
   - **Environment Variables**: agregá `VITE_SERVER_URL` = la URL de Render del paso 1.6, sin barra final (ej. `https://clave-server.onrender.com`).
4. **Deploy**. Tarda 1–2 minutos.
5. Copiá la URL de producción que te da Vercel (ej. `https://clave-xyz.vercel.app`). En **Settings → Domains** podés cambiarla por una más linda dentro de `.vercel.app`.
6. En **Settings → General → Node.js Version** elegí **24.x** (el proyecto usa Node 24, ADR-001).

## 3. Conectar los dos (CORS)

1. Volvé a Render → servicio **clave-server** → **Environment**.
2. Editá **`CLIENT_ORIGIN`** y poné la URL de Vercel del paso 2.5, sin barra final. Si usás más de una (por ejemplo la del dominio y la `.vercel.app`), separalas con coma.
3. **Save Changes** (Render redeploya solo, 2–3 minutos).

## 4. Verificar

1. Abrí la URL de Vercel: la landing tiene que decir **"Conectado"** abajo del título.
2. Creá una sala, abrí el link en otra ventana de incógnito (o pasáselo a alguien) y jugá una partida.
3. **Server dormido**: Render free duerme el server después de ~15 minutos sin tráfico. Dejalo un rato sin usar y abrí la web: tiene que aparecer **"Despertando a los agentes…"** y, en menos de un minuto, la landing normal. Si pasan 90 s, aparece "Reintentar".
4. En Render → **Logs** no tiene que haber `level":"error"`. Las líneas `socket rejected: origin not allowed` quieren decir que `CLIENT_ORIGIN` no coincide con la URL de la web (revisá el paso 3).

## Si algo falla

| Síntoma                                                             | Causa probable                                                                | Qué hacer                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| La web queda en "Buscando a los agentes…" para siempre              | `CLIENT_ORIGIN` en Render no es exactamente la URL de Vercel                  | Copiala de nuevo desde Vercel, sin barra final, y guardá                                               |
| El build de Vercel falla con "VITE_SERVER_URL is required"          | Falta la variable                                                             | Paso 2.3, y **Redeploy**                                                                               |
| La consola del navegador dice "Content Security Policy" y `connect` | El server no está en `*.onrender.com` (por ejemplo, un dominio propio)        | Agregá ese dominio (`https://…` y `wss://…`) a `connect-src` en `apps/web/vercel.json`                 |
| "Más despacio, che" al crear salas                                  | Más de 10 salas por minuto desde la misma IP                                  | Es el límite anti-abuso; si juegan muchos desde la misma red, subí `ROOMS_PER_MINUTE` en Render        |
| Todos los jugadores comparten límites como si fueran uno            | El server ve la IP del proxy de Render y no la de cada jugador                | `TRUST_PROXY_HOPS` tiene que estar en `1` (ya viene así en `render.yaml`)                              |
| CI rojo en "Lighthouse"                                             | La landing bajó de 90 en Performance o de 95 en Accesibilidad (perfil mobile) | El reporte queda en el job; en local: `pnpm --filter @clave/web build && npx @lhci/cli@0.14.0 autorun` |

## Qué no hace falta

- No hay base de datos: las salas viven en memoria del server. Si Render reinicia el server (deploy nuevo o se durmió), las salas en curso se pierden; los jugadores crean otra.
- No hay que crear cuentas en ningún otro servicio. Los reportes de Lighthouse y los escaneos de seguridad quedan dentro de GitHub Actions.
