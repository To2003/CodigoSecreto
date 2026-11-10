import { describe, expect, it } from 'vitest';
import { normalizeWord } from '../engine/clue';
import { DECKS, getDeck } from './index';

/** SPEC §7 quality rules. */
describe('word decks', () => {
  it('has the Clásico (≥ 400) and Argento (≥ 200) decks', () => {
    expect(getDeck('clasico')?.words.length).toBeGreaterThanOrEqual(400);
    expect(getDeck('argento')?.words.length).toBeGreaterThanOrEqual(200);
    expect(getDeck('nope')).toBeUndefined();
  });

  it.each(DECKS.map((deck) => [deck.id, deck] as const))(
    '%s: single uppercase words of 3–11 letters',
    (_id, deck) => {
      for (const word of deck.words) {
        expect(word, word).toMatch(/^[A-ZÁÉÍÓÚÜÑ]{3,11}$/u);
      }
      expect(deck.name.length).toBeGreaterThan(0);
      expect(deck.description.length).toBeGreaterThan(0);
    },
  );

  it('has no repeated word within or across decks (accents ignored)', () => {
    const seen = new Map<string, string>();
    for (const deck of DECKS) {
      for (const word of deck.words) {
        const key = normalizeWord(word);
        expect(
          seen.get(key),
          `${word} in ${deck.id} repeats ${seen.get(key) ?? ''}`,
        ).toBeUndefined();
        seen.set(key, `${word} (${deck.id})`);
      }
    }
  });
});

describe('DECK_INFO', () => {
  it('matches the real decks (ids, names and sizes)', async () => {
    const { DECK_INFO } = await import('./meta');
    expect(DECK_INFO).toEqual(
      DECKS.map((d) => ({ id: d.id, name: d.name, count: d.words.length })),
    );
  });
});
