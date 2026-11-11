import { mulberry32, type Profile } from '@clave/shared';
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

let room: Room;
/** Cooperative room: p1 (host) on side A (red), p2 on side B (blue). */
beforeEach(() => {
  room = new Room('KTRX', 0);
  room.join(profile('Ana'), 0, { id: 'p1', token: `token-1-${'x'.repeat(20)}` });
  room.join(profile('Beto'), 0, { id: 'p2', token: `token-2-${'x'.repeat(20)}` });
  room.updateSettings('p1', { mode: 'coop' });
});

const clue = (by: string) =>
  room.act(by, { type: 'GIVE_CLUE', playerId: by, word: 'QXZ', count: 'inf' });

describe('cooperative mode in a room (M9.1)', () => {
  it('starts with 2–3 players and both sides covered; no spymasters needed', () => {
    expect(room.startBlockers()).toEqual([]);
    room.setTeam('p2', 'red');
    expect(room.startBlockers()).toEqual([{ code: 'COOP_PLAYERS' }]);
    expect(code(() => room.start('p1', mulberry32(1)))).toBe('CANNOT_START');
    room.setTeam('p2', 'blue');
    for (const [i, n] of ['Caro', 'Dani'].entries()) {
      room.join(profile(n), 0, {
        id: `p${String(i + 3)}`,
        token: `token-${String(i + 3)}-${'x'.repeat(20)}`,
      });
    }
    expect(room.startBlockers()).toEqual([{ code: 'COOP_PLAYERS' }]);
    room.setTeam('p4', 'spectator');
    expect(room.startBlockers()).toEqual([]);
  });

  it('each player sees only their side; the classic game stays empty', () => {
    room.start('p1', mulberry32(1));
    expect(room.status).toBe('playing');
    const a = room.view('p1');
    expect(a.game).toBeNull();
    expect(a.coop?.side).toBe('red');
    expect(a.coop?.cards.every((c) => c.key !== undefined && c.keys === undefined)).toBe(true);
    expect(room.view('p2').coop?.side).toBe('blue');
    expect(a.coop?.turnsLeft).toBe(9);
    expect(a.chatMuted).toBe(false);
  });

  it('clues and reveals go through the cooperative engine', () => {
    room.start('p1', mulberry32(1));
    expect(code(() => clue('p2'))).toBe('NOT_YOUR_TURN');
    expect(clue('p1')).toEqual([{ type: 'COOP_CLUE', giver: 'red', word: 'QXZ', count: 'inf' }]);
    const agent = room.coop?.cards.find((c) => c.key.red === 'agent');
    if (!agent) throw new Error('setup');
    const events = room.act('p2', { type: 'REVEAL_CARD', playerId: 'p2', cardId: agent.id });
    expect(events).toEqual([
      { type: 'COOP_GUESS', giver: 'red', cardId: agent.id, result: 'agent' },
    ]);
    expect(
      code(() => room.act('p2', { type: 'POINT_CARD', playerId: 'p2', cardId: agent.id })),
    ).toBe('WRONG_PHASE');
    expect(
      code(() => room.act('p1', { type: 'GIVE_CLUE', playerId: 'p2', word: 'X', count: 1 })),
    ).toBe('BAD_REQUEST');
  });

  it('ends on a traitor; rematch and back to lobby work', () => {
    room.start('p1', mulberry32(1));
    clue('p1');
    const traitor = room.coop?.cards.find((c) => c.key.red === 'traitor');
    if (!traitor) throw new Error('setup');
    room.act('p2', { type: 'REVEAL_CARD', playerId: 'p2', cardId: traitor.id });
    expect(room.status).toBe('over');
    expect(room.view('p1').coop?.cards.every((c) => c.keys !== undefined)).toBe(true);
    expect(room.view('p1').coop?.phase).toEqual({ name: 'over', won: false, reason: 'traitor' });
    expect(code(() => room.rematch('p2', false))).toBe('NOT_HOST');
    const before = room.coop?.cards.map((c) => c.word).join();
    room.rematch('p1', false);
    expect(room.status).toBe('playing');
    expect(room.coop?.cards.map((c) => c.word).join()).not.toBe(before);
    room.backToLobby('p1');
    expect(room.status).toBe('lobby');
    expect(room.view('p1').coop).toBeNull();
  });

  it('rematch is refused while the game is still on', () => {
    room.start('p1', mulberry32(1));
    expect(code(() => room.rematch('p1', false))).toBe('GAME_IN_PROGRESS');
  });
});
