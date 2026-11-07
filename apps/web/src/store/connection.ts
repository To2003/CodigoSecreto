import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
}

export const useConnection = create<ConnectionState>()(() => ({ status: 'connecting' }));

/** The slice of a socket.io-client Socket this store needs (keeps tests free of a real socket). */
export interface ConnectionSource {
  /** socket.io-client: true while the socket will keep trying to (re)connect on its own. */
  readonly active: boolean;
  on(event: 'connect' | 'disconnect', listener: (reason: string) => void): unknown;
}

/**
 * Mirrors the socket's lifecycle into the store. Failed attempts don't change the status:
 * before the first connect it stays "connecting", after a drop it stays "reconnecting".
 * A disconnect the client won't recover from by itself (server-side disconnect, e.g. a kick)
 * becomes "disconnected" so the UI never shows a reconnect that isn't happening (SPEC §10).
 */
export function bindConnection(socket: ConnectionSource): void {
  socket.on('connect', () => {
    useConnection.setState({ status: 'connected' });
  });
  socket.on('disconnect', () => {
    useConnection.setState({ status: socket.active ? 'reconnecting' : 'disconnected' });
  });
}
