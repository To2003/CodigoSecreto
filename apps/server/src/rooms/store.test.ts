import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './codes';
import { EMPTY_ROOM_TTL_MS, RoomStore } from './store';

const profile = { nickname: 'Ana', avatar: 0, color: 'oro' as const };

describe('generateRoomCode', () => {
  it('builds 4 unambiguous letters and skips codes in use', () => {
    const seen: string[] = [];
    const code = generateRoomCode((c) => {
      seen.push(c);
      return seen.length < 3;
    });
    expect(seen).toHaveLength(3);
    expect(code).toMatch(/^[A-HJKMNP-Z]{4}$/);
  });
});

describe('RoomStore', () => {
  it('creates rooms with unique codes and finds them', () => {
    const codes = ['AAAA', 'AAAA', 'BBBB'];
    const store = new RoomStore((taken) => {
      for (;;) {
        const c = codes.shift() ?? 'ZZZZ';
        if (!taken(c)) return c;
      }
    });
    const a = store.create(0);
    const b = store.create(0);
    expect([a.code, b.code]).toEqual(['AAAA', 'BBBB']);
    expect(store.get('BBBB')).toBe(b);
    expect(store.size).toBe(2);
    store.delete('AAAA');
    expect(store.get('AAAA')).toBeUndefined();
  });

  it('sweeps a room 30 minutes after nobody is connected, even with no seats left', () => {
    const store = new RoomStore();
    const ghost = store.create(0); // nobody ever joined
    const room = store.create(0);
    const { player } = room.join(profile, 0, { id: 'p1', token: 't'.repeat(32) });
    room.setConnected(player.id, false, 1_000);
    store.sweep(EMPTY_ROOM_TTL_MS - 1);
    expect(store.get(ghost.code)).toBe(ghost);
    expect(room.players).toHaveLength(0); // the seat expired after 60 s
    store.sweep(EMPTY_ROOM_TTL_MS);
    expect(store.get(ghost.code)).toBeUndefined();
    expect(store.get(room.code)).toBe(room);
    store.sweep(1_000 + EMPTY_ROOM_TTL_MS);
    expect(store.size).toBe(0);
  });

  it('reports rooms where seats expired', () => {
    const store = new RoomStore();
    const room = store.create(0);
    room.join(profile, 0, { id: 'p1', token: 't'.repeat(32) });
    room.join({ ...profile, nickname: 'Beto' }, 0, { id: 'p2', token: 'u'.repeat(32) });
    room.setConnected('p2', false, 0);
    expect(store.sweep(60_000)).toEqual([
      { room, events: [{ type: 'PLAYER_LEFT', playerId: 'p2' }] },
    ]);
  });
});

describe('tick', () => {
  it('one broken room does not stop the timers of the others', () => {
    const store = new RoomStore(undefined, () => 0);
    const broken = store.create(0);
    const fine = store.create(0);
    broken.tick = () => {
      throw new Error('boom');
    };
    let ticked = false;
    fine.tick = () => {
      ticked = true;
      return [];
    };
    const errors: string[] = [];
    store.tick((room) => errors.push(room.code));
    expect(errors).toEqual([broken.code]);
    expect(ticked).toBe(true);
  });
});
