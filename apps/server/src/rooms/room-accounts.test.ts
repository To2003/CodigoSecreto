import { mulberry32, type Profile, type Team } from '@clave/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { Room, RoomError } from './room';

const profile = (nickname: string): Profile => ({ nickname, avatar: 0, color: 'oro' });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};
const seat = (i: number) => ({
  id: `p${String(i)}`,
  token: `token-${String(i)}-${'x'.repeat(20)}`,
});

let clock = 0;
let room: Room;
/** p1 (host, red spymaster, account u1), p2 (blue spymaster, u2), p3 red agent (u3), p4 guest. */
function ready(minGameMs = 300_000) {
  clock = 0;
  room = new Room('KTRX', 0, () => clock, minGameMs);
  room.join(profile('Ana'), 0, seat(1), 'u1');
  room.join(profile('Beto'), 0, seat(2), 'u2');
  room.join(profile('Caro'), 0, seat(3), 'u3');
  room.join(profile('Dani'), 0, seat(4));
  room.setRole('p1', 'spymaster');
  room.setRole('p2', 'spymaster');
}
const spymaster = (team: Team) => (team === 'red' ? 'p1' : 'p2');
const agent = (team: Team) => (team === 'red' ? 'p3' : 'p4');

/** Plays a game where the first team finds two agents with one clue, then hits the traitor. */
function playToTheEnd(atMs: number) {
  room.start('p1', mulberry32(3));
  const phase = room.game?.phase;
  if (!phase || phase.name === 'over') throw new Error('setup');
  const team = phase.team;
  room.act(spymaster(team), {
    type: 'GIVE_CLUE',
    playerId: spymaster(team),
    word: 'QXZ',
    count: 'inf',
  });
  for (const card of (room.game?.cards ?? []).filter((c) => c.type === team).slice(0, 2)) {
    room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: card.id });
  }
  clock = atMs;
  const traitor = room.game?.cards.find((c) => c.type === 'traitor');
  room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: traitor?.id ?? '' });
  return team;
}

describe('accounts in a room (docs/specs/M9-cuentas.md)', () => {
  beforeEach(() => {
    ready();
  });

  it('an account sits in one seat per room; a second tab plays as a guest', () => {
    room.join(profile('Ana bis'), 0, seat(5), 'u1');
    // Never in a view: the account id is server-only.
    expect(JSON.stringify(room.view('p1'))).not.toContain('u1');
    expect(room.players.find((p) => p.id === 'p5')?.userId).toBeUndefined();
    // A guest seat picks up the account of whoever reclaims it.
    room.rejoin('p4', seat(4).token, 0, 'u4');
    expect(room.players.find((p) => p.id === 'p4')?.userId).toBe('u4');
  });

  it('a long enough 4-player game yields results for signed-in starters only', () => {
    const team = playToTheEnd(300_000);
    const finished = room.takeFinishedGame();
    expect(room.takeFinishedGame()).toBeNull(); // only once
    const byUser = new Map(finished?.results.map((r) => [r.userId, r.result]));
    expect([...byUser.keys()].sort()).toEqual(['u1', 'u2', 'u3']);
    // The team that hit the traitor lost; its spymaster's clue connected 2 agents.
    expect(byUser.get(team === 'red' ? 'u1' : 'u2')).toEqual({
      won: false,
      role: 'spymaster',
      bestClue: { word: 'QXZ', hits: 2 },
    });
    expect(byUser.get(team === 'red' ? 'u2' : 'u1')).toMatchObject({ won: true, bestClue: null });
  });

  it('a short game yields nothing', () => {
    playToTheEnd(299_999);
    expect(room.takeFinishedGame()).toBeNull();
  });
});

describe('likes (spec §5)', () => {
  beforeEach(() => {
    ready();
  });

  it('never during the game', () => {
    room.start('p1', mulberry32(3));
    expect(code(() => room.like('p3', 'p2'))).toBe('LIKES_NOT_NOW');
    expect(room.view('p3').likes).toBeNull();
  });

  it('at the end: one per giver, not to yourself, only between players of that game', () => {
    playToTheEnd(300_000);
    room.join(profile('Eli'), clock, seat(5)); // joined after: a spectator
    expect(code(() => room.like('p3', 'p3'))).toBe('LIKE_NOT_ALLOWED');
    expect(code(() => room.like('p5', 'p1'))).toBe('LIKE_NOT_ALLOWED');
    expect(code(() => room.like('p3', 'p5'))).toBe('LIKE_NOT_ALLOWED');
    expect(room.like('p3', 'p2')).toEqual({
      receiverId: 'p2',
      received: 1,
      keep: { receiverUserId: 'u2', giverKey: 'u3' },
    });
    expect(code(() => room.like('p3', 'p1'))).toBe('ALREADY_LIKED');
    // A guest can give; likes to a guest are seen but not kept.
    expect(room.like('p4', 'p2')).toMatchObject({ received: 2, keep: { giverKey: 'guest' } });
    expect(room.like('p2', 'p4')).toMatchObject({ received: 1, keep: null });
    expect(room.view('p2').likes).toEqual({ given: true, received: 2 });
    expect(room.view('p1').likes).toEqual({ given: false, received: 0 });
    expect(room.view('p5').likes).toBeNull();
  });

  it('a game that doesn’t count shows likes but keeps none', () => {
    playToTheEnd(1_000);
    expect(room.like('p3', 'p2').keep).toBeNull();
  });

  it('never to another seat of the same account', () => {
    ready(0);
    room.players.forEach((p) => {
      if (p.id === 'p4') p.userId = 'u1';
    });
    playToTheEnd(1);
    expect(code(() => room.like('p1', 'p4'))).toBe('LIKE_NOT_ALLOWED');
  });
});
