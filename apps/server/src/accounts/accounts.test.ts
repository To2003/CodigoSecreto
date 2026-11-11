import type { AddressInfo } from 'node:net';
import type {
  AccountView,
  ClientToServerEvents,
  RankingView,
  RoomView,
  ServerToClientEvents,
} from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';
import { MemoryAccountsRepo } from './memoryRepo';
import type { AccountsRepo } from './repo';

/** Accounts end to end over HTTP and Socket.IO, with the in-memory repo (no network). */
const ORIGIN = 'http://localhost:5173';
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ClaveServer;
let url: string;
const sockets: Client[] = [];
const errors: unknown[] = [];
const log = {
  info: () => undefined,
  warn: () => undefined,
  error: (...args: unknown[]) => errors.push(args),
};

async function start(repo: AccountsRepo | null, statsMinGameMs = 0) {
  errors.length = 0;
  server = createServer({ clientOrigins: [ORIGIN], log, accountsRepo: repo, statsMinGameMs });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
}

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
});

const api = async (path: string, init: RequestInit = {}, token?: string) => {
  const res = await fetch(`${url}/api${path}`, {
    ...init,
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body: unknown = await res.json();
  return { status: res.status, body };
};
const login = async (name: string) =>
  (
    (await api('/dev/login', { method: 'POST', body: JSON.stringify({ name }) })).body as {
      token: string;
    }
  ).token;

async function player(nickname: string, token?: string, roomCode?: string) {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
    reconnection: false,
    ...(token ? { auth: { token } } : {}),
  });
  sockets.push(socket);
  const seen = { view: null as RoomView | null, likes: [] as unknown[], all: [] as unknown[] };
  socket.onAny((_e, payload: unknown) => seen.all.push(payload));
  socket.on('room:state', ({ view }) => (seen.view = view));
  socket.on('room:patch', ({ view }) => (seen.view = view));
  socket.on('likes:received', (p) => seen.likes.push(p));
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  const profile = { nickname, avatar: 0, color: 'oro' as const };
  const res = roomCode
    ? await socket.emitWithAck('room:join', { ...profile, roomCode })
    : await socket.emitWithAck('room:create', profile);
  if (!res.ok) throw new Error(res.error.code);
  return { socket, seen, id: res.playerId, code: res.roomCode };
}
const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

/** Ana (account) and Caro red, Beto (account) and Dani blue; Ana and Beto spymasters. */
async function table(tokens: { ana?: string; beto?: string }) {
  const ana = await player('Ana', tokens.ana);
  const beto = await player('Beto', tokens.beto, ana.code);
  const caro = await player('Caro', undefined, ana.code);
  const dani = await player('Dani', undefined, ana.code);
  await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
  await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
  return { ana, beto, caro, dani };
}

/** Plays to a traitor reveal by the starting team; returns the losing team's agent. */
async function playToTheEnd(t: Awaited<ReturnType<typeof table>>) {
  await t.ana.socket.emitWithAck('game:start', {});
  await until(() => Boolean(t.ana.seen.view?.game));
  const phase = t.ana.seen.view?.game?.phase;
  if (!phase || phase.name === 'over') throw new Error('setup');
  const [sm, agent] = phase.team === 'red' ? [t.ana, t.caro] : [t.beto, t.dani];
  await sm.socket.emitWithAck('game:clue', { word: 'QXZ', count: 'inf' });
  const traitor = sm.seen.view?.game?.cards.find((c) => c.type === 'traitor');
  await until(() => agent.seen.view?.game?.phase.name === 'guess');
  // During the game a like would be a signal: refused.
  const early = await agent.socket.emitWithAck('like:give', { playerId: t.beto.id });
  expect(early).toMatchObject({ ok: false, error: { code: 'LIKES_NOT_NOW' } });
  await agent.socket.emitWithAck('game:reveal', { cardId: traitor?.id ?? '' });
  await until(() => t.ana.seen.view?.status === 'over');
  return agent;
}

describe('accounts over HTTP', () => {
  it('sign in, read your account, pick a name; never an email or an id', async () => {
    await start(new MemoryAccountsRepo());
    expect((await api('/me')).status).toBe(401);
    const token = await login('Ana');
    expect((await api('/me', {}, token)).body).toMatchObject({
      displayName: null,
      stats: { games: 0 },
    });
    const named = await api(
      '/me',
      { method: 'PUT', body: JSON.stringify({ displayName: '  <b>Ani</b> ' }) },
      token,
    );
    expect(named).toEqual({ status: 200, body: { displayName: 'bAni/b' } });
    expect(
      (await api('/me', { method: 'PUT', body: JSON.stringify({ displayName: ' ' }) }, token))
        .status,
    ).toBe(400);
    const me = await api('/me', {}, token);
    expect(JSON.stringify(me.body)).not.toMatch(/@|userId/);
    expect((await api('/ranking')).body).toEqual({ wins: [], loved: [] });
  });

  it('deleting the account forgets the token and the data', async () => {
    await start(new MemoryAccountsRepo());
    const token = await login('Ana');
    await api('/me', { method: 'PUT', body: JSON.stringify({ displayName: 'Ana' }) }, token);
    expect((await api('/me', { method: 'DELETE' }, token)).body).toEqual({ deleted: true });
    expect((await api('/me', {}, token)).status).toBe(401);
  });

  it('with accounts off the API answers 404 and there is no test sign-in', async () => {
    await start(null);
    expect((await api('/me')).status).toBe(404);
    expect((await api('/dev/login', { method: 'POST', body: '{"name":"x"}' })).status).toBe(404);
  });
});

describe('stats and likes over sockets', () => {
  it('a finished game is saved for signed-in players only; likes reach only the receiver', async () => {
    const repo = new MemoryAccountsRepo();
    await start(repo);
    const [anaToken, betoToken] = [await login('Ana'), await login('Beto')];
    const t = await table({ ana: anaToken, beto: betoToken });
    const agent = await playToTheEnd(t);

    await until(() => true);
    const ana = (await api('/me', {}, anaToken)).body as AccountView;
    const beto = (await api('/me', {}, betoToken)).body as AccountView;
    expect(ana.stats.games).toBe(1);
    expect(beto.stats.games).toBe(1);
    expect(ana.stats.wins + beto.stats.wins).toBe(1);

    // Likes at the end: Caro (guest) likes Beto; only Beto hears about it, as a bare count.
    expect(await t.caro.socket.emitWithAck('like:give', { playerId: t.beto.id })).toEqual({
      ok: true,
    });
    await until(() => t.beto.seen.likes.length === 1);
    expect(t.beto.seen.likes).toEqual([{ count: 1 }]);
    for (const p of [t.ana, t.caro, t.dani]) expect(p.seen.likes).toEqual([]);
    const again = await t.caro.socket.emitWithAck('like:give', { playerId: t.ana.id });
    expect(again).toMatchObject({ ok: false, error: { code: 'ALREADY_LIKED' } });
    const self = await agent.socket.emitWithAck('like:give', { playerId: agent.id });
    expect(self).toMatchObject({ ok: false, error: { code: 'LIKE_NOT_ALLOWED' } });
    await until(() => true);
    expect(((await api('/me', {}, betoToken)).body as AccountView).stats.likesReceived).toBe(1);
    // A reload shows the same, through the view: given / received for that viewer only.
    expect(t.caro.seen.view?.likes).toEqual({ given: false, received: 0 });
  });

  it('a short game counts for nothing; a bad token just plays as a guest', async () => {
    const repo = new MemoryAccountsRepo();
    await start(repo, 600_000);
    const anaToken = await login('Ana');
    const t = await table({ ana: anaToken, beto: 'not-a-token' });
    await playToTheEnd(t);
    expect(((await api('/me', {}, anaToken)).body as AccountView).stats.games).toBe(0);
  });

  it('if saving fails the game goes on, and the log has no token or id', async () => {
    const repo = new MemoryAccountsRepo();
    repo.recordGame = () => Promise.reject(new Error('supabase down'));
    await start(repo);
    const anaToken = await login('Ana');
    const t = await table({ ana: anaToken });
    await playToTheEnd(t);
    await until(() => errors.length > 0);
    expect(JSON.stringify(errors)).toContain('recordGame');
    expect(JSON.stringify(errors)).not.toContain(anaToken);
    expect(t.ana.seen.view?.status).toBe('over');
  });

  it('the ranking lists named players with 10+ games, without ids', async () => {
    const repo = new MemoryAccountsRepo();
    await start(repo);
    const token = await login('Ana');
    await api('/me', { method: 'PUT', body: JSON.stringify({ displayName: 'Ana' }) }, token);
    const userId = repo.devLogin('Ana').userId;
    for (let i = 0; i < 10; i++)
      await repo.recordGame(userId, { won: i < 7, role: 'agent', bestClue: null });
    const ranking = (await api('/ranking', {}, token)).body as RankingView;
    expect(ranking.wins).toEqual([{ displayName: 'Ana', games: 10, wins: 7, me: true }]);
    expect(JSON.stringify(ranking)).not.toContain(userId);
    expect(((await api('/ranking')).body as RankingView).wins[0]?.me).toBe(false);
  });
});
