# Backlog

Mejoras detectadas fuera del alcance del hito en curso. No se implementan sin OK; se revisan al planear cada hito.

| #   | Idea                                                                                                                                                                                                   | Detectada en | Por qué                                                                            | Hito sugerido              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------- | -------------------------- |
| 1   | Las reglas de hookify no cargan si el cwd del agente no es la raíz (glob relativo en el plugin). Reportarlo upstream o buscar alternativa (hooks propios en `.claude/settings.json` con ruta absoluta) | Review M0    | Hoy se mitiga con la regla de CLAUDE.md; los hooks de git siguen siendo la barrera | M8                         |
| 2   | Muestreo o rate limit de los logs de handshakes rechazados (origen controlado por el atacante)                                                                                                         | Review M0    | Evitar inundar logs en Render                                                      | M8 (junto con rate limits) |
