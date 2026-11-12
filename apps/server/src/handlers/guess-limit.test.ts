import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, RoomView, ServerToClientEvents } from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';

/**
 * ADR-034: the `count + 1` guess limit is the server's, not the buttons'. A client that keeps
 * sending `game:reveal` past the limit is refused and the board doesn't change.
 */
const ORIGIN = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ClaveServer;
let url: string;
const sockets: Client[] = [];

beforeEach(async () => {
  server = createServer({ clientOrigins: [ORIGIN], log: silent });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
});

async function player(nickname: string, roomCode?: string) {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
    reconnection: false,
  });
  sockets.push(socket);
  const seen: { view: RoomView | null } = { view: null };
  socket.on('room:state', ({ view }) => {
    seen.view = view;
  });
  socket.on('room:patch', (patch) => {
    seen.view = patch.view;
  });
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  const profile = { nickname, avatar: 0, color: 'oro' as const };
  const res = roomCode
    ? await socket.emitWithAck('room:join', { ...profile, roomCode })
    : await socket.emitWithAck('room:create', profile);
  if (!res.ok) throw new Error(res.error.code);
  return { socket, seen, code: res.roomCode };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe('guess limit over sockets (ADR-034)', () => {
  it('classic: clue 1 allows two reveals; the third game:reveal is refused', async () => {
    const ana = await player('Ana');
    const beto = await player('Beto', ana.code);
    const caro = await player('Caro', ana.code);
    const dani = await player('Dani', ana.code);
    await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await ana.socket.emitWithAck('game:start', {});
    await until(() => Boolean(ana.seen.view?.game));
    const phase = ana.seen.view?.game?.phase;
    if (!phase || phase.name === 'over') throw new Error('setup');
    const [giver, guesser] = phase.team === 'red' ? [ana, caro] : [beto, dani];
    await giver.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
    await until(() => guesser.seen.view?.game?.phase.name === 'guess');
    expect(guesser.seen.view?.game?.phase).toMatchObject({ guessesLeft: 2 });
    // The spymaster's view knows the colours: the guesser keeps hitting their own agents.
    const own = () =>
      giver.seen.view?.game?.cards.find((c) => c.type === phase.team && !c.revealed)?.id ?? '';
    for (let i = 0; i < 2; i++) {
      const target = own();
      expect(await guesser.socket.emitWithAck('game:reveal', { cardId: target })).toEqual({
        ok: true,
      });
      await until(() =>
        Boolean(giver.seen.view?.game?.cards.find((c) => c.id === target)?.revealed),
      );
    }
    expect(guesser.seen.view?.game?.phase).toMatchObject({ name: 'clue' });
    const third = await guesser.socket.emitWithAck('game:reveal', { cardId: own() });
    expect(third).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
  });

  it('cooperative: clue 1 allows two reveals; the third game:reveal is refused', async () => {
    const ana = await player('Ana');
    const beto = await player('Beto', ana.code);
    await ana.socket.emitWithAck('lobby:updateSettings', { settings: { mode: 'coop' } });
    expect(await ana.socket.emitWithAck('game:start', {})).toEqual({ ok: true });
    await until(() => Boolean(ana.seen.view?.coop));
    await ana.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
    await until(() => beto.seen.view?.coop?.phase.name === 'guess');
    expect(beto.seen.view?.coop?.phase).toMatchObject({ guessesLeft: 2 });
    // Ana's view has her own map: Beto keeps hitting her agents.
    const agent = () =>
      ana.seen.view?.coop?.cards.find((c) => c.key === 'agent' && !c.found)?.id ?? '';
    for (let i = 0; i < 2; i++) {
      const target = agent();
      expect(await beto.socket.emitWithAck('game:reveal', { cardId: target })).toEqual({
        ok: true,
      });
      await until(() => Boolean(ana.seen.view?.coop?.cards.find((c) => c.id === target)?.found));
    }
    expect(beto.seen.view?.coop?.phase).toEqual({ name: 'clue', giver: 'blue' });
    const third = await beto.socket.emitWithAck('game:reveal', { cardId: agent() });
    expect(third).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
  });
});
