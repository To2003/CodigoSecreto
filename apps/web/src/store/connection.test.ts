import { beforeEach, describe, expect, it } from 'vitest';
import { bindConnection, useConnection, type ConnectionSource } from './connection';

/**
 * Stand-in for a socket.io-client Socket. `active` mirrors the real flag: true while the client
 * will keep reconnecting, false after `io server disconnect` / `io client disconnect`.
 */
function fakeSocket() {
  const handlers = new Map<string, (reason: string) => void>();
  let active = true;
  const source: ConnectionSource = {
    get active() {
      return active;
    },
    on: (event, fn) => {
      handlers.set(event, fn);
    },
  };
  return {
    source,
    connect: () => {
      active = true;
      handlers.get('connect')?.('');
    },
    disconnect: (reason: string, stillActive: boolean) => {
      active = stillActive;
      handlers.get('disconnect')?.(reason);
    },
  };
}

describe('connection store', () => {
  beforeEach(() => {
    useConnection.setState({ status: 'connecting' });
  });

  it('starts as connecting', () => {
    expect(useConnection.getState().status).toBe('connecting');
  });

  it('follows the socket through connect, drop and reconnect', () => {
    const socket = fakeSocket();
    bindConnection(socket.source);

    socket.connect();
    expect(useConnection.getState().status).toBe('connected');

    socket.disconnect('transport close', true);
    expect(useConnection.getState().status).toBe('reconnecting');

    socket.connect();
    expect(useConnection.getState().status).toBe('connected');
  });

  it('reports disconnected when the client will not reconnect on its own', () => {
    const socket = fakeSocket();
    bindConnection(socket.source);
    socket.connect();

    socket.disconnect('io server disconnect', false);
    expect(useConnection.getState().status).toBe('disconnected');
  });
});
