import type { AddressInfo } from 'node:net';
import type {
  ChatMessage,
  ClientToServerEvents,
  EmoteEvent,
  RoomPatch,
  RoomView,
  ServerToClientEvents,
} from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';

/** M7 over real sockets: timers that run out, objections, chat and emotes. */
const ORIGIN = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ClaveServer;
let url: string;
let clock = 0;
const sockets: Client[] = [];

beforeEach(async () => {
  clock = 1_000;
  server = createServer({ clientOrigins: [ORIGIN], log: silent, now: () => clock });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
});

interface Seen {
  view: RoomView | null;
  patches: RoomPatch[];
  chat: ChatMessage[];
  history: ChatMessage[] | null;
  emotes: EmoteEvent[];
}

async function player(nickname: string, roomCode?: string) {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
    reconnection: false,
  });
  sockets.push(socket);
  const seen: Seen = { view: null, patches: [], chat: [], history: null, emotes: [] };
  socket.on('room:state', ({ view }) => {
    seen.view = view;
  });
  socket.on('room:patch', (patch) => {
    seen.patches.push(patch);
    seen.view = patch.view;
  });
  socket.on('chat:message', (m) => seen.chat.push(m));
  socket.on('chat:history', (h) => {
    seen.history = h;
  });
  socket.on('emote', (e) => seen.emotes.push(e));
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

/** Ana and Caro red, Beto and Dani blue; Ana and Beto spymasters. */
async function table() {
  const ana = await player('Ana');
  const beto = await player('Beto', ana.code);
  const caro = await player('Caro', ana.code);
  const dani = await player('Dani', ana.code);
  await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
  await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
  return { ana, beto, caro, dani };
}

describe('timers over sockets', () => {
  it('the clue timer runs out on the server and everyone gets the turn change', async () => {
    const { ana, caro } = await table();
    await ana.socket.emitWithAck('lobby:updateSettings', { settings: { clueTimer: 60 } });
    await ana.socket.emitWithAck('game:start', {});
    await until(() => caro.seen.view?.game?.timer?.kind === 'clue');
    const first = caro.seen.view?.game?.phase;
    if (!first || first.name === 'over') throw new Error('setup');
    clock += 90_000; // 60 s + 30 s first-turn bonus
    server.tick();
    await until(() =>
      caro.seen.patches.some((p) => p.events.some((e) => e.type === 'TURN_CHANGED')),
    );
    const change = caro.seen.patches.at(-1)?.events[0];
    expect(change).toMatchObject({ type: 'TURN_CHANGED', reason: 'timeout' });
  });
});

describe('objections over sockets', () => {
  it('the rival spymaster objects, the room votes and the penalty lands', async () => {
    const { ana, beto, caro, dani } = await table();
    await ana.socket.emitWithAck('game:start', {});
    await until(() => ana.seen.view?.game !== null && ana.seen.view?.game !== undefined);
    const phase = ana.seen.view?.game?.phase;
    if (!phase || phase.name === 'over') throw new Error('setup');
    const [giver, rival] = phase.team === 'red' ? [ana, beto] : [beto, ana];
    await giver.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
    expect(await rival.socket.emitWithAck('game:object', {})).toEqual({ ok: true });
    await until(() => caro.seen.view?.game?.phase.name === 'objection');
    // Three voters and objecting counts as a yes: one more yes is a majority and closes it early.
    const twice = await rival.socket.emitWithAck('game:vote', { accept: true });
    expect(twice).toMatchObject({ ok: false, error: { code: 'ALREADY_VOTED' } });
    expect(await caro.socket.emitWithAck('game:vote', { accept: true })).toEqual({ ok: true });
    const late = await dani.socket.emitWithAck('game:vote', { accept: true });
    expect(late).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
    await until(() => caro.seen.view?.game?.clues[0]?.objection === 'accepted');
    const resolved = caro.seen.patches.flatMap((p) => p.events);
    expect(resolved).toContainEqual({ type: 'OBJECTION_RESOLVED', accepted: true });
    expect(resolved.some((e) => e.type === 'CARD_REVEALED' && e.penalty)).toBe(true);
  });

  it('only the rival spymaster may object', async () => {
    const { ana, beto, caro } = await table();
    await ana.socket.emitWithAck('game:start', {});
    await until(() => Boolean(ana.seen.view?.game));
    const phase = ana.seen.view?.game?.phase;
    if (!phase || phase.name === 'over') throw new Error('setup');
    const giver = phase.team === 'red' ? ana : beto;
    await giver.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
    const res = await caro.socket.emitWithAck('game:object', {});
    expect(res.ok).toBe(false);
  });
});

describe('chat and emotes over sockets', () => {
  it('team lines stay in the team; history comes on (re)join', async () => {
    const { ana, beto, caro, dani } = await table();
    expect(
      await caro.socket.emitWithAck('chat:send', { text: 'solo rojo', scope: 'team' }),
    ).toEqual({
      ok: true,
    });
    clock += 1_000;
    expect(
      await dani.socket.emitWithAck('chat:send', { text: 'para todos', scope: 'all' }),
    ).toEqual({
      ok: true,
    });
    await until(() => beto.seen.chat.length === 1 && ana.seen.chat.length === 2);
    expect(beto.seen.chat.map((m) => m.text)).toEqual(['para todos']);
    expect(ana.seen.chat.map((m) => m.text)).toEqual(['solo rojo', 'para todos']);

    const eli = await player('Eli', ana.code);
    await until(() => eli.seen.history !== null);
    // Eli joins later and lands on red: public lines yes, red's earlier team line no.
    expect(eli.seen.history?.map((m) => m.text)).toEqual(['para todos']);
  });

  it('refuses chat payloads that fail validation and spymasters in game', async () => {
    const { ana, beto } = await table();
    const bad = await ana.socket.emitWithAck('chat:send', {
      text: 'x',
      scope: 'everyone',
    } as never);
    expect(bad).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
    await ana.socket.emitWithAck('game:start', {});
    const muted = await beto.socket.emitWithAck('chat:send', { text: 'hola', scope: 'all' });
    expect(muted).toMatchObject({ ok: false, error: { code: 'CHAT_NOT_ALLOWED' } });
  });

  it('emotes reach the whole room, at most one every 2 s', async () => {
    const { ana, beto, caro } = await table();
    expect(await beto.socket.emitWithAck('emote:send', { emoteId: 'fire' })).toEqual({ ok: true });
    await until(() => ana.seen.emotes.length === 1 && caro.seen.emotes.length === 1);
    expect(ana.seen.emotes[0]).toEqual({ playerId: beto.id, emoteId: 'fire' });
    const again = await beto.socket.emitWithAck('emote:send', { emoteId: 'clap' });
    expect(again).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    const unknown = await beto.socket.emitWithAck('emote:send', { emoteId: 'poop' } as never);
    expect(unknown).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
  });

  it('refuses a spymaster’s emote while their team guesses, and nobody gets it (ADR-032)', async () => {
    const { ana, beto, caro, dani } = await table();
    await ana.socket.emitWithAck('game:start', {});
    await until(() => Boolean(ana.seen.view?.game));
    const phase = ana.seen.view?.game?.phase;
    if (!phase || phase.name === 'over') throw new Error('setup');
    const [giver, rival] = phase.team === 'red' ? [ana, beto] : [beto, ana];
    // Giving the clue, the spymaster may still emote.
    expect(await giver.socket.emitWithAck('emote:send', { emoteId: 'thinking' })).toEqual({
      ok: true,
    });
    clock += 5_000;
    await giver.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
    await until(() => caro.seen.view?.game?.phase.name === 'guess');
    const refused = await giver.socket.emitWithAck('emote:send', { emoteId: 'fire' });
    expect(refused).toMatchObject({ ok: false, error: { code: 'EMOTE_NOT_NOW' } });
    expect(giver.seen.view?.emotesMuted).toBe(true);
    // The rival spymaster isn't signalling to anyone useful: allowed.
    expect(await rival.socket.emitWithAck('emote:send', { emoteId: 'clap' })).toEqual({ ok: true });
    await until(() => caro.seen.emotes.length === 2 && dani.seen.emotes.length === 2);
    for (const p of [caro, dani]) {
      expect(p.seen.emotes.map((e) => e.emoteId)).toEqual(['thinking', 'clap']);
    }
  });
});
