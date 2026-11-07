import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

/** Single app-wide socket. Created idle; main.tsx binds the store and then connects. */
export const socket = io(SERVER_URL, { autoConnect: false });
