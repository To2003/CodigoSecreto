# Spec — Modo Cooperativo (M9.1)

> SPEC §12 M9.1: "2–3 jugadores: todos contra el tablero, mapa clave de doble cara, 9 turnos, 3 traidores (inspirado en la variante para dos). Spec aparte antes de implementarlo." Este documento es esa spec. Las decisiones que el SPEC no fija se tomaron con el criterio más conservador (ver ADR-029) y están marcadas con **[decisión]**.

## 1. Idea

Todos juegan juntos contra el tablero. Hay **dos lados**, A y B. Cada lado tiene **su propio mapa clave** de las mismas 25 palabras: lo que para el lado A es un agente, para el lado B puede ser un civil o un traidor. Cada lado le da pistas al otro: el lado que da la pista mira su mapa y el otro adivina. Ganan si encuentran a **todos los agentes de los dos mapas** antes de que se terminen los **9 turnos**.

## 2. Jugadores

- 2 o 3 jugadores, cada uno en un lado. Con 3, un lado tiene a dos personas que comparten mapa y hablan entre ellas. **[decisión]** Con más de 3 el modo no arranca; el resto puede mirar como espectador.
- Los espectadores **nunca** ven ningún mapa en Cooperativo (la opción "espectadores ven mapa" no aplica): verlo y escribir en el chat ayudaría a hacer trampa a favor del equipo. **[decisión]**
- Los equipos Rojo/Azul de la sala se reusan como lados: Rojo = lado A, Azul = lado B. No hay rol de jefe: **todos ven el mapa de su lado** y adivinan con el mapa del otro.

## 3. El mapa de doble cara

25 cartas. Cada lado ve: **9 agentes, 3 traidores, 13 civiles**. Las caras se combinan así (el reparto se elige al azar en cada partida):

| Lado A \ Lado B | Agente | Traidor | Civil | Total A |
| --------------- | -----: | ------: | ----: | ------: |
| **Agente**      |      3 |       1 |     5 |       9 |
| **Traidor**     |      1 |       1 |     1 |       3 |
| **Civil**       |      5 |       1 |     7 |      13 |
| **Total B**     |      9 |       3 |    13 |      25 |

Agentes distintos para encontrar: 3 + 1 + 5 + 1 + 5 = **15**.

## 4. Turno

1. Arranca el lado A dando pista. **[decisión]** Después alternan (A, B, A, …). Si en el mapa de un lado ya no quedan agentes por encontrar, ese lado ya no da pistas: las da siempre el otro, que es el único que todavía tiene algo para señalar.
2. El lado que **da** la pista mira **su** mapa y dice una palabra y un número, con las mismas reglas de pistas que el modo clásico (§1.6). No hay objeciones en Cooperativo: no hay rival que objete. **[decisión]**
3. El otro lado **adivina** dando vuelta cartas, según el mapa **del que dio la pista**:
   - **Agente** (para el que dio la pista): queda encontrado y pueden seguir.
   - **Civil** (para el que dio la pista): se termina el turno. La carta queda marcada como "civil para A" (o para B), pero **puede ser un agente del otro mapa** y se puede seguir buscando ahí en un turno futuro, cuando el otro lado dé las pistas.
   - **Traidor** (para el que dio la pista): pierden en el acto.
   - Pueden parar cuando quieran después de la primera carta. Como en el clásico, pueden dar vuelta hasta `número + 1` cartas (sin límite con 0 o ∞); al llegar al tope termina el turno. (Antes decía "sin límite de intentos por número"; se corrigió por un bug reportado, ver ADR-034.)
4. Cada turno (pista + adivinanza) gasta **1 de los 9 turnos**, se acierte o no.

## 5. Fin de partida

- **Ganan** cuando están encontrados los 15 agentes.
- **Pierden** si alguien toca un traidor del mapa de quien dio la pista, o si se gastan los 9 turnos sin encontrar a todos. **[decisión]** Sin "muerte súbita" después del último turno: más simple y explícito.
- Al terminar se muestran los dos mapas completos a todos.

## 6. Qué ve cada uno (anti-trampa, SPEC §2.1)

- Un jugador del lado A recibe el tipo de cada carta **según el mapa A** y nada del mapa B, salvo lo que ya es público: cartas encontradas como agente, y marcas de "civil para A/B" que se generaron al adivinar.
- Los espectadores no reciben ningún tipo oculto hasta el final.
- El test anti-filtración se amplía con una partida cooperativa completa: ningún payload a A contiene un tipo del mapa B (y viceversa) para una carta que el que recibe todavía no puede saber.

## 7. Interfaz

- Lobby: "Modo: Cooperativo" deja de decir "(próximamente)". Con el modo elegido, los paneles se llaman "Lado A" y "Lado B" y no hay botón "Ser jefe". Bloqueos de inicio: "Faltan jugadores en el lado A/B" y "El cooperativo es para 2 o 3 jugadores".
- Partida: el contador de agentes es uno solo ("Faltan 15 agentes") y aparece un contador de turnos ("Quedan 9 turnos"). Cada jugador ve su mapa como lo ve un jefe en el clásico (tinte y banda de color). Las cartas "civil para el otro lado" llevan una marca pequeña con la letra del lado.
- Fin: "¡Misión cumplida! Encontraron a los 15 agentes." o "Se les terminaron los turnos." / "Tocaron a un traidor."
- Sin chat bloqueado: todos ven un mapa, así que la regla de "quien ve el mapa no escribe" haría el chat inútil. En Cooperativo el chat queda abierto, como en una mesa real donde se puede hablar pero no decir qué hay en el mapa. **[decisión]** Las reglas de la sala lo explican.

## 8. Fuera de alcance

- Campaña o niveles de dificultad (cantidad de turnos configurable).
- Más de 3 jugadores.
- Timers en Cooperativo: se ignoran en este modo en la primera versión. **[decisión]**

## 9. Criterio de aceptación

Dos personas juegan una partida cooperativa completa (ganada y perdida) en dos navegadores; el E2E lo cubre, y el anti-filtración muestra que ningún lado recibe el mapa del otro.
