# Deploy de Clave (paso a paso)

Todo gratis y sin tarjeta: el server va a **Render free** y la web a **Vercel Hobby** (SPEC §0.3). El repo ya trae `render.yaml`, `apps/web/vercel.json` y el CI (`.github/workflows/ci.yml`). Son unos 20 minutos.

El orden importa: primero el server (para tener su URL), después la web (que necesita esa URL), y al final se le dice al server cuál es la URL de la web (CORS).

## 0. Antes de empezar

1. **Mergeá el PR a `main`**: la rama `main` ya existe (arranca en la base de herramientas de M0) y hay un PR abierto desde `claude/sweet-wozniak-r3mw7t` con todo el juego. Esperá a que el CI del PR esté en verde y apretá **Merge pull request** ("Create a merge commit").
2. Hacé `main` la rama por defecto: **Settings → General → Default branch** → el ícono de las flechas → elegí `main` → **Update** y confirmá. Render y Vercel van a deployar desde `main`.
3. En la pestaña **Actions**: el workflow **CI** corre en el PR y en cada push a `main`. Si algún job falla, el log dice cuál (tipos, lint, tests, E2E, Lighthouse o seguridad); el reporte de Lighthouse queda como artefacto del job ("lighthouse-report").

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
   - **Environment Variables**: agregá `VITE_SERVER_URL` = la URL de Render del paso 1.6, sin barra final (ej. `https://clave-server.onrender.com`). Agregá también `ENABLE_EXPERIMENTAL_COREPACK` = `1`, así Vercel usa exactamente la versión de pnpm del repo (`packageManager` en `package.json`).
4. **Deploy**. Tarda 1–2 minutos.
5. Copiá la URL de producción que te da Vercel (ej. `https://clave-xyz.vercel.app`). En **Settings → Domains** podés cambiarla por una más linda dentro de `.vercel.app`.
6. En **Settings → General → Node.js Version** elegí **24.x** (el proyecto usa Node 24, ADR-001) y guardá. Después: **Deployments** → los tres puntos del último → **Redeploy**, para que el cambio de versión se aplique.

## 3. Conectar los dos (CORS)

1. Volvé a Render → servicio **clave-server** → **Environment**.
2. Editá **`CLIENT_ORIGIN`** y poné la URL de Vercel del paso 2.5, sin barra final. Si usás más de una (por ejemplo la del dominio y la `.vercel.app`), separalas con coma.
3. **Save Changes** (Render redeploya solo, 2–3 minutos).

## 4. Verificar

1. Abrí la URL de Vercel: la landing tiene que decir **"Conectado"** abajo del título.
2. Creá una sala, abrí el link en otra ventana de incógnito (o pasáselo a alguien) y jugá una partida.
3. **Server dormido**: Render free duerme el server después de ~15 minutos sin tráfico. Dejalo un rato sin usar y abrí la web: tiene que aparecer **"Despertando a los agentes…"** y, en menos de un minuto, la landing normal. Si pasan 90 s, aparece "Reintentar".
4. En Render → **Logs** no tiene que haber `level":"error"`. Las líneas `socket rejected: origin not allowed` quieren decir que `CLIENT_ORIGIN` no coincide con la URL de la web (revisá el paso 3).
5. **IP real de los jugadores** (límites anti-abuso): en los mismos logs, la primera conexión deja una línea `proxy check` sin ninguna dirección, solo la forma de la cadena de proxies. Tiene que decir `"chosenEntry":"public"`. Si dice `"private"` o `"none"`, `TRUST_PROXY_HOPS=1` no es correcto para Render: probá `2` en **Environment** y volvé a mirar. Mientras no diga `public`, el server no aplica los límites por IP (prefiere no aplicarlos a meter a todos los jugadores en la misma bolsa).
6. Opcional, más seguro: en `apps/web/vercel.json`, cambiá `https://*.onrender.com wss://*.onrender.com` por la URL exacta de tu server (`https://clave-server.onrender.com wss://clave-server.onrender.com`), así la web no puede conectarse a ningún otro servicio de Render.

## 5. Cuentas, estadísticas y ranking (opcional)

Sin esto el juego anda igual: todos juegan de invitados. Con esto se puede entrar con Google, guardar estadísticas, aparecer en `/ranking` y acumular likes. Son unos 20 minutos. Ninguno de estos pasos pide tarjeta.

**5.1. Proyecto de Supabase**

1. Entrá a https://supabase.com y registrate con **"Continue with GitHub"** (plan Free).
2. **New project**: nombre `clave`, una contraseña de base de datos (guardala, no la vas a necesitar para el juego) y región **South America (São Paulo)**. **Create new project**, y esperá un par de minutos a que termine.
3. **SQL Editor** → **New query** → pegá el contenido completo de `supabase/migrations/20261111000000_accounts.sql` (está en el repo) → **Run**. Tiene que decir "Success. No rows returned".
4. **Table Editor**: tienen que aparecer `profiles`, `player_stats` y `like_events`, las tres con el candado de **RLS enabled**.

**5.2. Las claves (solo copiarlas por ahora)**

En **Project Settings → API Keys** (si ves la pestaña **"Legacy API keys"**, usá esas: son las que esperan el server y la web):

- **Project URL** (tipo `https://abcd1234.supabase.co`), en **Project Settings → Data API**.
- **anon / public**: es pública por diseño, va en la web.
- **service_role / secret**: **secreta**. Va **solo** en Render. Nunca la pegues en Vercel, en el repo, en un chat ni en un issue.

**5.3. Google como proveedor de login**

1. Entrá a https://console.cloud.google.com con tu cuenta de Google y creá un proyecto (por ejemplo `clave`).
2. **APIs & Services → OAuth consent screen**: tipo **External**, nombre de la app `Clave`, tu mail como contacto. Los scopes por defecto alcanzan (email, profile, openid). Guardá y, en **Audience** (o "Test users"), dejala en **Publish app / In production** para que cualquiera pueda entrar.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → tipo **Web application**:
   - **Authorized JavaScript origins**: `https://codigosecreto-web.vercel.app`
   - **Authorized redirect URIs**: `https://<tu-proyecto>.supabase.co/auth/v1/callback` (la Project URL de Supabase más `/auth/v1/callback`).
   - **Create** y copiá el **Client ID** y el **Client secret**.
4. En Supabase: **Authentication → Sign In / Providers → Google** → activalo, pegá el Client ID y el Client secret → **Save**.
5. En Supabase: **Authentication → URL Configuration**:
   - **Site URL**: `https://codigosecreto-web.vercel.app`
   - **Redirect URLs** → **Add URL**: `https://codigosecreto-web.vercel.app/cuenta`

**5.4. Variables en Render (server)**

En Render → **clave-server** → **Environment**, agregá:

- `AUTH_MODE` = `supabase`
- `SUPABASE_URL` = la Project URL, sin barra final.
- `SUPABASE_SERVICE_ROLE_KEY` = la clave **service_role / secret**.

**Save Changes** (redeploya solo). En los logs tiene que aparecer `"accounts":"supabase"` en la línea `server listening`. Si el server no arranca, el log dice qué falta (nunca muestra la clave).

**5.5. Variables en Vercel (web)**

En Vercel → el proyecto → **Settings → Environment Variables**, agregá:

- `VITE_SUPABASE_URL` = la Project URL.
- `VITE_SUPABASE_ANON_KEY` = la clave **anon / public**.

Después **Deployments → Redeploy** (las variables `VITE_` entran en el build). `apps/web/vercel.json` ya deja a la web hablar con `*.supabase.co`.

**5.6. Que el proyecto gratis no se pause**

Supabase pausa los proyectos Free que pasan una semana sin uso. El workflow **Supabase keepalive** hace una lectura cada 3 días; necesita dos secretos:

1. GitHub → el repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = la Project URL.
   - `SUPABASE_ANON_KEY` = la clave **anon / public** (la pública; nunca la service_role acá).
2. **Actions → Supabase keepalive → Run workflow** para probarlo: tiene que terminar en verde con "Supabase answered HTTP 200".

Ojo: GitHub apaga los workflows programados si el repo pasa 60 días sin commits; si pasa, se reactiva con un click en Actions.

**5.7. Verificar**

1. En la web: **Mi cuenta** → **Entrar con Google** → elegís tu cuenta → volvés a `/cuenta`.
2. Elegí tu nombre para el ranking y **Guardar**.
3. Jugá una partida clásica de 4 o más personas que dure 5 minutos o más. Al final, dale un like a alguien.
4. En `/cuenta` tienen que verse la partida y, si te dieron likes, los likes.
5. En Supabase → **Table Editor → player_stats** tiene que haber una fila tuya. En los logs de Render no tiene que aparecer `accounts: operation failed`.

## Si algo falla

| Síntoma                                                                 | Causa probable                                                                                                                    | Qué hacer                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| La web queda en "Buscando a los agentes…" para siempre                  | `CLIENT_ORIGIN` en Render no es exactamente la URL de Vercel                                                                      | Copiala de nuevo desde Vercel, sin barra final, y guardá                                               |
| El build de Vercel falla con "VITE_SERVER_URL is required"              | Falta la variable                                                                                                                 | Paso 2.3, y **Redeploy**                                                                               |
| La consola del navegador dice "Content Security Policy" y `connect`     | El server no está en `*.onrender.com` (por ejemplo, un dominio propio)                                                            | Agregá ese dominio (`https://…` y `wss://…`) a `connect-src` en `apps/web/vercel.json`                 |
| "Más despacio, che" al crear salas                                      | Más de 10 salas por minuto desde la misma IP                                                                                      | Es el límite anti-abuso; si juegan muchos desde la misma red, subí `ROOMS_PER_MINUTE` en Render        |
| "El servidor no acepta más conexiones desde tu red"                     | Más de 30 pestañas abiertas desde la misma red, o `TRUST_PROXY_HOPS` mal                                                          | Revisá el paso 4.5; si es una red grande de verdad (una escuela), se puede subir el límite             |
| Un deploy de Render falla en `corepack enable` (EACCES)                 | El runtime de Render no deja habilitar corepack                                                                                   | En `render.yaml`, cambiá `corepack enable &&` por `npm i -g pnpm@10.28.0 &&` al principio del build    |
| Los "preview deployments" de Vercel quedan en "Buscando a los agentes…" | Esas URLs (`…-git-….vercel.app`) no están en `CLIENT_ORIGIN`                                                                      | Es esperado: se prueba en la URL de producción. Para usar un preview, agregá su URL a `CLIENT_ORIGIN`  |
| CI rojo en "Lighthouse"                                                 | La landing bajó de 90 en Performance o de 95 en Accesibilidad (perfil mobile)                                                     | El reporte queda en el job; en local: `pnpm --filter @clave/web build && npx @lhci/cli@0.14.0 autorun` |
| "Entrar con Google" vuelve a `/cuenta` pero sigue sin sesión            | Falta `https://codigosecreto-web.vercel.app/cuenta` en Supabase → Redirect URLs, o el redirect URI de Google no es el de Supabase | Revisá 5.3 pasos 3 y 5                                                                                 |
| Google dice "redirect_uri_mismatch"                                     | El redirect URI en Google Cloud no es exactamente `https://<proyecto>.supabase.co/auth/v1/callback`                               | Copialo de nuevo, sin barra final                                                                      |
| `/cuenta` dice "No pudimos traer tu cuenta"                             | El server no tiene `AUTH_MODE=supabase` o las claves están mal                                                                    | Revisá 5.4; los logs de Render dicen `accounts: operation failed` con el motivo                        |
| Las estadísticas no suben                                               | La partida no cuenta: tiene que ser clásica, de 4 o más jugadores y de 5 minutos o más                                            | Es el diseño (spec de cuentas §3)                                                                      |

## Qué no hace falta

- Las salas no usan base de datos: viven en memoria del server (la base de Supabase es solo para las cuentas opcionales). Si Render reinicia el server (deploy nuevo o se durmió), las salas en curso se pierden; los jugadores crean otra.
- No hay que crear cuentas en ningún otro servicio. Los reportes de Lighthouse y los escaneos de seguridad quedan dentro de GitHub Actions.
