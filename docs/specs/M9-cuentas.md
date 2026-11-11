# Spec — Cuentas opcionales, estadísticas, ranking y likes

> Pedido de Tomás (hito "M9.4: cuentas"). Cubre lo que el SPEC llamaba M9.3 ("stats persistentes con Supabase", bloqueado hasta ahora porque pedía crear una cuenta: la cuenta la crea Tomás al deployar, ver `docs/DEPLOY.md`). **[decisión]** Se numera como el pedido ("M9.4 cuentas"); los mazos de la comunidad, que ya eran M9.4, no cambian. Lo que el pedido no define está marcado **[decisión]** y repetido en `docs/DECISIONS.md` (ADR-033).

## 1. Principios

- **Invitado primero.** Sin login se juega exactamente igual que hoy. Ninguna pantalla del juego pide cuenta.
- **Lo mínimo.** De cada usuario se guarda: id (el de Supabase Auth), nombre visible y estadísticas. El mail solo lo maneja Supabase Auth: el server nunca lo lee para guardarlo, ni lo manda en ningún payload, ni lo escribe en logs.
- **El server escribe, el cliente lee.** Los resultados y los likes los escribe solo el server de Socket.IO, con la service role key. El cliente nunca escribe estadísticas.
- **Si Supabase falla, el juego sigue.** Todo guardado falla en silencio con un log del server (sin datos personales ni claves).

## 2. Cuentas

- Login con **Google vía Supabase Auth** (flujo PKCE). El botón vive en `/cuenta` y hay un link "Entrar" en la portada.
- **Nombre visible**: lo elige el usuario en `/cuenta`. Mismas reglas que el apodo (1 a 20 caracteres, sin HTML ni caracteres de control). **[decisión]** Al entrar por primera vez el nombre arranca vacío y el usuario no aparece en el ranking hasta que elige uno: así nunca se muestra por defecto el nombre de Google (que puede ser el real).
- El apodo de cada partida sigue siendo el de siempre; el nombre visible solo se usa en el ranking.
- **Sesión en el socket**: el cliente manda el token de Supabase al conectar (`auth.token` del handshake). El server lo verifica contra Supabase Auth (`/auth/v1/user`) y guarda en el socket solo el id del usuario. **[decisión]** Un token inválido o vencido no corta la conexión: se juega como invitado.
- **Una cuenta, un asiento por sala.** **[decisión]** Si la misma cuenta ya tiene un asiento en la sala, un segundo asiento (otra pestaña) entra como invitado: así no se duplican estadísticas ni se da likes a sí misma.
- **Borrar cuenta**: `/privacidad` tiene "Borrar mi cuenta y mis datos" (con confirmación). El server borra el usuario de Supabase Auth; perfil, estadísticas y likes se borran en cascada.

## 3. Estadísticas

- Solo cuentan partidas del **modo clásico** **[decisión]** (el cooperativo es de 2 o 3 jugadores, nunca llega a 4) con **4 o más jugadores** (no espectadores) al empezar y que duraron **al menos 5 minutos** **[decisión]** (`STATS_MIN_GAME_SECONDS`, 300 por defecto). Una partida que se corta con "Volver al lobby" no cuenta.
- Quién cuenta: los jugadores que estaban al empezar, con el rol que tenían al empezar **[decisión]** (un jefe reemplazado en una pausa cuenta como jefe). Quien entró a mitad de partida es espectador y no cuenta.
- Por usuario: partidas, victorias, partidas y victorias **como jefe** y **como agente**, **racha actual** y **mejor racha** de victorias seguidas, **mejor pista** (la de más agentes propios conectados entre las que dio como jefe; en empate queda la anterior) y likes recibidos.
- **[decisión]** La pista se atribuye a quien era jefe de ese equipo cuando la dio.
- La cuenta se hace en una función pura de `shared` (testeada) y, en Supabase, en una función SQL equivalente que corre en una sola transacción.

## 4. Ranking (`/ranking`)

- **Victorias**: usuarios con **10 o más partidas**, por victorias (desempate: más porcentaje de victorias, después menos partidas, después nombre).
- **Los más queridos**: mismo mínimo, por **likes recibidos por partida jugada** (desempate: más likes, después nombre).
- **[decisión]** Los 50 primeros de cada lista. Solo se muestran nombre visible y números; nunca ids ni mails. Quien no eligió nombre no aparece.
- Mobile-first, con el estilo del juego (expedientes). Si quien mira tiene sesión, su fila se marca "vos".

## 5. Likes

- Solo en la **pantalla de fin** de una partida clásica **[decisión]**. Durante la partida el server los rechaza (`LIKES_NOT_NOW`): serían una señal para los agentes.
- Cada jugador de la partida (no espectadores) puede dar **un like en total por partida** **[decisión]** ("un solo like por persona por partida") a cualquier otro jugador de esa partida, de cualquier equipo. Nunca a sí mismo (ni a otro asiento de su misma cuenta). Sin dislike.
- Los invitados pueden dar likes. Solo los usuarios con login **acumulan** los recibidos.
- El receptor ve solo **"Te dieron N likes"** con una animación. Nadie ve quién dio cada like ni quién no recibió. El que da ve solo que su like se dio.
- **Antifarmeo** en el server: (1) ambos jugaron esa partida desde el principio; (2) la partida cumple las condiciones de las estadísticas para que el like **se guarde** **[decisión]** (en una partida corta se ve el aviso, pero no se acumula); (3) **3 likes guardados por día por par** dador→receptor **[decisión]**; todos los invitados comparten un mismo "dador" para ese tope, así abrir pestañas de invitado no sirve.
- Para el tope se guarda quién dio a quién; **[decisión]** esas filas se borran a los 2 días (solo sirven para el tope diario) y nunca salen de la base.

## 6. Datos (`supabase/migrations/`)

- `profiles(user_id, display_name)`, `player_stats(user_id, …)`, `like_events(receiver_id, giver_key, day)`, todas con **RLS activado**.
- El cliente (rol `anon`/`authenticated`) solo puede leer su propio perfil y estadísticas, y las vistas públicas del ranking (sin ids). `like_events` no tiene políticas: nadie la lee desde el cliente.
- Las escrituras pasan por funciones `security definer` que solo puede ejecutar la service role, que usa únicamente el server.
- **[decisión]** El cliente del juego lee ranking y perfil **a través del server** (`/api/ranking`, `/api/me`), que usa la misma interfaz de repositorio; las políticas RLS quedan igual como defensa en profundidad.

## 7. Server

- Interfaz `AccountsRepo` con dos implementaciones: **en memoria** (tests, desarrollo y E2E) y **Supabase** (HTTP con `fetch` inyectado, sin red en los tests).
- `AUTH_MODE`: `off` (sin cuentas, por defecto), `memory` (desarrollo: login de prueba por nombre en `/api/dev/login`; **[decisión]** el server se niega a arrancar así con `NODE_ENV=production`) o `supabase`.
- La service role key va solo en el entorno del server (`SUPABASE_SERVICE_ROLE_KEY` en Render). Nunca en el cliente, en el repo ni en los logs.

## 8. Fuera de alcance

- Otros proveedores de login, avatares de cuenta, historial de partidas, amigos.

## 9. Criterio de aceptación

Con `AUTH_MODE=memory`, un E2E: cuatro jugadores (dos con cuenta) juegan una partida que cuenta; al final se dan likes, el receptor ve "Te dieron N likes", y `/ranking` y `/cuenta` muestran los números. Un invitado juega igual que antes. El test anti-filtración cubre los likes. En producción, el chequeo manual de `docs/MANUAL-CHECKS.md` con Google real.
