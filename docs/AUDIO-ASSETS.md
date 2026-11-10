# Assets de audio reales (para reemplazar la síntesis)

Hoy el juego genera cada sonido con Web Audio (ADR-025). Funciona y no pesa nada, pero suena "a sintetizador". Esta es la lista para cambiarlo por audio real, sin tocar el resto del código: la interfaz `audio.play(id)` / `audio.setMusic(track)` queda igual.

## Fuentes (todas gratis, sin tarjeta)

- **Kenney.nl** (CC0): packs "Interface Sounds", "Impact Sounds", "Casino Audio" (cartas), "Music Jingles".
- **Freesound.org** filtrando por licencia **CC0**.
- **sfxr.me / jsfxr**: para generar efectos retro propios.
- Música: **Pixabay Music** u **OpenGameArt** (CC0 o CC-BY con crédito en "Créditos").

## Lista (SPEC §6.2)

| ID               | Qué buscar                               | Sugerencia de búsqueda                               |
| ---------------- | ---------------------------------------- | ---------------------------------------------------- |
| `ui_click`       | click seco y suave                       | Kenney Interface Sounds: `click_*`                   |
| `ui_hover`       | casi imperceptible (opcional)            | Kenney Interface Sounds: `tick_*` (muy bajo)         |
| `join`           | campanita                                | Freesound CC0: "small bell ding"                     |
| `point`          | tap de lápiz                             | Freesound CC0: "pencil tap"                          |
| `flip`           | papel girando                            | Kenney Casino Audio: `card-slide-*` / `card-place-*` |
| `reveal_own`     | acorde corto positivo                    | Kenney Music Jingles: `jingles_STEEL_*` corto        |
| `reveal_civil`   | nota neutra grave                        | Freesound CC0: "soft low piano note"                 |
| `reveal_enemy`   | dos notas descendentes                   | Kenney Music Jingles: un jingle "fail" corto         |
| `reveal_traitor` | golpe grave con reverb                   | Freesound CC0: "cinematic boom"                      |
| `clue`           | máquina de escribir + "ding"             | Freesound CC0: "typewriter bell"                     |
| `turn_change`    | swoosh                                   | Kenney Impact Sounds o Freesound CC0 "whoosh"        |
| `your_turn`      | aviso más notorio                        | Kenney Interface Sounds: `confirmation_*`            |
| `tick`           | tic-tac                                  | Freesound CC0: "clock tick"                          |
| `win`            | fanfarria                                | Kenney Music Jingles: `jingles_HIT_*` / "victory"    |
| `lose`           | trombón triste                           | Freesound CC0: "sad trombone"                        |
| `chat`           | pop                                      | Kenney Interface Sounds: `pop_*`                     |
| Música lobby     | jazz/lounge espía tranquilo, loop        | Pixabay Music: "spy jazz", "noir lounge"             |
| Música partida   | más bajo y tenso, loop + capa de tensión | Pixabay Music: "suspense noir", dos stems si hay     |

## Cómo integrarlos (SPEC §6.4)

1. Normalizar volúmenes (−16 LUFS aprox.) y recortar silencios.
2. Armar **un solo sprite** de efectos (`apps/web/public/audio/sfx.webm` + `sfx.mp3` de respaldo) con `audiosprite` y guardar el mapa de offsets.
3. Agregar Howler (`pnpm --filter @clave/web add howler`) y reimplementar `play(id)` con el sprite; `setMusic` con dos `Howl` en loop y crossfade para la capa de tensión.
4. Anotar cada archivo en `apps/web/public/audio/LICENSES.md`.
