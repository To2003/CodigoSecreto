# Chequeos manuales pendientes

Criterios de aceptación (SPEC §12) o checks de CONSTRAINTS.md que no se pueden verificar en el contenedor donde trabaja el agente (sin dispositivos reales, sin cuentas, sin red confiable). Cada fila dice qué probar y cómo.

| Hito | Qué verificar                       | Cómo                                                                                                                                                                                             | Estado    |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| M0   | `pnpm dev` en tu Mint con Node 24   | `corepack enable && pnpm install && pnpm dev`, abrir http://localhost:5173 → "Conectado"                                                                                                         | pendiente |
| M2   | Lobby desde el celu en la misma red | Agregá la IP de tu compu a `CLIENT_ORIGIN` (ver `apps/server/.env.example`), corré la web con `pnpm --filter @clave/web dev -- --host` y `VITE_SERVER_URL=http://IP:3001`, y entrá desde el celu | pendiente |
