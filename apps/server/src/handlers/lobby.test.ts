import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  RoomPatch,
  RoomView,
  ServerToClientEvents,
} from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';

const ORIGIN = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ClaveServer;
let url: string;
let clock = 0;
const clients: Client[] = [];

beforeEach(async () => {
  clock = 1_000;
  server = createServer({ clientOrigins: [ORIGIN], log: silent, now: () => clock });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

/** A connected client that records the latest view and every patch. */
async function client() {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
    reconnection: false,
  });
  clients.push(socket);
  const seen = { view: null as RoomView | null, seq: -1, patches: [] as RoomPatch[] };
  socket.on('room:state', ({ seq, view }) => {
    seen.view = view;
    seen.seq = seq;
  });
  socket.on('room:patch', (patch) => {
    seen.patches.push(patch);
    seen.view = patch.view;
    seen.seq = patch.seq;
  });
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  return { socket, seen };
}

const profile = (nickname: string) => ({ nickname, avatar: 1, color: 'oro' as const });
const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe('room lifecycle over Socket.IO', () => {
  it('creates a room, joins by code and broadcasts team changes to everyone', async () => {
    const a = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error(created.error.code);
    expect(created.roomCode).toMatch(/^[A-HJKMNP-Z]{4}$/);
    await until(() => a.seen.view?.code === created.roomCode);

    const b = await client();
    const joined = await b.socket.emitWithAck('room:join', {
      ...profile('Beto'),
      roomCode: created.roomCode.toLowerCase(),
    });
    expect(joined.ok).toBe(true);
    await until(() => a.seen.view?.players.length === 2);

    const moved = await b.socket.emitWithAck('lobby:setTeam', { team: 'red' });
    expect(moved).toEqual({ ok: true });
    await until(() => a.seen.view?.players.find((p) => p.nickname === 'Beto')?.team === 'red');
    expect(a.seen.patches.at(-1)?.events).toEqual([
      {
        type: 'TEAM_CHANGED',
        playerId: joined.ok ? joined.playerId : '',
        team: 'red',
        role: 'agent',
      },
    ]);
  });

  it('answers errors with a code and a rioplatense message', async () => {
    const a = await client();
    expect(
      await a.socket.emitWithAck('room:join', { ...profile('Ana'), roomCode: 'ZZZZ' }),
    ).toEqual({
      ok: false,
      error: { code: 'ROOM_NOT_FOUND', message: 'No existe esa sala. Revisá el código.' },
    });
    expect(await a.socket.emitWithAck('lobby:setTeam', { team: 'red' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_IN_ROOM' },
    });
  });

  it('rejects payloads that fail Zod validation', async () => {
    const a = await client();
    const bad = { nickname: 'Ana', avatar: 99, color: 'oro' } as unknown as ReturnType<
      typeof profile
    >;
    expect(await a.socket.emitWithAck('room:create', bad)).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
  });

  it('keeps the seat on reconnect with the token (F5)', async () => {
    const a = await client();
    const b = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    const joined = await b.socket.emitWithAck('room:join', {
      ...profile('Beto'),
      roomCode: created.roomCode,
    });
    if (!joined.ok) throw new Error('join');
    await b.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });

    b.socket.disconnect();
    await until(
      () => a.seen.view?.players.find((p) => p.id === joined.playerId)?.connected === false,
    );

    const again = await client();
    const back = await again.socket.emitWithAck('room:join', {
      ...profile('Beto'),
      roomCode: created.roomCode,
      playerId: joined.playerId,
      token: joined.token,
    });
    expect(back).toMatchObject({ ok: true, playerId: joined.playerId });
    await until(() => again.seen.view?.youId === joined.playerId);
    expect(again.seen.view?.players.find((p) => p.id === joined.playerId)).toMatchObject({
      team: 'blue',
      role: 'spymaster',
      connected: true,
    });
  });

  it('gives a new seat when the token is wrong', async () => {
    const a = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    const b = await client();
    const res = await b.socket.emitWithAck('room:join', {
      ...profile('Intruso'),
      roomCode: created.roomCode,
      playerId: created.playerId,
      token: 'x'.repeat(32),
    });
    expect(res.ok && res.playerId).not.toBe(created.playerId);
  });

  it('releases a seat 60 s after a drop', async () => {
    const a = await client();
    const b = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    await b.socket.emitWithAck('room:join', { ...profile('Beto'), roomCode: created.roomCode });
    b.socket.disconnect();
    await until(() => a.seen.view?.players.some((p) => !p.connected) === true);
    clock += 60_000;
    server.sweep();
    await until(() => a.seen.view?.players.length === 1);
  });

  it('kicks a player (host only) and tells them', async () => {
    const a = await client();
    const b = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    const joined = await b.socket.emitWithAck('room:join', {
      ...profile('Beto'),
      roomCode: created.roomCode,
    });
    if (!joined.ok) throw new Error('join');
    let kicked = false;
    b.socket.on('room:kicked', () => {
      kicked = true;
    });
    expect(await b.socket.emitWithAck('lobby:kick', { playerId: created.playerId })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await a.socket.emitWithAck('lobby:kick', { playerId: joined.playerId })).toEqual({
      ok: true,
    });
    await until(() => kicked && a.seen.view?.players.length === 1);
    expect(await b.socket.emitWithAck('lobby:setTeam', { team: 'red' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_IN_ROOM' },
    });
  });

  it('host updates settings; the patch reaches others with an incremented seq', async () => {
    const a = await client();
    const b = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    await b.socket.emitWithAck('room:join', { ...profile('Beto'), roomCode: created.roomCode });
    await until(() => b.seen.seq >= 0);
    const before = b.seen.seq;
    expect(
      await a.socket.emitWithAck('lobby:updateSettings', { settings: { clueTimer: 90 } }),
    ).toEqual({
      ok: true,
    });
    await until(() => b.seen.view?.settings.clueTimer === 90);
    expect(b.seen.seq).toBe(before + 1);
  });

  it('leaving hands the host role over', async () => {
    const a = await client();
    const b = await client();
    const created = await a.socket.emitWithAck('room:create', profile('Ana'));
    if (!created.ok) throw new Error('create');
    const joined = await b.socket.emitWithAck('room:join', {
      ...profile('Beto'),
      roomCode: created.roomCode,
    });
    if (!joined.ok) throw new Error('join');
    expect(await a.socket.emitWithAck('room:leave', {})).toEqual({ ok: true });
    await until(() => b.seen.view?.hostId === joined.playerId);
  });

  it('rate-limits a flood of events', async () => {
    const a = await client();
    const results = await Promise.all(
      Array.from({ length: 30 }, () => a.socket.emitWithAck('lobby:setTeam', { team: 'red' })),
    );
    expect(results.filter((r) => !r.ok && r.error.code === 'RATE_LIMITED').length).toBeGreaterThan(
      0,
    );
  });
});
