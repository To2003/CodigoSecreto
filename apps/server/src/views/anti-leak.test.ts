import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  PublicCard,
  RoomView,
  ServerToClientEvents,
  Team,
} from '@clave/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from '../app';

/**
 * SPEC §2.1 golden rule, tested end to end: a full game is played over real sockets and EVERY
 * payload an agent or a spectator receives is inspected. Run this after any change to views,
 * payloads, events or serialization (CLAUDE.md).
 */
const ORIGIN = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Player {
  name: string;
  socket: Client;
  view: () => RoomView | null;
  payloads: unknown[];
  id: string;
}

let server: ClaveServer;
let url: string;
const players: Player[] = [];

async function join(
  name: string,
  roomCode?: string,
  seat?: { playerId: string; token: string },
): Promise<Player & { token: string }> {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    extraHeaders: { origin: ORIGIN },
  });
  const payloads: unknown[] = [];
  let latest: RoomView | null = null;
  socket.onAny((_event, payload: unknown) => {
    payloads.push(payload);
  });
  socket.on('room:state', ({ view }) => {
    latest = view;
  });
  socket.on('room:patch', ({ view }) => {
    latest = view;
  });
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  const profile = { nickname: name, avatar: 0, color: 'oro' as const };
  const res = roomCode
    ? await socket.emitWithAck('room:join', { ...profile, roomCode, ...(seat ?? {}) })
    : await socket.emitWithAck('room:create', profile);
  if (!res.ok) throw new Error(res.error.code);
  const player = { name, socket, view: () => latest, payloads, id: res.playerId, token: res.token };
  players.push(player);
  return player;
}

const settle = () => new Promise((r) => setTimeout(r, 30));
const CARD_TYPES = new Set(['red', 'blue', 'civilian', 'traitor']);

/** Walks a payload and reports any card type attached to an unrevealed card id. */
function leaks(payload: unknown, hidden: Set<string>, path = '$'): string[] {
  if (Array.isArray(payload)) return payload.flatMap((v, i) => leaks(v, hidden, `${path}[${i}]`));
  if (typeof payload !== 'object' || payload === null) return [];
  const o = payload as Record<string, unknown>;
  const found: string[] = [];
  const refersToHidden =
    (typeof o.id === 'string' && hidden.has(o.id)) ||
    (typeof o.cardId === 'string' && hidden.has(o.cardId));
  // Events use `type` as their discriminant ("CARD_POINTED"); only a card type value is a leak.
  const carriesCardType = CARD_TYPES.has(String(o.type)) || 'cardType' in o;
  if (refersToHidden && carriesCardType) found.push(path);
  for (const key of ['keyMap', 'types', 'seed']) if (key in o) found.push(`${path}.${key}`);
  for (const [k, v] of Object.entries(o)) {
    // A lookup keyed by a hidden card id holding a card type: { [cardId]: 'red' }.
    if (hidden.has(k) && CARD_TYPES.has(String(v))) found.push(`${path}.${k}`);
    // A parallel array of types: ['red', 'civilian', …].
    if (Array.isArray(v) && v.filter((x) => CARD_TYPES.has(String(x))).length >= 5) {
      found.push(`${path}.${k}[]`);
    }
    found.push(...leaks(v, hidden, `${path}.${k}`));
  }
  return found;
}

function hiddenCards(payload: unknown): PublicCard[] | null {
  const view = (payload as { view?: RoomView } | null)?.view;
  return view?.game?.cards.filter((c) => !c.revealed) ?? null;
}

beforeAll(async () => {
  server = createServer({ clientOrigins: [ORIGIN], log: silent });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const p of players) p.socket.disconnect();
  await server.close();
});

describe('anti-leak (SPEC §2.1)', () => {
  it('no agent or spectator payload ever carries the type of an unrevealed card', async () => {
    // Ana host. Auto-balance: Ana, Caro red; Beto, Dani blue. Eli joins and watches.
    const ana = await join('Ana');
    const code = ana.view()?.code ?? '';
    const beto = await join('Beto', code);
    const caro = await join('Caro', code);
    const dani = await join('Dani', code);
    const eli = await join('Eli', code);
    await eli.socket.emitWithAck('lobby:setTeam', { team: 'spectator' });
    await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    const started = await ana.socket.emitWithAck('game:start', {});
    expect(started).toEqual({ ok: true });
    await settle();

    const spymaster: Record<Team, Player> = { red: ana, blue: beto };
    const agent: Record<Team, Player> = { red: caro, blue: dani };

    // Sanity: spymasters do see the map, so the filter is doing something.
    expect(ana.view()?.game?.cards.every((c) => c.type !== undefined)).toBe(true);
    expect(caro.view()?.game?.cards.some((c) => c.type !== undefined)).toBe(false);

    // Play until someone wins: each turn the agent reveals cards, mixing own agents with
    // civilians and rival agents so every kind of reveal and turn change shows up.
    for (let turn = 0; turn < 40; turn++) {
      const game = ana.view()?.game;
      if (!game || game.phase.name === 'over') break;
      const team = game.phase.team;
      const clue = await spymaster[team].socket.emitWithAck('game:clue', {
        word: 'QXZ',
        count: 'inf',
      });
      expect(clue).toEqual({ ok: true });
      await settle();
      const map = spymaster[team].view()?.game?.cards ?? [];
      const own = map.filter((c) => !c.revealed && c.type === team);
      const wrong = map.find(
        (c) => !c.revealed && (c.type === 'civilian' || (c.type !== team && c.type !== 'traitor')),
      );
      const picks = turn % 3 === 2 && wrong ? [wrong] : own.slice(0, 2);
      for (const card of picks) {
        await agent[team].socket.emitWithAck('game:point', { cardId: card.id });
        await agent[team].socket.emitWithAck('game:reveal', { cardId: card.id });
      }
      await settle();
      const after = ana.view()?.game;
      if (after?.phase.name === 'guess') {
        await agent[team].socket.emitWithAck('game:endGuessing', {});
        await settle();
      }
    }
    expect(ana.view()?.game?.phase.name).toBe('over');

    for (const watcher of [caro, dani, eli]) {
      let inspected = 0;
      for (const payload of watcher.payloads) {
        const hidden = hiddenCards(payload);
        if (!hidden) continue;
        inspected += 1;
        const view = (payload as { view: RoomView }).view;
        if (view.game?.phase.name === 'over') continue; // the full map is public at the end
        expect(leaks(payload, new Set(hidden.map((c) => c.id))), watcher.name).toEqual([]);
        const traitorHidden =
          hidden.length > 0 && !view.game?.cards.some((c) => c.type === 'traitor');
        if (traitorHidden) expect(JSON.stringify(payload)).not.toContain('traitor');
      }
      expect(inspected).toBeGreaterThan(10);
    }
  });

  /**
   * The cases M3 added (review I6): a spectator joining mid-game, an agent's F5 (room:state in the
   * middle of a game), a spymaster replaced during a pause (benched, then back), the end of the
   * game and a rematch with rotated spymasters. Each payload is checked against what that viewer
   * may see at that moment, derived from the roles in the payload itself.
   */
  it('stays sealed through mid-game joins, F5, spymaster replacement and a rematch', async () => {
    const names = ['Ana', 'Beto', 'Caro', 'Dani', 'Gabi', 'Hugo'];
    const ana = await join('Ana');
    const code = ana.view()?.code ?? '';
    const others = [];
    for (const n of names.slice(1)) others.push(await join(n, code));
    const [beto, caro, dani, gabi, hugo] = others;
    if (!beto || !caro || !dani || !gabi || !hugo) throw new Error('setup');
    // Auto-balance: red Ana, Caro, Gabi · blue Beto, Dani, Hugo.
    await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    expect(await ana.socket.emitWithAck('game:start', {})).toEqual({ ok: true });
    await settle();

    const late = await join('Ivo', code); // joins mid-game: watches, never sees the map

    // F5 of an agent: a fresh socket reclaims the seat and gets room:state mid-game.
    caro.socket.disconnect();
    const caro2 = await join('Caro', code, { playerId: caro.id, token: caro.token });
    expect(caro2.id).toBe(caro.id);

    // Make blue the active team, then blue's spymaster drops and the host replaces him with Dani.
    let game = ana.view()?.game;
    if (game?.phase.name !== 'over' && game?.phase.team === 'red') {
      await ana.socket.emitWithAck('game:clue', { word: 'QXZ', count: 1 });
      await settle();
      const civilian = ana.view()?.game?.cards.find((c) => !c.revealed && c.type === 'civilian');
      await gabi.socket.emitWithAck('game:reveal', { cardId: civilian?.id ?? '' });
      await settle();
    }
    beto.socket.disconnect();
    await settle();
    expect(ana.view()?.game?.paused).toMatchObject({ team: 'blue', reason: 'spymaster' });
    expect(await ana.socket.emitWithAck('game:setSpymaster', { playerId: dani.id })).toEqual({
      ok: true,
    });
    const beto2 = await join('Beto', code, { playerId: beto.id, token: beto.token });
    await settle();
    expect(beto2.view()?.game?.seesMap).toBe(false);

    // Play to the end, then a rematch and one more turn.
    const spymasterOf = (team: Team) =>
      [ana, beto2, caro2, dani, gabi, hugo].find((p) =>
        p.view()?.players.some((x) => x.id === p.id && x.team === team && x.role === 'spymaster'),
      );
    const agentOf = (team: Team) =>
      [ana, caro2, dani, gabi, hugo].find((p) =>
        p.view()?.players.some((x) => x.id === p.id && x.team === team && x.role === 'agent'),
      );
    const playTurn = async () => {
      game = ana.view()?.game;
      if (!game || game.phase.name === 'over') return;
      const team = game.phase.team;
      const giver = spymasterOf(team);
      await giver?.socket.emitWithAck('game:clue', { word: 'QXZ', count: 'inf' });
      await settle();
      const own = (giver?.view()?.game?.cards ?? []).filter((c) => !c.revealed && c.type === team);
      for (const card of own.slice(0, 3)) {
        await agentOf(team)?.socket.emitWithAck('game:reveal', { cardId: card.id });
      }
      await settle();
      if (ana.view()?.game?.phase.name === 'guess') {
        await agentOf(team)?.socket.emitWithAck('game:endGuessing', {});
        await settle();
      }
    };
    for (let i = 0; i < 20 && ana.view()?.game?.phase.name !== 'over'; i++) await playTurn();
    expect(ana.view()?.game?.phase.name).toBe('over');
    expect(await ana.socket.emitWithAck('game:rematch', { keepSpymasters: false })).toEqual({
      ok: true,
    });
    await settle();
    await playTurn();

    for (const watcher of [caro, caro2, dani, gabi, hugo, beto2, late]) {
      let inspected = 0;
      for (const payload of watcher.payloads) {
        const view = (payload as { view?: RoomView } | null)?.view;
        const hidden = hiddenCards(payload);
        if (!view?.game || !hidden) continue;
        const me = view.players.find((p) => p.id === view.youId);
        const mayKnow =
          view.game.phase.name === 'over' || (me?.team !== 'spectator' && me?.role === 'spymaster');
        if (mayKnow) continue;
        inspected += 1;
        expect(view.game.seesMap, watcher.name).toBe(false);
        expect(leaks(payload, new Set(hidden.map((c) => c.id))), watcher.name).toEqual([]);
        if (!view.game.cards.some((c) => c.type === 'traitor')) {
          expect(JSON.stringify(payload), watcher.name).not.toContain('traitor');
        }
      }
      expect(inspected, watcher.name).toBeGreaterThan(0);
    }
  });

  it('with "spectators see the map": only spectators from the start see it', async () => {
    const ana = await join('Ana');
    const code = ana.view()?.code ?? '';
    const beto = await join('Beto', code);
    const caro = await join('Caro', code);
    const dani = await join('Dani', code);
    const eli = await join('Eli', code);
    await eli.socket.emitWithAck('lobby:setTeam', { team: 'spectator' });
    await ana.socket.emitWithAck('lobby:updateSettings', { settings: { spectatorsSeeMap: true } });
    await ana.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await beto.socket.emitWithAck('lobby:setRole', { role: 'spymaster' });
    await ana.socket.emitWithAck('game:start', {});
    const late = await join('Ivo', code);
    await settle();
    expect(eli.view()?.game?.cards.filter((c) => c.type !== undefined)).toHaveLength(25);
    for (const p of [caro, dani, late]) {
      expect(p.view()?.game?.seesMap, p.name).toBe(false);
      const hidden = p.view()?.game?.cards.filter((c) => !c.revealed) ?? [];
      expect(leaks({ view: p.view() }, new Set(hidden.map((c) => c.id))), p.name).toEqual([]);
    }
  });
});
