import { DEFAULT_SETTINGS, mulberry32, type Profile } from '@clave/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { Room, RoomError, type RoomPlayer } from './room';

const profile = (nickname: string): Profile => ({ nickname, avatar: 0, color: 'oro' });

let room: Room;
let ids = 0;
const join = (nickname: string, now = 0) =>
  room.join(profile(nickname), now, { id: `p${++ids}`, token: `token-${ids}-${'x'.repeat(20)}` });
const get = (id: string): RoomPlayer => {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

/** Four players: p1 (host) and p3 red, p2 and p4 blue, auto-balanced. */
function fourPlayers() {
  const players = ['Ana', 'Beto', 'Caro', 'Dani'].map((n) => join(n).player);
  return players.map((p) => p.id);
}

beforeEach(() => {
  room = new Room('KTRX', 0);
  ids = 0;
});

describe('join', () => {
  it('makes the first player host and balances teams as agents', () => {
    const [a, b, c] = ['Ana', 'Beto', 'Caro'].map((n) => join(n).player);
    expect(room.hostId).toBe(a?.id);
    expect([a?.team, b?.team, c?.team]).toEqual(['red', 'blue', 'red']);
    expect(a?.role).toBe('agent');
  });

  it('sanitizes the nickname and rejects an empty one', () => {
    expect(join('  <b>Ana</b>  ').player.nickname).toBe('bAna/b');
    expect(code(() => join(' <> '))).toBe('INVALID_NICKNAME');
  });

  it('refuses a 17th player (SPEC §2.3)', () => {
    for (let i = 0; i < 16; i++) join(`J${i}`);
    expect(code(() => join('Extra'))).toBe('ROOM_FULL');
  });

  it('emits PLAYER_JOINED', () => {
    expect(join('Ana').events).toEqual([{ type: 'PLAYER_JOINED', playerId: 'p1' }]);
  });
});

describe('rejoin (reconnection by token, SPEC §2.4)', () => {
  it('returns the same player with team and role when the token matches', () => {
    const [a] = fourPlayers();
    room.setRole(a ?? '', 'spymaster');
    room.setConnected(a ?? '', false, 1000);
    const back = room.rejoin(a ?? '', `token-1-${'x'.repeat(20)}`, 2000);
    expect(back.player).toMatchObject({ id: a, team: 'red', role: 'spymaster', connected: true });
    expect(back.events).toEqual([{ type: 'PLAYER_CONNECTION', playerId: a, connected: true }]);
  });

  it.each([
    ['a wrong token', 'p1', 'nope-nope-nope-nope'],
    ['an unknown player', 'p99', `token-1-${'x'.repeat(20)}`],
  ])('fails with %s', (_label, id, token) => {
    fourPlayers();
    expect(code(() => room.rejoin(id, token, 0))).toBe('PLAYER_NOT_FOUND');
  });
});

describe('teams and roles', () => {
  it('moves a player to another team as agent', () => {
    const [a] = fourPlayers();
    expect(room.setTeam(a ?? '', 'blue')).toEqual([
      { type: 'TEAM_CHANGED', playerId: a, team: 'blue', role: 'agent' },
    ]);
    expect(get(a ?? '')).toMatchObject({ team: 'blue', role: 'agent' });
  });

  it('lets one spymaster per team', () => {
    const [a, , c] = fourPlayers();
    room.setRole(a ?? '', 'spymaster');
    expect(code(() => room.setRole(c ?? '', 'spymaster'))).toBe('SPYMASTER_TAKEN');
    room.setRole(a ?? '', 'agent');
    room.setRole(c ?? '', 'spymaster');
    expect(get(c ?? '').role).toBe('spymaster');
  });

  it('a spectator cannot be spymaster', () => {
    const [a] = fourPlayers();
    room.setTeam(a ?? '', 'spectator');
    expect(code(() => room.setRole(a ?? '', 'spymaster'))).toBe('BAD_REQUEST');
  });

  it('only changes teams in the lobby', () => {
    const [a] = fourPlayers();
    room.status = 'playing';
    expect(code(() => room.setTeam(a ?? '', 'blue'))).toBe('LOBBY_ONLY');
    expect(code(() => room.setRole(a ?? '', 'spymaster'))).toBe('LOBBY_ONLY');
  });

  it('randomize (host): balanced teams with one spymaster each, spectators stay', () => {
    const [a, , , d] = fourPlayers();
    join('Eli');
    room.setTeam(d ?? '', 'spectator');
    room.randomize(a ?? '', mulberry32(3));
    const red = room.players.filter((p) => p.team === 'red');
    const blue = room.players.filter((p) => p.team === 'blue');
    expect(Math.abs(red.length - blue.length)).toBeLessThanOrEqual(1);
    expect(red.filter((p) => p.role === 'spymaster')).toHaveLength(1);
    expect(blue.filter((p) => p.role === 'spymaster')).toHaveLength(1);
    expect(get(d ?? '').team).toBe('spectator');
    expect(code(() => room.randomize('p2', mulberry32(1)))).toBe('NOT_HOST');
  });
});

describe('settings', () => {
  it('host merges a patch without resetting other options', () => {
    const [a] = fourPlayers();
    room.updateSettings(a ?? '', { clueTimer: 60 });
    room.updateSettings(a ?? '', { objections: false });
    expect(room.settings).toEqual({ ...DEFAULT_SETTINGS, clueTimer: 60, objections: false });
  });

  it('only the host, only in the lobby', () => {
    const [a, b] = fourPlayers();
    expect(code(() => room.updateSettings(b ?? '', { chat: false }))).toBe('NOT_HOST');
    room.status = 'playing';
    expect(code(() => room.updateSettings(a ?? '', { chat: false }))).toBe('LOBBY_ONLY');
  });
});

describe('kick', () => {
  it('host removes a player and their token stops working', () => {
    const [a, b] = fourPlayers();
    expect(room.kick(a ?? '', b ?? '')).toEqual([{ type: 'PLAYER_KICKED', playerId: b }]);
    expect(room.players.map((p) => p.id)).not.toContain(b);
    expect(code(() => room.rejoin(b ?? '', `token-2-${'x'.repeat(20)}`, 0))).toBe(
      'PLAYER_NOT_FOUND',
    );
  });

  it('refuses non-hosts, self-kicks and unknown players', () => {
    const [a, b] = fourPlayers();
    expect(code(() => room.kick(b ?? '', a ?? ''))).toBe('NOT_HOST');
    expect(code(() => room.kick(a ?? '', a ?? ''))).toBe('CANNOT_KICK_SELF');
    expect(code(() => room.kick(a ?? '', 'ghost'))).toBe('PLAYER_NOT_FOUND');
  });
});

describe('leaving and host handover', () => {
  it('passes host to the oldest connected player when the host leaves', () => {
    const [a, b, c] = fourPlayers();
    room.setConnected(b ?? '', false, 0);
    expect(room.leave(a ?? '', 0)).toEqual([
      { type: 'PLAYER_LEFT', playerId: a },
      { type: 'HOST_CHANGED', playerId: c },
    ]);
    expect(room.hostId).toBe(c);
  });

  it('falls back to the oldest player when nobody is connected', () => {
    const [a, b] = fourPlayers();
    for (const p of room.players) room.setConnected(p.id, false, 0);
    room.leave(a ?? '', 0);
    expect(room.hostId).toBe(b);
  });

  it('removes players disconnected for 60 s (lobby only)', () => {
    const [, b] = fourPlayers();
    room.setConnected(b ?? '', false, 1_000);
    expect(room.expireDisconnected(60_999)).toEqual([]);
    expect(room.expireDisconnected(61_000)).toEqual([{ type: 'PLAYER_LEFT', playerId: b }]);
    room.status = 'playing';
    const [c] = room.players.filter((p) => p.id !== 'p1').map((p) => p.id);
    room.setConnected(c ?? '', false, 0);
    expect(room.expireDisconnected(1_000_000)).toEqual([]);
  });

  it('knows how long it has been empty', () => {
    expect(room.emptySince).toBe(0); // empty since creation
    const [a] = fourPlayers();
    expect(room.emptySince).toBeNull();
    for (const p of room.players) room.setConnected(p.id, false, 5_000);
    expect(room.emptySince).toBe(5_000);
    room.setConnected(a ?? '', true, 6_000);
    expect(room.emptySince).toBeNull();
  });
});

describe('startBlockers (SPEC §3.1)', () => {
  it('lists what is missing per team', () => {
    join('Ana'); // red agent
    expect(room.startBlockers()).toEqual([
      { code: 'NO_SPYMASTER', team: 'red' },
      { code: 'NO_SPYMASTER', team: 'blue' },
      { code: 'NO_AGENT', team: 'blue' },
    ]);
  });

  it('is empty when both teams have a spymaster and an agent', () => {
    const [a, b] = fourPlayers();
    room.setRole(a ?? '', 'spymaster');
    room.setRole(b ?? '', 'spymaster');
    expect(room.startBlockers()).toEqual([]);
  });

  it('flags a disconnected spymaster and teams without a connected agent (M3 review M4)', () => {
    const [a, b, c] = fourPlayers();
    room.setRole(a ?? '', 'spymaster');
    room.setRole(b ?? '', 'spymaster');
    room.setConnected(a ?? '', false, 0);
    room.setConnected(c ?? '', false, 0);
    expect(room.startBlockers()).toEqual([
      { code: 'SPYMASTER_AWAY', team: 'red' },
      { code: 'NO_AGENT', team: 'red' },
    ]);
  });

  it('flags missing words and a cooperative room with too many players', () => {
    const [a, b] = fourPlayers();
    room.setRole(a ?? '', 'spymaster');
    room.setRole(b ?? '', 'spymaster');
    room.updateSettings(a ?? '', { deckIds: [], customWords: ['UNO', 'DOS'], mode: 'coop' });
    expect(room.startBlockers()).toEqual([{ code: 'COOP_PLAYERS' }, { code: 'NOT_ENOUGH_WORDS' }]);
  });
});

describe('view', () => {
  it('shows public player data and never tokens', () => {
    const [a] = fourPlayers();
    const view = room.view(a ?? '');
    expect(view).toMatchObject({ code: 'KTRX', youId: a, hostId: a, status: 'lobby' });
    expect(view.players[0]).toEqual({
      id: 'p1',
      nickname: 'Ana',
      avatar: 0,
      color: 'oro',
      team: 'red',
      role: 'agent',
      connected: true,
    });
    expect(JSON.stringify(view)).not.toContain('token');
  });
});
