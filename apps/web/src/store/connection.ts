import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
}

export const useConnection = create<ConnectionState>()(() => ({ status: 'connecting' }));

/** The slice of a socket.io-client Socket this store needs (keeps tests free of a real socket). */
export interface ConnectionSource {
  on(event: 'connect' | 'disconnect', listener: () => void): unknown;
}

/**
 * Mirrors the socket's lifecycle into the store. Failed attempts don't change the status:
 * before the first connect it stays "connecting", after a drop it stays "reconnecting".
 */
export function bindConnection(socket: ConnectionSource): void {
  socket.on('connect', () => {
    useConnection.setState({ status: 'connected' });
  });
  socket.on('disconnect', () => {
    useConnection.setState({ status: 'reconnecting' });
  });
}
