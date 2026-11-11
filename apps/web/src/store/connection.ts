import { create } from 'zustand';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  /** The server turned the connection down (too many from this network) and won't be retried. */
  | 'refused';

interface ConnectionState {
  status: ConnectionStatus;
  /** Tries again by hand after a refusal; bound to the real socket by bindConnection. */
  retry: () => void;
}

export const useConnection = create<ConnectionState>()(() => ({
  status: 'connecting',
  retry: () => undefined,
}));

/** The slice of a socket.io-client Socket this store needs (keeps tests free of a real socket). */
export interface ConnectionSource {
  /** socket.io-client: true while the socket will keep trying to (re)connect on its own. */
  readonly active: boolean;
  on(event: 'connect' | 'disconnect' | 'connect_error', listener: (arg: unknown) => void): unknown;
  connect?(): unknown;
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
  // A middleware refusal (TOO_MANY_CONNECTIONS) leaves the client inactive: it won't retry on its
  // own, so say so instead of "Buscando a los agentes…" forever (SPEC §10, M8 review).
  socket.on('connect_error', () => {
    if (!socket.active) useConnection.setState({ status: 'refused' });
  });
  useConnection.setState({
    retry: () => {
      useConnection.setState({ status: 'connecting' });
      socket.connect?.();
    },
  });
}
