# SPEC — "Clave" (juego web de palabras y espías, inspirado en Código Secreto)

> Documento para desarrollar con un agente de código en VS Code, hito por hito (M0 → M9).
> Cada hito tiene criterios de aceptación: **no se pasa al siguiente hasta cumplirlos**.
> Presupuesto: $0. Sin tarjeta de crédito en ningún servicio.

---

## 0. Decisiones de entrada

### 0.1 Nombre e identidad (importante)
Las **mecánicas** de un juego de mesa no tienen derechos de autor, pero el **nombre "Código Secreto"/"Codenames", el arte de la caja, las ilustraciones de las cartas y su lista de palabras sí** (son de CGE / Devir). Para que el proyecto sea tuyo y puedas mostrarlo en el portfolio sin problemas:

- Nombre propio. Nombre de trabajo: **"Clave"**. Alternativas: *Contraseña*, *Agentes del Plata*, *Nombre en Clave*.
- Arte 100% original (sección 5). Nada copiado ni "parecido a propósito" a la caja.
- Lista de palabras propia (sección 7).
- En el footer: "Inspirado en juegos de deducción por equipos. Proyecto sin fines de lucro."

### 0.2 Objetivo
Juego online para jugar con amigos, cada uno desde su compu o celu, con salas por código. Tiene que sentirse **terminado**: animaciones, sonido, tutorial, reconexión, cero trampas posibles.

### 0.3 Stack (todo gratis)
| Capa | Elección | Por qué |
|---|---|---|
| Monorepo | **pnpm workspaces**: `apps/web`, `apps/server`, `packages/shared` | Tipos y motor de reglas compartidos |
| Front | **Vite + React + TypeScript** | Rápido, conocido |
| Estilos | **Tailwind CSS** + CSS variables para tokens | Theming y modo daltónico fácil |
| Animación | **Motion (Framer Motion)** | Flips, layout animations, springs |
| Estado cliente | **Zustand** | Simple, sin boilerplate |
| Sonido | **Howler.js** | Sprites de audio, volumen por canal, desbloqueo en mobile |
| Tiempo real | **Socket.IO** (server + client) | Reconexión y rooms resueltos |
| Server | **Node 20 + TypeScript + Express + Socket.IO** | Servidor autoritativo |
| Persistencia | **En memoria** (Map de salas). Opcional M9: Supabase free para stats | Una partida dura 15–30 min, no hace falta DB |
| Validación | **Zod** en todos los eventos entrantes | Nunca confiar en el cliente |
| Tests | **Vitest** (motor de reglas) + **Playwright** (E2E con 4 navegadores) | |
| Deploy | Web en **Vercel Hobby**, server en **Render free** | Mismo esquema que Tierra Austral |

### 0.4 Limitación conocida de Render free
El server se duerme tras ~15 min sin tráfico y tarda ~30–60 s en despertar. Mitigación obligatoria:
- Al abrir la landing, el cliente hace `GET /health` inmediatamente (despierta el server mientras el usuario lee).
- Si tarda, pantalla "**Despertando a los agentes…**" con animación (no un spinner pelado) y barra de progreso indeterminada.
- Timeout de 90 s → mensaje con botón "Reintentar".

---

## 1. Reglas del juego (motor)

### 1.1 Componentes
- **Tablero**: 25 cartas de palabra en grilla 5×5.
- **Mapa clave** (solo lo ven los jefes): asigna a cada carta un tipo:
  - Equipo que **empieza**: 9 agentes.
  - Otro equipo: 8 agentes.
  - 7 **civiles** (neutrales).
  - 1 **traidor** (el "asesino": tocarlo = derrota instantánea).
- Equipos: **Rojo** y **Azul** (nombres de UI: "Equipo Rojo" / "Equipo Azul"; personalizables en sala).

### 1.2 Roles
- **Jefe de espías** (1 por equipo): ve el mapa clave, da pistas.
- **Agentes** (1+ por equipo): ven solo las palabras, adivinan.
- **Espectador**: ve el tablero como agente (sin mapa), no actúa. Opción del host: "espectadores ven el mapa" (off por defecto).
- Mínimo para arrancar: **4 jugadores** (2 por equipo). Con 3 se permite el modo **Cooperativo** (M8).

### 1.3 Preparación
1. Sorteo del equipo que empieza (seed del server). Ese equipo tiene 9 agentes.
2. Se eligen 25 palabras al azar de los mazos activos, sin repetir.
3. Se genera el mapa clave al azar.
4. Se asigna jefe de cada equipo (manual en el lobby o "sortear jefes").

### 1.4 Turno
1. **Fase PISTA**: el jefe del equipo activo envía `{ palabra, número }`.
   - `número` ∈ {0, 1, …, 9, ∞}.
2. **Fase ADIVINAR**: los agentes del equipo activo revelan cartas una por una.
   - Máximo de intentos: `número + 1`. Con `0` o `∞` → ilimitados.
   - **Obligatorio hacer al menos un intento** (el botón "Pasar turno" se habilita recién después del primer intento).
3. Resultado de cada revelación:
   - Agente propio → sigue pudiendo adivinar (si le quedan intentos).
   - Civil → termina el turno.
   - Agente rival → termina el turno (y suma para el rival).
   - Traidor → **el equipo activo pierde** al instante.
4. El turno termina también por: intentos agotados, "Pasar turno", o timer vencido (si está activo).

### 1.5 Victoria
- Un equipo gana cuando **todos sus agentes** están revelados — **aunque los haya revelado el equipo rival**.
- Un equipo pierde si revela al traidor.
- Se evalúa después de cada revelación, en este orden: traidor → agentes completos de cada equipo.

### 1.6 Validez de pistas
Validación **automática** en server (bloquea el envío con mensaje claro):
- Una sola palabra: sin espacios. Se permiten guiones solo si el host activa "palabras compuestas".
- No puede ser igual a una palabra **no revelada** del tablero.
- No puede contener ni estar contenida en una palabra no revelada (ej.: tablero "SOL" → pista "GIRASOL" bloqueada).
- Comparación normalizada: minúsculas, sin tildes, sin diéresis, `ñ` se mantiene distinta de `n`, singular/plural básico (quitar `s`/`es` final para comparar).
- Solo letras (no números como pista, porque el número va aparte).
- Máx. 24 caracteres.

Validación **social** (no automatizable: rimas, referencias a letras, posición en la grilla, gestos):
- Botón "**Objetar pista**" para el jefe rival, disponible hasta la primera revelación.
- Abre votación al resto de la sala (excepto el jefe que dio la pista) con 15 s.
- Si la mayoría acepta la objeción: el turno termina **y** se revela automáticamente un agente del equipo rival (penalización oficial: el rival "gana" una carta).
- El host puede desactivar objeciones.

### 1.7 Configuración de sala (host)
| Opción | Valores | Default |
|---|---|---|
| Modo | Clásico / Cooperativo (M8) | Clásico |
| Mazos de palabras | multiselección | "Clásico" |
| Palabras custom | textarea, mínimo 25 si es mazo único | — |
| Timer de pista | Off / 60 / 90 / 120 / 180 s | Off |
| Timer de adivinanza | Off / 60 / 90 / 120 s | Off |
| Bonus primer turno | +30 s al primer turno de cada equipo | On si hay timer |
| Cómo se revela | "Cualquier agente" / "Mayoría de su equipo" | Cualquier agente |
| Objeciones | On / Off | On |
| Espectadores ven mapa | On / Off | Off |
| Palabras compuestas | On / Off | Off |

### 1.8 Motor de reglas (`packages/shared/engine`)
- **Funciones puras**: `applyAction(state, action, rng) → { state, events }`. Sin I/O.
- RNG con **seed** (ej. `mulberry32`) → partidas reproducibles para tests y replays.
- Máquina de estados:

```
LOBBY → STARTING → CLUE(team) → GUESS(team) → CLUE(otherTeam) … → GAME_OVER
                         ↘ OBJECTION_VOTE ↗
GAME_OVER → LOBBY (revancha)
```

- Acciones: `START_GAME`, `GIVE_CLUE`, `POINT_CARD` (marcar sin revelar), `REVEAL_CARD`, `END_GUESSING`, `OBJECT_CLUE`, `VOTE_OBJECTION`, `TIMER_EXPIRED`, `REMATCH`.
- Cada acción valida: fase correcta, rol correcto, equipo correcto, carta no revelada. Si falla → error tipado, el estado no cambia.
- Cobertura de tests del motor: **≥ 95%**.

---

## 2. Arquitectura de red y anti-trampa

### 2.1 Servidor autoritativo
- El cliente **solo envía intenciones**. El server valida, aplica y emite.
- **El mapa clave NUNCA viaja a un agente o espectador.** El server serializa una vista por jugador:
  - `toPublicView(state, playerId)` → cartas con `{ word, revealed, type? }` donde `type` solo va si `revealed === true` o si el jugador es jefe.
  - Test obligatorio: inspeccionar todos los payloads de un agente durante una partida completa y verificar que no contienen tipos de cartas no reveladas.
- Las cartas tienen IDs aleatorios por partida (no 0–24 en orden) para no filtrar nada por índice.

### 2.2 Eventos Socket.IO
Cliente → Server (todos validados con Zod):
```
room:create { nickname, avatar }        → { roomCode, playerId, token }
room:join   { roomCode, nickname, avatar, token? }
room:leave
lobby:setTeam { team: 'red'|'blue'|'spectator' }
lobby:setRole { role: 'spymaster'|'agent' }
lobby:randomize                          (host)
lobby:updateSettings { ...settings }     (host)
lobby:kick { playerId }                  (host)
game:start                               (host)
game:clue { word, count }
game:point { cardId | null }
game:reveal { cardId }
game:endGuessing
game:object
game:vote { accept: boolean }
game:rematch                             (host)
chat:send { text, scope: 'all'|'team' }
emote:send { emoteId }
```
Server → Cliente:
```
room:state   (vista filtrada completa, al entrar/reconectar)
room:patch   (diff + lista de eventos para animar, con seq incremental)
game:event   { type: 'CARD_REVEALED'|'TURN_CHANGED'|'CLUE_GIVEN'|'GAME_OVER'|… }
chat:message
error        { code, message }   (mensajes en castellano rioplatense)
```
- Cada patch lleva `seq`. Si el cliente detecta un salto → pide `room:state` completo.

### 2.3 Salas
- Código de 4 letras sin ambiguas (sin `O/0/I/1/L`), ej. `KTRX`.
- URL compartible: `/sala/KTRX` → abre directo el join con el campo de nombre.
- Botón "Copiar link" y "Compartir" (Web Share API en celu → WhatsApp).
- Máx. 16 jugadores por sala. Sala se borra tras 30 min sin nadie conectado.
- Host: el creador; si se va, pasa al siguiente más antiguo.

### 2.4 Reconexión (imprescindible)
- Al unirse, el server devuelve un `token` que se guarda en `localStorage` por sala.
- Si se cae la conexión: el jugador queda "desconectado" (avatar en gris) **60 s** reservando su lugar; al volver recupera rol y equipo.
- Si el jefe activo se desconecta: la partida se **pausa** automáticamente con overlay "Esperando a {nombre}…", y el host puede reasignar el jefe.
- F5 en medio de la partida tiene que volver exactamente al mismo estado.

### 2.5 Seguridad básica
- Rate limit por socket (ej. 20 eventos/s, chat 1 msg/s).
- Sanitizar nicknames y chat (máx. 20 y 200 chars, sin HTML).
- Filtro de palabras en nicknames: opcional, lista simple.
- CORS restringido al dominio de Vercel.

---

## 3. Pantallas y flujo de UX

### 3.1 Mapa de pantallas
1. **Landing** — logo animado, "Crear sala", "Unirse con código", "Cómo se juega", "Tutorial". Despierta el server de fondo.
2. **Perfil rápido** — nickname + elegir avatar (12 originales) + color de accesorio. Se recuerda en `localStorage`.
3. **Lobby** — dos columnas (Rojo / Azul) + espectadores. Cada columna con slot de **Jefe** y lista de **Agentes**. Arrastrar o clic para cambiarse. Panel de configuración (solo host editable, el resto lo ve en solo lectura). Botón "Empezar" deshabilitado con tooltip explicando qué falta ("Falta un jefe en el Equipo Azul").
4. **Partida** (sección 3.2).
5. **Fin de partida** — ganador, mapa clave completo revelado sobre el tablero, historial de pistas, stats, "Revancha" / "Volver al lobby".
6. **Reglas** — página estática con ilustraciones, también como modal dentro de la partida.
7. **Tutorial** (sección 6).
8. **Ajustes** — volumen (master, música, efectos), modo daltónico, reducir animaciones, tamaño de texto de cartas, vibración en celu.

### 3.2 Layout de partida (desktop ≥ 1024 px)
```
┌──────────────────────────────────────────────────────────┐
│ [Rojo 6 restantes]   BANNER DE TURNO + TIMER   [Azul 8]  │
├──────────┬───────────────────────────────┬───────────────┤
│ Equipo   │                               │ Equipo Azul   │
│ Rojo     │        TABLERO 5×5            │ jugadores     │
│ jugadores│                               │               │
│          │                               │ Historial de  │
│ Historial│                               │ pistas        │
│ pistas   ├───────────────────────────────┤               │
│          │ ZONA DE ACCIÓN (según rol)    │ Chat          │
└──────────┴───────────────────────────────┴───────────────┘
```
- **Zona de acción** cambia según rol y fase:
  - Jefe activo en fase pista: input de palabra + selector de número (botones 0–9 y ∞) + "Mandar pista". Validación en vivo (borde rojo + texto "Esa palabra está en el tablero").
  - Agentes activos: muestra la pista grande ("**PLAYA · 2**"), contador de intentos restantes y botón "Pasar turno".
  - Resto: "Esperando a que {jefe} piense una pista…" con animación sutil.
- **Vista de jefe**: cada carta muestra su color de fondo tenue + ícono del tipo; las reveladas se ven "tapadas" (más oscuras, con la ilustración). Toggle "Ver como agente" para chequear que no sea ambigua.

### 3.3 Mobile (< 768 px)
- Tablero 5×5 ocupando el ancho (cartas de ~64 px, texto auto-ajustado con `clamp()` y reducción hasta que entre la palabra en una línea; nunca cortar con "…").
- Banner de turno arriba, zona de acción fija abajo (estilo bottom sheet).
- Equipos, historial y chat en pestañas de un drawer.
- Doble tap para revelar (primer tap marca/señala, segundo confirma). En desktop: clic marca, botón "✓" sobre la carta revela.

### 3.4 Interacciones clave
- **Señalar** (`POINT_CARD`): un agente puede marcar una carta con su avatar mini antes de revelarla. Los compañeros ven los avatares encima de la carta → permite debatir. Varias marcas por carta.
- **Revelar**: botón de confirmación sobre la carta señalada. Si la sala está en modo "Mayoría", la carta se revela cuando la mayoría de los agentes del equipo la señaló.
- **Hover** en carta: leve elevación (`translateY(-2px)` + sombra). Cursor solo interactivo cuando se puede actuar.
- **Atajos de teclado** (desktop): `Enter` mandar pista, `Esc` deseleccionar, flechas para moverse en la grilla, `Espacio` señalar, `Enter` revelar, `P` pasar turno, `T` chat.

### 3.5 Copy de la UI (castellano rioplatense, con voseo)
Ejemplos que fijan el tono:
- Turno propio de jefe: "**Te toca, jefe.** Pensá una pista que conecte tus palabras."
- Turno de agentes: "Tu jefe dijo **PLAYA · 2**. ¿Cuáles son?"
- Esperando: "El Equipo Azul está pensando… paciencia, che."
- Civil: "Era un civil. Se terminó el turno."
- Agente rival: "¡Uh! Le regalaste un agente al Equipo Azul."
- Traidor: "**Tocaste al traidor.** Partida perdida, boludo."
- Victoria: "¡Misión cumplida! Ganó el Equipo Rojo."
- Pista inválida: "No vale, esa palabra está en el tablero."
- Reconectando: "Se te cortó. Reconectando…"
- Server dormido: "Despertando a los agentes…"

Todos los textos en `apps/web/src/i18n/es-AR.ts` (un solo archivo, aunque no se traduzca, para tenerlos centralizados).

---

## 4. Animaciones (Motion)

Principios: duración 150–400 ms para UI, 500–900 ms para momentos importantes; easing spring para cosas físicas (cartas), ease-out para entradas. **Todo respeta `prefers-reduced-motion`** y el toggle de ajustes (fallback: fades de 150 ms).

| Momento | Animación |
|---|---|
| Entrada del tablero | Cartas aparecen en cascada diagonal (stagger 30 ms, de arriba-izq a abajo-der), con scale 0.8→1 y fade |
| Señalar carta | Avatar mini "cae" sobre la carta con spring y rebote leve |
| Revelar carta | **Flip 3D** en Y (rotateY 0→180°, 600 ms) mostrando el dorso con la ilustración del tipo. Durante 300 ms previos, leve "temblor" de suspenso (opcional, solo si hay más de 2 intentos posibles) |
| Revela agente propio | Glow del color del equipo + partículas pequeñas, contador de equipo baja con animación de número (rolling digits) |
| Revela civil | Flip + desaturación suave, sin fanfarria |
| Revela agente rival | Flip + leve shake de la carta + flash del color rival en el borde de pantalla |
| Revela traidor | Pantalla se oscurece (vignette), shake de pantalla 400 ms, la carta se agranda al centro, luego transición a fin de partida |
| Pista nueva | Texto de la pista entra con efecto "máquina de escribir" (40 ms/letra) + número con pop |
| Cambio de turno | Banner barre de lado a lado con el color del equipo ("TURNO AZUL"), 700 ms; fondo de la app hace crossfade a un tinte del color del equipo |
| Timer | Anillo que se vacía; últimos 10 s: pulsa en rojo y tick sonoro |
| Victoria | Confetti en colores del equipo (canvas-confetti, MIT), las cartas restantes se revelan en cascada mostrando el mapa completo |
| Lobby | Jugador que entra: slide-in; cambiar de equipo: layout animation (la tarjeta del jugador "viaja" de columna) |
| Botones | Press: scale 0.97; disabled: opacidad 0.5 sin hover |

Performance: animar solo `transform` y `opacity`. Objetivo: 60 fps en un celular de gama media. Nada de animaciones en bucle que consuman CPU en reposo.

---

## 5. Dirección de arte (original, $0)

### 5.1 Concepto visual
**Espionaje retro porteño de los 70**: archivos clasificados, papel de expediente, sellos de goma, tipografía de máquina de escribir, colores apagados con acentos saturados. Claramente distinto de la caja original (que es ilustración cómic con fondo rojo/azul dividido).

### 5.2 Paleta (tokens CSS)
```
--bg:            #1B1E24   (fondo oscuro tipo escritorio)
--paper:         #EFE6D2   (carta de palabra, papel)
--ink:           #22201C   (texto en cartas)
--red:           #D6453D
--red-soft:      #F2B8B2
--blue:          #2F6FB3
--blue-soft:     #B5CDE8
--civil:         #C9B994   (beige)
--traitor:       #111111   con acento #E8C547 (dorado)
--accent:        #E8C547
```
Modo claro opcional (M9). Contraste AA en todos los textos.

### 5.3 Tipografía (Google Fonts)
- Palabras de las cartas: **Oswald** o **Bebas Neue** (condensada, legible, en mayúsculas).
- Titulares/logo: **Special Elite** (máquina de escribir).
- UI general: **Inter**.

### 5.4 Cartas
- **Carta de palabra**: rectángulo papel con borde redondeado 10 px, textura sutil de papel (SVG noise inline, no imagen), palabra centrada en mayúsculas y una versión espejada chica arriba en gris (guiño al juego físico, ayuda a leerla desde "el otro lado" en modo mesa).
- **Dorso revelado** (SVG hechos en código, sin assets externos):
  - Agente rojo/azul: silueta de agente con sombrero/gabardina en flat, fondo del color, 4 variantes por equipo para que no sean todas iguales (cambia pose/accesorio).
  - Civil: silueta de transeúnte, 3 variantes (con paraguas, con diario, con mate).
  - Traidor: silueta en negro con ojos/lentes dorados y sello "TRAIDOR".
- Generación opcional de ilustraciones con IA gratis como base para luego vectorizar a mano; **nunca** con prompts que pidan el estilo de la caja original.

### 5.5 Avatares
12 avatares originales simples en SVG (agentes con distintos sombreros, bigotes, anteojos, colores de piel variados). Alternativa gratis: **DiceBear** (revisar licencia del estilo elegido; varios son CC0).

### 5.6 Modo daltónico (imprescindible)
El color **nunca** es la única señal:
- Rojo = ícono ▲ + patrón de rayas diagonales.
- Azul = ícono ● + patrón de puntos.
- Civil = ícono ■ liso.
- Traidor = ícono ✕ + fondo negro.
Activado: los íconos aparecen también en la vista de jefe y en el contador de equipos. Paleta alternativa naranja/azul en ese modo.

---

## 6. Sonido y música ($0)

### 6.1 Fuentes de audio libres
- **Kenney.nl** (CC0): UI clicks, flips de carta, fanfarrias.
- **Freesound.org** filtrando por **CC0**.
- **jsfxr / sfxr.me**: generar efectos retro propios.
- Música: **Pixabay Music** o **OpenGameArt** (verificar licencia de cada pista, preferir CC0/CC-BY con crédito en "Créditos").
- Guardar cada asset con su licencia en `apps/web/public/audio/LICENSES.md`.

### 6.2 Lista de efectos
| ID | Cuándo | Carácter |
|---|---|---|
| `ui_click` | botones | click seco, suave |
| `ui_hover` | hover en carta (desktop, opcional) | casi imperceptible |
| `join` | entra un jugador al lobby | campanita |
| `point` | señalar carta | "tap" de lápiz |
| `flip` | revelar | papel girando |
| `reveal_own` | agente propio | acorde corto positivo |
| `reveal_civil` | civil | nota neutra grave |
| `reveal_enemy` | agente rival | dos notas descendentes |
| `reveal_traitor` | traidor | golpe grave + reverb, silencio de música |
| `clue` | pista nueva | máquina de escribir + "ding" |
| `turn_change` | cambio de turno | swoosh |
| `your_turn` | te toca a vos (aunque tengas la pestaña de fondo) | aviso más notorio |
| `tick` | últimos 10 s del timer | tic-tac |
| `win` / `lose` | fin | fanfarria / trombón triste |
| `chat` | mensaje nuevo (solo si el chat está cerrado) | pop |

### 6.3 Música
- Loop de lobby: jazz/lounge espía tranquilo.
- Loop de partida: más bajo y tenso; sube levemente de intensidad cuando a un equipo le quedan ≤ 2 agentes (crossfade a otra capa).
- Música apagada por defecto en mobile; efectos encendidos.

### 6.4 Implementación
- Howler con **audio sprite** (un solo archivo `.webm` + `.mp3` fallback) para los efectos → una sola descarga.
- Canales: master / música / efectos, persistidos en `localStorage`.
- Desbloqueo de audio en el primer gesto del usuario (requisito de iOS/Chrome).
- Notificación de "te toca" también con `document.title` parpadeando ("⚠ ¡Te toca!") y vibración (`navigator.vibrate`) en celu.

---

## 7. Palabras

- Mazos en `packages/shared/words/*.json`: `{ id, name, description, words: string[] }`.
- **Mazo "Clásico"**: mínimo **400 palabras** propias, sustantivos concretos y polisémicos (que tengan más de un significado, eso es lo que hace bueno al juego): BANCO, GATO, CORTE, LLAVE, PLANTA, CARTA, MONO, PILA, SIERRA, ESTRELLA, PICO, BOMBA, etc.
- **Mazo "Argento"**: 200 palabras con cultura local: MATE, COLECTIVO, ASADO, BONDI, TANGO, ALFAJOR, PIBE, SUBTE, FERNET, CHORI, etc.
- Mazos opcionales: "Fútbol", "Videojuegos", "Facultad".
- Reglas de calidad de palabras: 1 sola palabra, 3–11 letras (para que entren en la carta), sin repetidas entre mazos (validado por un test), sin palabras ofensivas.
- **Palabras custom** del host: pegadas separadas por coma o salto de línea; se pueden mezclar con mazos ("50% custom").
- El generador evita repetir palabras de la partida anterior de la misma sala.

---

## 8. Tutorial y reglas

### 8.1 Tutorial interactivo (single player, sin server)
Corre 100% en el cliente usando el mismo motor de `shared`, con un tablero guionado y bots simples. Pasos:
1. "Este es el tablero: 25 palabras. Hay dos equipos." (resalta la grilla con spotlight)
2. "Vos sos **agente**. Tu jefe ve quién es quién; vos no."
3. Aparece una pista guionada: "**MAR · 2**". "¿Qué palabras se relacionan con el mar?" → el usuario elige; si acierta, feedback positivo; si no, explica por qué.
4. Muestra un civil: "Si tocás un civil, se termina el turno."
5. Muestra al traidor (sin perder): "Esta es la que nunca tenés que tocar."
6. Cambio de rol: "Ahora sos **jefe**." Ve el mapa clave y tiene que dar una pista para 2 palabras concretas; la UI le muestra en vivo si la pista es inválida.
7. Reglas de pistas: qué vale y qué no (ejemplos).
8. "¡Listo! Ya podés armar una sala."
- Saltable en cualquier paso; marca "tutorial completado" en `localStorage`.
- Primera vez que alguien entra a una sala sin tutorial: chip "¿Primera vez? Mirá el tutorial (2 min)".

### 8.2 Reglas
- Página `/reglas` con secciones colapsables: Objetivo, Roles, Turno, Pistas válidas, Ganar y perder, Configuración de sala, Atajos de teclado.
- Mini-ilustraciones de cada tipo de carta.
- Accesible como modal (`?` en la barra de partida) sin salir del juego.

### 8.3 Ayudas en partida
- Tooltips contextuales la primera vez que se ve cada cosa (primera pista, primer señalar, etc.), desactivables.
- Para jefes: contador "te quedan X agentes" y resaltado de las palabras propias no reveladas.

---

## 9. Historial, chat y social

- **Historial de pistas** por equipo: `PLAYA · 2 → ARENA ✓, SOL ✓`, `FRÍO · 1 → HIELO ✗ (civil)`. Clic en una entrada resalta esas cartas en el tablero.
- **Chat**: general y por equipo. **Los jefes no pueden escribir en el chat durante la partida** (solo emotes), para evitar pistas extra. El host puede desactivar el chat.
- **Emotes rápidos**: 🤔 😱 😂 👏 🙏 🔥 que aparecen flotando sobre el avatar. Rate limit 1 cada 2 s.
- **Fin de partida — stats**: duración, pistas por equipo, aciertos/errores, "mejor pista" (la que más agentes conectó), "pifia de la partida" (si alguien reveló el traidor o un rival).
- **Revancha**: mismos equipos, se **rotan los jefes** automáticamente (opción "mantener jefes").
- **Marcador de sala**: victorias acumuladas Rojo vs Azul en la sesión.

---

## 10. Calidad, accesibilidad y rendimiento

- Lighthouse en la landing: Performance ≥ 90, Accesibilidad ≥ 95.
- Bundle inicial < 250 KB gzip (lazy load del tutorial, reglas y audio).
- Navegable 100% con teclado; foco visible; `aria-live` para anunciar revelaciones y pistas a lectores de pantalla.
- Funciona en Chrome, Firefox, Safari (iOS incluido) y Edge, últimas 2 versiones.
- Manejo de errores: nunca un estado roto silencioso; toast con mensaje humano y log en consola.
- Logs del server con nivel (info/warn/error), sin datos personales.
- `ErrorBoundary` en React con pantalla "Algo se rompió. Volver a la sala" que reconecta.

### 10.1 Tests
- **Unit (Vitest)**: motor completo — cada regla de 1.4–1.6 con su test, incluidos bordes: revelar el último agente rival gana el rival; traidor en el primer intento; pista `∞`; timer vencido en fase pista (pasa turno sin pista); objeción aceptada/rechazada.
- **Anti-filtración**: test que juega una partida completa y verifica que ningún payload a un agente contiene tipos ocultos.
- **E2E (Playwright)**: 4 contextos de navegador simulando 4 jugadores: crear sala, unirse por link, armar equipos, jugar hasta ganar, revancha. Otro E2E: desconexión y reconexión del jefe con F5.

---

## 11. Estructura del repo

```
clave/
├─ apps/
│  ├─ web/                 Vite + React
│  │  ├─ src/
│  │  │  ├─ screens/       Landing, Lobby, Game, GameOver, Rules, Tutorial, Settings
│  │  │  ├─ components/    Card, Board, ClueInput, TeamPanel, ClueLog, Chat, Timer, Banner…
│  │  │  ├─ animations/    variants de Motion
│  │  │  ├─ audio/         sound manager (Howler)
│  │  │  ├─ store/         Zustand (conexión, sala, ajustes)
│  │  │  ├─ net/           cliente Socket.IO, reconexión, manejo de seq
│  │  │  ├─ art/           SVGs de cartas y avatares como componentes
│  │  │  └─ i18n/es-AR.ts
│  │  └─ public/audio/
│  └─ server/              Node + Socket.IO
│     └─ src/ rooms/, handlers/, views/ (toPublicView), index.ts
├─ packages/
│  └─ shared/
│     ├─ engine/           motor de reglas puro + tests
│     ├─ schemas/          Zod de eventos
│     ├─ types/
│     └─ words/            mazos JSON
├─ e2e/                    Playwright
├─ SPEC.md
└─ README.md
```

Variables de entorno: `VITE_SERVER_URL` (web), `CLIENT_ORIGIN` y `PORT` (server).

---

## 12. Hitos

### M0 — Base del monorepo
- pnpm workspaces, TS estricto, ESLint + Prettier, Vitest andando, scripts `dev` que levantan web y server juntos.
- **Acepta**: `pnpm dev` abre la web y se conecta al server (indicador "conectado").

### M1 — Motor de reglas
- Todo `packages/shared/engine` + mazo Clásico inicial (≥ 400 palabras) + validación de pistas.
- **Acepta**: tests de todas las reglas pasando, cobertura ≥ 95%, partida completa simulable por consola.

### M2 — Salas y lobby
- Crear/unirse por código y link, equipos, roles, configuración, host, kick, reconexión por token.
- **Acepta**: 4 pestañas arman equipos; F5 conserva lugar; cambiar equipo se ve en todas en < 200 ms local.

### M3 — Partida jugable (sin pulir)
- Tablero, vista jefe/agente filtrada desde el server, pista, señalar, revelar, pasar turno, victoria/derrota, historial.
- **Acepta**: partida completa entre 4 pestañas; test anti-filtración pasando.

### M4 — Arte y layout final
- Tokens, tipografías, cartas SVG con dorsos, avatares, layout desktop y mobile, modo daltónico.
- **Acepta**: se juega cómodo en celular (iPhone SE de ancho) y en desktop; ninguna palabra se corta.

### M5 — Animaciones
- Todo lo de la sección 4, con reduced motion.
- **Acepta**: 60 fps en el profiler en revelaciones; con reduced motion no hay flips ni shake.

### M6 — Sonido y música
- Sound manager, sprites, canales, ajustes, aviso de "te toca" en pestaña de fondo.
- **Acepta**: funciona en iOS Safari tras el primer toque; volúmenes persisten.

### M7 — Tutorial, reglas, social
- Tutorial interactivo, página de reglas, tooltips, chat con restricción para jefes, emotes, timers, objeciones, stats, revancha con rotación.
- **Acepta**: alguien que nunca jugó completa el tutorial y juega una partida sin preguntar nada.

### M8 — Deploy y endurecimiento
- Vercel + Render, `/health`, pantalla "Despertando a los agentes…", rate limits, CORS, Playwright E2E en CI (GitHub Actions free).
- **Acepta**: partida real con amigos desde distintas casas sin errores; server dormido despierta con la pantalla correcta.

### M9 — Extras (opcional, en este orden)
1. **Modo Cooperativo** (2–3 jugadores): todos contra el tablero, mapa clave de doble cara, 9 turnos, 3 traidores (inspirado en la variante para dos). Spec aparte antes de implementarlo.
2. **Modo mesa**: una pantalla grande (TV/notebook) muestra el tablero y cada jefe usa el celu como mapa clave — para jugar en persona.
3. Stats persistentes con Supabase free (historial por nickname).
4. Mazos de la comunidad (el host exporta/importa JSON).
5. PWA instalable.

---

## 13. Checklist "se siente profesional"
- [ ] Nunca hay una pantalla en blanco: todo tiene loading con estilo.
- [ ] Cada acción tiene feedback visual **y** sonoro en < 100 ms.
- [ ] Siempre queda claro de quién es el turno y qué tiene que hacer cada uno.
- [ ] Botones deshabilitados explican por qué.
- [ ] El juego aguanta F5, wifi que se corta y gente que se va.
- [ ] Es imposible ver el mapa clave siendo agente, ni con DevTools.
- [ ] Se juega bien con una mano en el celu.
- [ ] Daltónicos pueden jugar.
- [ ] Todo el copy suena argentino y natural.
- [ ] Hay créditos de los assets con sus licencias.
