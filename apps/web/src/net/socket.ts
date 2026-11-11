import type { ClientToServerEvents, ServerToClientEvents } from '@clave/shared';
import { io, type Socket } from 'socket.io-client';

const DEV_SERVER_URL = 'http://localhost:3001';
// An empty VITE_SERVER_URL counts as unset: io('') would connect to the page's own origin.
const configured = import.meta.env.VITE_SERVER_URL?.trim() ?? '';
// Production builds can't reach this fallback: vite.config.ts refuses to build without the variable.
export const SERVER_URL = configured === '' ? DEV_SERVER_URL : configured;

/** Single app-wide socket. Created idle; main.tsx binds the store and then connects. */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: false,
});
