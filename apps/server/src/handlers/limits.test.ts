import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, ServerToClientEvents } from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';

/** M8 (BACKLOG #4): limits per IP, over real sockets. Every test client comes from 127.0.0.1. */
const ORIGIN = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ClaveServer;
let url: string;
let clock = 0;
const sockets: Client[] = [];

beforeEach(async () => {
  clock = 1_000;
  server = createServer({
    clientOrigins: [ORIGIN],
    log: silent,
    now: () => clock,
    ipLimits: { socketsPerIp: 3, roomsPerWindow: 2, failedJoinsPerWindow: 3, windowMs: 60_000 },
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
});

/** Resolves with the socket once connected, or with the refusal message. */
function open(headers: Record<string, string> = {}) {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN, ...headers },
    reconnection: false,
  });
  sockets.push(socket);
  return new Promise<{ socket: Client; refused: string | null }>((resolve) => {
    socket.on('connect', () => {
      resolve({ socket, refused: null });
    });
    socket.on('connect_error', (err) => {
      resolve({ socket, refused: err.message });
    });
  });
}

const profile = { nickname: 'Ana', avatar: 0, color: 'oro' as const };

describe('per-IP limits', () => {
  it('refuses a socket past the per-IP cap and lets one in when another closes', async () => {
    const first = await open();
    await open();
    await open();
    expect((await open()).refused).toBe('TOO_MANY_CONNECTIONS');
    first.socket.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect((await open()).refused).toBeNull();
  });

  it('caps rooms created per window', async () => {
    const { socket } = await open();
    expect((await socket.emitWithAck('room:create', profile)).ok).toBe(true);
    expect((await socket.emitWithAck('room:create', profile)).ok).toBe(true);
    const third = await socket.emitWithAck('room:create', profile);
    expect(third).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    clock += 60_000;
    expect((await socket.emitWithAck('room:create', profile)).ok).toBe(true);
  });

  it('stops sweeping room codes: after 3 misses even a real code is refused', async () => {
    const host = await open();
    const created = await host.socket.emitWithAck('room:create', profile);
    if (!created.ok) throw new Error('setup');
    const sweeper = await open();
    for (const code of ['AAAA', 'BBBB', 'CCCC']) {
      const miss = await sweeper.socket.emitWithAck('room:join', { ...profile, roomCode: code });
      expect(miss).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
    }
    const hit = await sweeper.socket.emitWithAck('room:join', {
      ...profile,
      roomCode: created.roomCode,
    });
    expect(hit).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  });

  it('ignores a forged X-Forwarded-For when no proxy is trusted', async () => {
    // Without TRUST_PROXY_HOPS, rotating fake addresses doesn't buy new sockets.
    await open({ 'x-forwarded-for': '1.1.1.1' });
    await open({ 'x-forwarded-for': '2.2.2.2' });
    await open({ 'x-forwarded-for': '3.3.3.3' });
    expect((await open({ 'x-forwarded-for': '4.4.4.4' })).refused).toBe('TOO_MANY_CONNECTIONS');
  });
});
