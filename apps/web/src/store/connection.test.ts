import { beforeEach, describe, expect, it } from 'vitest';
import { bindConnection, useConnection, type ConnectionSource } from './connection';

/** Minimal stand-in for a socket.io-client Socket: only the events bindConnection listens to. */
function fakeSocket() {
  const handlers = new Map<string, () => void>();
  const source: ConnectionSource = {
    on: (event, fn) => {
      handlers.set(event, fn);
    },
  };
  return {
    source,
    emit: (event: string) => handlers.get(event)?.(),
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

    socket.emit('connect');
    expect(useConnection.getState().status).toBe('connected');

    socket.emit('disconnect');
    expect(useConnection.getState().status).toBe('reconnecting');

    socket.emit('connect_error');
    expect(useConnection.getState().status).toBe('reconnecting');

    socket.emit('connect');
    expect(useConnection.getState().status).toBe('connected');
  });

  it('stays connecting while the first attempt fails', () => {
    const socket = fakeSocket();
    bindConnection(socket.source);

    socket.emit('connect_error');
    expect(useConnection.getState().status).toBe('connecting');
  });
});
