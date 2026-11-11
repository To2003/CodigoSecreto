import { mulberry32, startCoop, type CoopState } from '@clave/shared';
import { describe, expect, it } from 'vitest';
import { toCoopView } from './coopView';

const WORDS = Array.from({ length: 25 }, (_, i) => `PALABRA${String.fromCharCode(65 + i)}`);
function game(): CoopState {
  const res = startCoop(
    [
      { id: 'a', team: 'red', role: 'agent', connected: true },
      { id: 'b', team: 'blue', role: 'agent', connected: true },
      { id: 's', team: 'spectator', role: 'agent', connected: true },
    ],
    WORDS,
    false,
    mulberry32(7),
  );
  if (!res.ok) throw new Error(res.error.code);
  return res.state;
}

describe('toCoopView (anti-leak, spec §6)', () => {
  it('each side gets its own map and nothing of the other', () => {
    const s = game();
    const a = toCoopView(s, 'a');
    expect(a.side).toBe('red');
    a.cards.forEach((card, i) => {
      expect(card.key).toBe(s.cards[i]?.key.red);
      expect(card.keys).toBeUndefined();
    });
    const b = toCoopView(s, 'b');
    b.cards.forEach((card, i) => {
      expect(card.key).toBe(s.cards[i]?.key.blue);
    });
    // The serialized view of A can't be used to rebuild B's map.
    expect(JSON.stringify(a)).not.toContain('"blue":');
  });

  it('spectators and players who joined later get no map', () => {
    const s = game();
    for (const id of ['s', 'late']) {
      const v = toCoopView(s, id);
      expect(v.side).toBeNull();
      expect(v.cards.every((c) => c.key === undefined && c.keys === undefined)).toBe(true);
    }
  });

  it('both maps are public once the game is over', () => {
    const s = game();
    s.phase = { name: 'over', won: false, reason: 'traitor' };
    const v = toCoopView(s, 's');
    v.cards.forEach((card, i) => {
      expect(card.keys).toEqual(s.cards[i]?.key);
    });
  });

  it('is a copy: changing the view does not touch the state', () => {
    const s = game();
    const v = toCoopView(s, 'a');
    v.cards[0]?.civilianFor.push('red');
    expect(s.cards[0]?.civilianFor).toEqual([]);
  });
});
