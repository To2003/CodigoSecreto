import { describe, expect, it } from 'vitest';
import { simulateGame } from './simulate';

/** Fuzz: random bots across many seeds must always reach GAME_OVER with every action accepted. */
describe('simulateGame', () => {
  it.each([
    ['any reveal', {}],
    ['majority reveal', { revealMode: 'majority' as const }],
    ['no objections', { objections: false }],
  ])('plays 200 complete games (%s)', (_label, settings) => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state, events } = simulateGame(seed, settings);
      expect(state.phase.name).toBe('over');
      expect(state.cards).toHaveLength(25);
      expect(events.filter((e) => e.type === 'GAME_OVER')).toHaveLength(1);
      expect(events.at(-1)?.type).toBe('GAME_OVER');
      // Every reveal is unique and refers to a real card.
      const revealed = events.flatMap((e) => (e.type === 'CARD_REVEALED' ? [e.cardId] : []));
      expect(new Set(revealed).size).toBe(revealed.length);
      expect(state.cards.filter((c) => c.revealed)).toHaveLength(revealed.length);
    }
  });

  it('is reproducible from the seed', () => {
    expect(simulateGame(7)).toEqual(simulateGame(7));
  });

  it('reports a game that never ends', () => {
    expect(() => simulateGame(1, {}, 3)).toThrow(/did not end/);
  });
});
