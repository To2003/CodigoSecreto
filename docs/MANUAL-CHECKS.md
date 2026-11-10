# Chequeos manuales pendientes

Criterios de aceptación (SPEC §12) o checks de CONSTRAINTS.md que no se pueden verificar en el contenedor donde trabaja el agente (sin dispositivos reales, sin cuentas, sin red confiable). Cada fila dice qué probar y cómo.

| Hito | Qué verificar                     | Cómo                                                                                     | Estado    |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------- | --------- |
| M0   | `pnpm dev` en tu Mint con Node 24 | `corepack enable && pnpm install && pnpm dev`, abrir http://localhost:5173 → "Conectado" | pendiente |
