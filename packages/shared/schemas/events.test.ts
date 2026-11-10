import { describe, expect, it } from 'vitest';
import { clientEvents, roomCodeSchema, sanitizeNickname } from './events';

describe('roomCodeSchema', () => {
  it('accepts 4 unambiguous letters, case-insensitive', () => {
    expect(roomCodeSchema.parse(' ktrx ')).toBe('KTRX');
  });

  it.each(['KTR', 'KTRXX', 'KTO1', 'KTRO', 'KTRI', 'KTRL', 'KT-X'])('rejects %s', (code) => {
    expect(roomCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe('sanitizeNickname', () => {
  it.each([
    ['  Tomi  ', 'Tomi'],
    ['La   Chola', 'La Chola'],
    ['<b>Juan</b>', 'bJuan/b'],
    ['Ñandú\u0000\u0007', 'Ñandú'],
    ['x'.repeat(30), 'x'.repeat(20)],
  ])('%j → %j', (input, expected) => {
    expect(sanitizeNickname(input)).toBe(expected);
  });

  it('returns an empty string when nothing printable is left', () => {
    expect(sanitizeNickname(' <> \u0001 ')).toBe('');
  });
});

describe('clientEvents', () => {
  const profile = { nickname: 'Tomi', avatar: 3, color: 'oro' };

  it('room:create takes a profile', () => {
    expect(clientEvents['room:create'].parse(profile)).toEqual(profile);
  });

  it.each([
    ['avatar out of range', { ...profile, avatar: 12 }],
    ['unknown color', { ...profile, color: 'fucsia' }],
    ['extra keys', { ...profile, admin: true }],
    ['missing nickname', { avatar: 1, color: 'oro' }],
  ])('room:create rejects %s', (_label, payload) => {
    expect(clientEvents['room:create'].safeParse(payload).success).toBe(false);
  });

  it('room:join takes a code and an optional token pair', () => {
    expect(
      clientEvents['room:join'].parse({
        ...profile,
        roomCode: 'ktrx',
        playerId: 'p1',
        token: 't'.repeat(32),
      }),
    ).toMatchObject({ roomCode: 'KTRX' });
    expect(clientEvents['room:join'].safeParse({ ...profile, roomCode: 'KTRX' }).success).toBe(
      true,
    );
  });

  it('lobby:updateSettings takes a partial, strict settings patch', () => {
    expect(clientEvents['lobby:updateSettings'].parse({ settings: { clueTimer: 60 } })).toEqual({
      settings: { clueTimer: 60 },
    });
    expect(
      clientEvents['lobby:updateSettings'].safeParse({ settings: { clueTimer: 61 } }).success,
    ).toBe(false);
    expect(clientEvents['lobby:updateSettings'].safeParse({ settings: { hack: 1 } }).success).toBe(
      false,
    );
  });

  it('lobby:setTeam / setRole / kick validate their enums and ids', () => {
    expect(clientEvents['lobby:setTeam'].safeParse({ team: 'spectator' }).success).toBe(true);
    expect(clientEvents['lobby:setTeam'].safeParse({ team: 'green' }).success).toBe(false);
    expect(clientEvents['lobby:setRole'].safeParse({ role: 'spymaster' }).success).toBe(true);
    expect(clientEvents['lobby:kick'].safeParse({ playerId: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('game events', () => {
  it('game:clue takes a word and a count of 0–9 or "inf"', () => {
    expect(clientEvents['game:clue'].safeParse({ word: 'PLAYA', count: 2 }).success).toBe(true);
    expect(clientEvents['game:clue'].safeParse({ word: 'PLAYA', count: 'inf' }).success).toBe(true);
    expect(clientEvents['game:clue'].safeParse({ word: 'PLAYA', count: 10 }).success).toBe(false);
    expect(clientEvents['game:clue'].safeParse({ word: 'x'.repeat(61), count: 1 }).success).toBe(
      false,
    );
  });

  it('game:point accepts null to clear; game:rematch defaults keepSpymasters', () => {
    expect(clientEvents['game:point'].parse({ cardId: null })).toEqual({ cardId: null });
    expect(clientEvents['game:rematch'].parse({})).toEqual({ keepSpymasters: false });
  });
});
